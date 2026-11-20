// Background upload worker for Transfers and Storage uploads.
// Browsers slow down a page's own code when its tab isn't in front, which
// stretched the gap between files. A dedicated worker keeps sending at full
// speed whether or not the tab is visible. The page signs upload links and
// hands them over; this worker PUTs the files and reports back.

const PARALLEL = 6;
const queue = [];
let running = 0;
const loaded = new Map();
let progressTimer = 0;

function flushProgress() {
  progressTimer = 0;
  if (!loaded.size) return;
  self.postMessage({ type: "progress", loaded: Array.from(loaded.entries()) });
  loaded.clear();
}

function noteBytes(slot, bytes) {
  loaded.set(slot, bytes);
  if (!progressTimer) progressTimer = setTimeout(flushProgress, 250);
}

function putOnce(job) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", job.url);
    xhr.upload.onprogress = (event) => noteBytes(job.slot, event.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("HTTP " + xhr.status)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("aborted"));
    xhr.send(job.file);
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(job) {
  running += 1;
  try {
    let lastError = "unknown";
    // One quick retry with the same link; the page re-signs for further tries.
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await putOnce(job);
        noteBytes(job.slot, job.file.size);
        flushProgress();
        self.postMessage({ type: "done", slot: job.slot });
        return;
      } catch (error) {
        lastError = error && error.message ? error.message : "unknown";
        noteBytes(job.slot, 0);
        if (attempt < 2) await wait(1500);
      }
    }
    flushProgress();
    self.postMessage({ type: "failed", slot: job.slot, reason: lastError });
  } finally {
    running -= 1;
    pump();
  }
}

function pump() {
  while (running < PARALLEL && queue.length) run(queue.shift());
  self.postMessage({ type: "waiting", count: queue.length + running });
}

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === "jobs") {
    for (const job of message.jobs) queue.push(job);
    pump();
  } else if (message.type === "ping") {
    self.postMessage({ type: "pong" });
  }
};
