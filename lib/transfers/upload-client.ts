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

/**
 * Uploads every queued file into a transfer: 3 at a time, with live byte
 * progress, up to 3 attempts per file (with a fresh upload link on retry),
 * and the files saved to the transfer after every batch of 20.
 */
export async function uploadFilesToTransfer(
  transferId: string,
  queue: QueuedFile[],
  onProgress: (progress: UploadProgress) => void,
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
    const jobs = await signFiles(transferId, batch);
    const finished: Job[] = new Array(batch.length);
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
              throw new Error(
                reason === "network"
                  ? "Couldn't reach file storage while uploading " + queued.file.name + ". Check your internet connection (or the storage CORS settings) and try again."
                  : "Upload failed for " + queued.file.name + " (" + reason + ") after " + ATTEMPTS + " tries.",
              );
            }
            await pause(1500 * attempt);
            // A fresh link in case the old one expired or was rejected.
            job = (await signFiles(transferId, [queued]))[0];
          }
        }

        loaded.set(slot, queued.file.size);
        finished[i] = job;
        doneFiles += 1;
        report();
      }
    };

    await Promise.all(Array.from({ length: Math.min(PARALLEL_UPLOADS, batch.length) }, worker));
    await postTransferAction({ action: "commit-batch", transferId, files: finished });
  }

  current = "";
  report();
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
