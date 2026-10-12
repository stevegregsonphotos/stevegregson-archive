/* Steve Gregson file transfers — builds "Download all" as ONE zip file.
 *
 * The client's browser fetches each file straight from storage and streams
 * them into a single .zip as it downloads (folders kept, any size), so the
 * files never pass through the website's servers.
 */
importScripts("/vendor/client-zip-2.5.0.js");

const jobs = new Map(); // id -> { name, files: [{ name, size, url, lastModified }] }

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "zip-job" && data.id && Array.isArray(data.files)) {
    jobs.set(data.id, { name: data.name || "Files", files: data.files });
    // Forget unused jobs after an hour.
    setTimeout(() => jobs.delete(data.id), 60 * 60 * 1000);
    if (event.ports && event.ports[0]) event.ports[0].postMessage({ ok: true });
  }
  // "keep-alive" messages simply wake the worker while a long download runs.
});

function contentDisposition(name) {
  const clean = String(name).replace(/[\r\n"\\/]/g, "").trim() || "Files";
  const ascii = clean.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").trim() || "Files";
  const encoded = encodeURIComponent(clean).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return 'attachment; filename="' + ascii + ".zip\"; filename*=UTF-8''" + encoded + ".zip";
}

async function notify(message) {
  const all = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  for (const client of all) client.postMessage(message);
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const match = url.pathname.match(/^\/transfer\/zip-download\/([A-Za-z0-9_-]+)$/);
  if (!match || url.origin !== self.location.origin) return;

  const id = match[1];
  const job = jobs.get(id);
  if (!job) {
    event.respondWith(new Response("This download link has expired. Please go back and press Download all again.", {
      status: 410,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }));
    return;
  }
  jobs.delete(id);

  let finish;
  const finished = new Promise((resolve) => { finish = resolve; });

  async function* entries() {
    let done = 0;
    try {
      for (const file of job.files) {
        let response;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            response = await fetch(file.url, { mode: "cors", credentials: "omit" });
            if (response.ok) break;
          } catch (error) {
            response = undefined;
          }
          await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
        if (!response || !response.ok) throw new Error("Couldn't fetch " + file.name);
        yield { name: file.name, lastModified: file.lastModified ? new Date(file.lastModified) : new Date(), input: response, size: file.size };
        done += 1;
        notify({ type: "zip-progress", id, done, total: job.files.length });
      }
      notify({ type: "zip-done", id, total: job.files.length });
    } catch (error) {
      notify({ type: "zip-error", id, message: String(error && error.message || error) });
      throw error;
    } finally {
      finish();
    }
  }

  const sizesKnown = job.files.every((file) => Number.isFinite(file.size) && file.size >= 0);
  const response = downloadZip(entries(), sizesKnown
    ? { metadata: job.files.map((file) => ({ name: file.name, size: file.size })) }
    : undefined);
  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/zip");
  headers.set("Content-Disposition", contentDisposition(job.name));
  headers.set("Cache-Control", "no-store");

  event.respondWith(new Response(response.body, { status: 200, headers }));
  // Keep the worker running until the last byte has been written.
  event.waitUntil(finished);
});
