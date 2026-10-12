"use client";

// Browser helpers for client downloads: single files through a hidden frame,
// and whole folders as ONE zip built in the browser by /transfer-zip-sw.js
// (files stream straight from storage; nothing passes through the website).

export type ZipFile = { name: string; size: number; url: string; lastModified?: string };

export function startDownload(url: string) {
  // A hidden frame per file: opening the link on the page itself counts as
  // leaving the page in Safari, which cancels any download that follows.
  const frame = document.createElement("iframe");
  frame.style.display = "none";
  frame.setAttribute("aria-hidden", "true");
  frame.src = url;
  document.body.appendChild(frame);
  window.setTimeout(() => frame.remove(), 5 * 60 * 1000);
}

export const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function zipHelper() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return undefined;
  try {
    const registration = await navigator.serviceWorker.register("/transfer-zip-sw.js", { scope: "/transfer/" });
    if (registration.active) return registration.active;
    const worker = registration.installing || registration.waiting;
    if (!worker) return undefined;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("timeout")), 10000);
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") { window.clearTimeout(timer); resolve(); }
        if (worker.state === "redundant") { window.clearTimeout(timer); reject(new Error("redundant")); }
      });
    });
    return registration.active ?? worker;
  } catch {
    return undefined;
  }
}

/** Can this browser read files straight from storage? (Needed to build the zip.) */
async function storageReadable(url: string) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { mode: "cors", credentials: "omit", signal: controller.signal });
    controller.abort();
    return response.ok;
  } catch (error) {
    return error instanceof DOMException && error.name === "AbortError";
  } finally {
    window.clearTimeout(timer);
  }
}

function postToWorker(worker: ServiceWorker, message: unknown) {
  return new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => reject(new Error("timeout")), 5000);
    channel.port1.onmessage = () => { window.clearTimeout(timer); resolve(); };
    worker.postMessage(message, [channel.port2]);
  });
}

/** Starts the helper early so it's ready when the links arrive. */
export function prepareZip() {
  return zipHelper();
}

/**
 * Downloads files as one zip. Resolves false if this browser can't build a
 * zip, so the caller can download them one by one instead.
 */
export async function downloadAsZip(
  worker: ServiceWorker | undefined,
  name: string,
  files: ZipFile[],
  events: {
    progress: (done: number, total: number) => void;
    done: (total: number) => void;
    error: (message: string) => void;
    unsupported: () => void;
  },
) {
  if (!worker || !files.length || !(await storageReadable(files[0].url))) return false;
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  await postToWorker(worker, { type: "zip-job", id, name, files });

  const onMessage = (event: MessageEvent) => {
    const data = event.data || {};
    if (data.id !== id) return;
    if (data.type === "zip-progress") events.progress(data.done, data.total);
    if (data.type === "zip-done") { events.done(data.total); stop(); }
    if (data.type === "zip-error") { events.error(String(data.message)); stop(); }
  };
  const keepAlive = window.setInterval(() => worker.postMessage({ type: "keep-alive" }), 10000);
  const onFallback = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.data?.type !== "zip-unsupported" || event.data.id !== id) return;
    stop();
    events.unsupported();
  };
  function stop() {
    window.clearInterval(keepAlive);
    navigator.serviceWorker.removeEventListener("message", onMessage);
    window.removeEventListener("message", onFallback);
  }
  navigator.serviceWorker.addEventListener("message", onMessage);
  window.addEventListener("message", onFallback);
  startDownload("/transfer/zip-download/" + id);
  return true;
}

/** The personal code on the end of an emailed link (?r=…), if there is one. */
export function recipientCodeFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get("r") || undefined;
  } catch {
    return undefined;
  }
}
