// Browser-side upload engine shared by "Send files" and "Edit files".
// Files go straight from Steve's browser to storage (never through Vercel).

export type QueuedFile = { file: File; relativePath: string };

export type UploadProgress = {
  doneFiles: number;
  totalFiles: number;
  sentBytes: number;
  totalBytes: number;
  current: string;
};

type Job = {
  id: string;
  originalName: string;
  relativePath: string;
  sizeBytes: number;
  contentType: string;
  objectKey: string;
  uploadUrl: string;
};

/** Single-request uploads to S3-compatible storage top out at 5 GB. */
export const MAX_FILE_BYTES = 5 * 1024 ** 3;
const BATCH_SIZE = 20;
const PARALLEL_UPLOADS = 3;
const ATTEMPTS = 3;

export function filesFromInput(list: FileList | null): QueuedFile[] {
  if (!list) return [];
  return Array.from(list).map((file) => ({
    file,
    relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }));
}

export function formatBytes(value: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return (size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)) + " " + units[unit];
}

export function describeProgress(p: UploadProgress) {
  const percent = p.totalBytes ? Math.floor((p.sentBytes / p.totalBytes) * 100) : 0;
  return "Uploading " + Math.min(p.doneFiles + 1, p.totalFiles) + " of " + p.totalFiles +
    " · " + formatBytes(p.sentBytes) + " of " + formatBytes(p.totalBytes) + " (" + percent + "%)" +
    (p.current ? " · " + p.current : "");
}

/** Names of queued files too big to upload, so we can stop before starting. */
export function oversizedFiles(queue: QueuedFile[]) {
  return queue.filter((item) => item.file.size > MAX_FILE_BYTES).map((item) => item.relativePath);
}

export async function postTransferAction<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/admin/transfers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({ ok: false, message: "The server returned an unexpected response." }));
  if (response.status === 401) throw new Error("Your Backstage login has expired. Log in again in another tab, then retry.");
  if (!response.ok || !data.ok) throw new Error(data.message || "Something went wrong (HTTP " + response.status + ").");
  return data as T;
}

function putFile(url: string, file: File, onBytes: (loaded: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (event) => onBytes(event.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new Error("HTTP " + xhr.status)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("aborted"));
    xhr.send(file);
  });
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function signFiles(transferId: string, items: QueuedFile[]) {
  const signed = await postTransferAction<{ jobs: Job[] }>({
    action: "presign-batch",
    transferId,
    files: items.map(({ file, relativePath }) => ({
      name: file.name,
      relativePath,
      size: file.size,
      type: file.type || "application/octet-stream",
    })),
  });
  return signed.jobs;
}

type Sign<J> = (items: QueuedFile[]) => Promise<J[]>;
type AfterBatch<J> = (jobs: J[]) => Promise<void>;
type OnProgress = (progress: UploadProgress) => void;

const WORKER_URL = "/transfer-upload-worker.js";

/** Starts the background upload worker, or returns null if this browser can't. */
async function startUploadWorker(): Promise<Worker | null> {
  if (typeof Worker === "undefined") return null;
  let worker: Worker;
  try {
    worker = new Worker(WORKER_URL);
  } catch {
    return null;
  }
  const ok = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 4000);
    worker.onmessage = (event) => {
      if (event.data?.type === "pong") { clearTimeout(timer); resolve(true); }
    };
    worker.onerror = () => { clearTimeout(timer); resolve(false); };
    worker.postMessage({ type: "ping" });
  });
  if (!ok) { worker.terminate(); return null; }
  return worker;
}

/** Holding a Web Lock stops Chrome from freezing the tab while uploading. */
function holdTabAwake<T>(work: () => Promise<T>): Promise<T> {
  const locks = (typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined);
  if (!locks?.request) return work();
  return locks.request("stevegregson-upload-" + Math.random().toString(36).slice(2), () => work()) as Promise<T>;
}

/**
 * True if the browser can still read this file. A file that was changed on
 * the Mac after it was picked (e.g. Bridge saving a metadata edit, or the
 * Storage app replacing it) can no longer be read, and every upload of it
 * fails — which used to show up as a misleading "check your internet" error.
 */
async function canRead(file: File) {
  try {
    await file.slice(0, 1).arrayBuffer();
    return true;
  } catch {
    return false;
  }
}

/** Files (by name) that changed after being picked. Checks 1 byte of each. */
export async function changedSincePicked(queue: QueuedFile[]) {
  const bad: string[] = [];
  let next = 0;
  const check = async () => {
    while (next < queue.length) {
      const item = queue[next++];
      if (!(await canRead(item.file))) bad.push(item.relativePath || item.file.name);
    }
  };
  await Promise.all(Array.from({ length: Math.min(16, queue.length) }, check));
  return bad;
}

export function changedFilesMessage(names: string[]) {
  const example = names[0].split("/").pop();
  return (names.length === 1 ? "\"" + example + "\" has" : names.length.toLocaleString("en-GB") + " files (e.g. \"" + example + "\") have") +
    " changed on your Mac since you picked them — probably a metadata edit in Bridge. " +
    "Nothing was sent. Please pick the files or folder again, then press Transfer.";
}

/**
 * Uploads every queued file with live byte progress. Sending happens in a
 * background worker (6 at a time) so it keeps full speed when the tab isn't
 * in front; the next batch of upload links is signed while the current one
 * uploads. `sign` gets links for a batch of up to 20; `afterBatch` runs once
 * each batch is up, in order. Falls back to uploading from the page itself.
 */
export async function uploadQueue<J extends { uploadUrl: string }>(
  queue: QueuedFile[],
  sign: Sign<J>,
  afterBatch: AfterBatch<J>,
  onProgress: OnProgress,
) {
  if (!queue.length) return;
  // Before sending anything: are all the picked files still readable?
  const changed = await changedSincePicked(queue);
  if (changed.length) throw new Error(changedFilesMessage(changed));
  return holdTabAwake(async () => {
    const worker = await startUploadWorker();
    if (!worker) return uploadQueueInPage(queue, sign, afterBatch, onProgress);
    try {
      return await uploadQueueWithWorker(queue, sign, afterBatch, onProgress, worker);
    } finally {
      worker.terminate();
    }
  });
}

const WORKER_ROUNDS = 2; // each round = 2 tries in the worker; fresh link between rounds

function uploadQueueWithWorker<J extends { uploadUrl: string }>(
  queue: QueuedFile[],
  sign: Sign<J>,
  afterBatch: AfterBatch<J>,
  onProgress: OnProgress,
  worker: Worker,
) {
  const totalBytes = queue.reduce((sum, item) => sum + item.file.size, 0);
  const loaded = new Map<number, number>();
  const batches = new Map<number, { jobs: J[]; left: number }>();
  const rounds = new Map<number, number>();
  let doneFiles = 0;
  let nextToSign = 0;
  let nextToCommit = 0;
  let handedOver = 0;
  let signing = false;
  let failed = false;
  let commitChain = Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const fail = (error: unknown) => {
      if (failed) return;
      failed = true;
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const report = () => onProgress({
      doneFiles,
      totalFiles: queue.length,
      sentBytes: Array.from(loaded.values()).reduce((a, b) => a + b, 0),
      totalBytes,
      current: doneFiles < queue.length ? queue[doneFiles].file.name : "",
    });

    const hand = (start: number, items: QueuedFile[], jobs: J[]) => {
      handedOver += items.length;
      worker.postMessage({
        type: "jobs",
        jobs: items.map((item, i) => ({ slot: start + i, url: jobs[i].uploadUrl, file: item.file })),
      });
    };

    // Keep about two batches waiting in the worker so it never runs dry.
    const feed = async () => {
      if (signing || failed) return;
      signing = true;
      try {
        while (!failed && nextToSign < queue.length && handedOver < BATCH_SIZE * 2) {
          const start = nextToSign;
          const items = queue.slice(start, start + BATCH_SIZE);
          nextToSign += items.length;
          const jobs = await sign(items);
          batches.set(start, { jobs, left: items.length });
          hand(start, items, jobs);
        }
      } catch (error) {
        fail(error);
      } finally {
        signing = false;
      }
    };

    // Save finished batches in order, while later batches keep uploading.
    const commitReady = () => {
      for (;;) {
        const batch = batches.get(nextToCommit);
        if (!batch || batch.left > 0) break;
        batches.delete(nextToCommit);
        nextToCommit += batch.jobs.length;
        const last = nextToCommit >= queue.length;
        commitChain = commitChain
          .then(() => (failed ? undefined : afterBatch(batch.jobs)))
          .then(() => {
            if (last && !failed) {
              loaded.clear();
              loaded.set(-1, totalBytes);
              report();
              resolve();
            }
          })
          .catch(fail);
      }
    };

    const batchStart = (slot: number) => slot - (slot % BATCH_SIZE);

    worker.onmessage = (event) => {
      if (failed) return;
      const message = event.data || {};
      if (message.type === "progress") {
        for (const [slot, bytes] of message.loaded as [number, number][]) loaded.set(slot, bytes);
        report();
      } else if (message.type === "done") {
        const slot = message.slot as number;
        loaded.set(slot, queue[slot].file.size);
        doneFiles += 1;
        handedOver -= 1;
        const batch = batches.get(batchStart(slot));
        if (batch) batch.left -= 1;
        report();
        commitReady();
        void feed();
      } else if (message.type === "failed") {
        const slot = message.slot as number;
        const reason = String(message.reason || "unknown");
        handedOver -= 1;
        loaded.set(slot, 0);
        const round = (rounds.get(slot) || 1) + 1;
        rounds.set(slot, round);
        const name = queue[slot].file.name;
        if (round > WORKER_ROUNDS) {
          void canRead(queue[slot].file).then((readable) => fail(new Error(
            !readable
              ? changedFilesMessage([queue[slot].relativePath || name])
              : reason === "network"
                ? "Couldn't reach file storage while uploading " + name + ". Check your internet connection and try again."
                : "Upload failed for " + name + " (" + reason + ") after " + WORKER_ROUNDS * 2 + " tries.",
          )));
          return;
        }
        // A fresh link in case the old one expired or was rejected.
        sign([queue[slot]]).then((jobs) => {
          if (failed) return;
          const batch = batches.get(batchStart(slot));
          if (batch) batch.jobs[slot - batchStart(slot)] = jobs[0];
          hand(slot, [queue[slot]], jobs);
        }).catch(fail);
      }
    };
    worker.onerror = () => fail(new Error("The background uploader stopped unexpectedly. Please try again."));

    report();
    void feed();
  });
}

/** The original in-page uploader: 3 at a time. Used if a worker can't start. */
async function uploadQueueInPage<J extends { uploadUrl: string }>(
  queue: QueuedFile[],
  sign: Sign<J>,
  afterBatch: AfterBatch<J>,
  onProgress: OnProgress,
) {
  const totalBytes = queue.reduce((sum, item) => sum + item.file.size, 0);
  const loaded = new Map<number, number>();
  let doneFiles = 0;
  let current = "";

  const report = () => onProgress({
    doneFiles,
    totalFiles: queue.length,
    sentBytes: Array.from(loaded.values()).reduce((a, b) => a + b, 0),
    totalBytes,
    current,
  });

  for (let start = 0; start < queue.length; start += BATCH_SIZE) {
    const batch = queue.slice(start, start + BATCH_SIZE);
    const jobs = await sign(batch);
    const finished: J[] = new Array(batch.length);
    let next = 0;

    const worker = async () => {
      while (next < batch.length) {
        const i = next++;
        const queued = batch[i];
        const slot = start + i;
        let job = jobs[i];

        for (let attempt = 1; ; attempt += 1) {
          current = queued.file.name;
          report();
          try {
            await putFile(job.uploadUrl, queued.file, (bytes) => {
              loaded.set(slot, bytes);
              report();
            });
            break;
          } catch (error) {
            loaded.set(slot, 0);
            const reason = error instanceof Error ? error.message : "unknown";
            if (attempt >= ATTEMPTS) {
              if (!(await canRead(queued.file))) throw new Error(changedFilesMessage([queued.relativePath || queued.file.name]));
              throw new Error(
                reason === "network"
                  ? "Couldn't reach file storage while uploading " + queued.file.name + ". Check your internet connection (or the storage CORS settings) and try again."
                  : "Upload failed for " + queued.file.name + " (" + reason + ") after " + ATTEMPTS + " tries.",
              );
            }
            await pause(1500 * attempt);
            // A fresh link in case the old one expired or was rejected.
            job = (await sign([queued]))[0];
          }
        }

        loaded.set(slot, queued.file.size);
        finished[i] = job;
        doneFiles += 1;
        report();
      }
    };

    await Promise.all(Array.from({ length: Math.min(PARALLEL_UPLOADS, batch.length) }, worker));
    await afterBatch(finished);
  }

  current = "";
  report();
}

/**
 * Uploads queued files into a transfer, saving them to it after every batch.
 * Returns each queued file's new id, in the same order as the queue.
 */
export async function uploadFilesToTransfer(
  transferId: string,
  queue: QueuedFile[],
  onProgress: (progress: UploadProgress) => void,
) {
  const ids: string[] = [];
  await uploadQueue<Job>(
    queue,
    (items) => signFiles(transferId, items),
    async (jobs) => {
      await postTransferAction({ action: "commit-batch", transferId, files: jobs });
      // The saved id is the last part of the storage key.
      ids.push(...jobs.map((job) => job.objectKey.split("/").pop() || job.id));
    },
    onProgress,
  );
  return ids;
}

/** Warns Steve before closing the tab mid-upload. Returns a function to stop warning. */
export function warnBeforeLeaving() {
  const handler = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = "";
  };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}

// ---- Drag and drop -------------------------------------------------------

type Entry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
  file?: (resolve: (file: File) => void, reject: (error: unknown) => void) => void;
  createReader?: () => { readEntries: (resolve: (entries: Entry[]) => void, reject: (error: unknown) => void) => void };
};

async function readFolder(entry: Entry): Promise<Entry[]> {
  const reader = entry.createReader!();
  const all: Entry[] = [];
  // Browsers hand folder contents over in chunks (about 100 at a time).
  for (;;) {
    const chunk = await new Promise<Entry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (!chunk.length) return all;
    all.push(...chunk);
  }
}

async function walk(entry: Entry, out: QueuedFile[]) {
  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((resolve, reject) => entry.file!(resolve, reject));
    // Skip macOS housekeeping files.
    if (file.name === ".DS_Store" || file.name.startsWith("._")) return;
    out.push({ file, relativePath: entry.fullPath.replace(/^\//, "") || file.name });
  } else if (entry.isDirectory) {
    for (const child of await readFolder(entry)) await walk(child, out);
  }
}

/** Files (including whole dropped folders, keeping their structure) from a drop. */
export async function filesFromDrop(data: DataTransfer): Promise<QueuedFile[]> {
  const entries = Array.from(data.items || [])
    .map((item) => (item.webkitGetAsEntry?.() ?? null) as unknown as Entry | null)
    .filter((entry): entry is Entry => Boolean(entry));
  if (!entries.length) {
    return Array.from(data.files || []).map((file) => ({ file, relativePath: file.name }));
  }
  const out: QueuedFile[] = [];
  for (const entry of entries) await walk(entry, out);
  return out;
}

/** True while something being dragged over the page is files (not text etc.). */
export function isFileDrag(event: { dataTransfer: DataTransfer | null }) {
  return Array.from(event.dataTransfer?.types || []).includes("Files");
}
