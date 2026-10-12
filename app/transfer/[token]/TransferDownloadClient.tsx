"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicTransferView } from "@/lib/transfers/types";
import styles from "./client-page.module.css";

function bytes(value: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return (size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)) + " " + units[unit];
}

function longDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(new Date(value));
}

function daysLeft(value: string) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
}

function kindOf(name: string) {
  const ext = name.toLowerCase().split(".").pop() || "";
  if (["jpg", "jpeg", "png", "webp", "gif", "tif", "tiff", "heic", "cr3", "cr2", "nef", "arw", "dng"].includes(ext)) return "Photo";
  if (["mp4", "mov", "m4v", "avi", "mkv"].includes(ext)) return "Video";
  if (["pdf"].includes(ext)) return "PDF";
  if (["zip"].includes(ext)) return "ZIP";
  return ext ? ext.toUpperCase().slice(0, 4) : "File";
}

function startDownload(url: string) {
  // Each file downloads inside its own hidden frame. Opening the link on the
  // page itself counts as leaving the page in Safari, which cancels the next
  // download request ("Load failed") part-way through "Download all".
  const frame = document.createElement("iframe");
  frame.style.display = "none";
  frame.setAttribute("aria-hidden", "true");
  frame.src = url;
  document.body.appendChild(frame);
  // Leave plenty of time for the browser to hand the file to its downloads.
  window.setTimeout(() => frame.remove(), 5 * 60 * 1000);
}

/** The personal code on the end of an emailed link (?r=…), if there is one. */
function recipientCode() {
  try {
    return new URLSearchParams(window.location.search).get("r") || undefined;
  } catch {
    return undefined;
  }
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const PREPARING = "Preparing your download…";

type ZipFile = { name: string; size: number; url: string; lastModified?: string };

/** Starts the helper that streams every file into one .zip download. */
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
    controller.abort(); // only the headers were needed
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
const SLIDE_MS = 7000;

/** Crossfading full-screen photography; only shows images once they've loaded. */
function useSlideshow(urls: string[]) {
  const [loaded, setLoaded] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Load the first image straight away, then the rest one by one.
    (async () => {
      for (const url of urls) {
        await new Promise<void>((resolve) => {
          const image = new Image();
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = url;
        }).then(() => {
          if (!cancelled) setLoaded((current) => (current.includes(url) ? current : [...current, url]));
        });
      }
    })();
    return () => { cancelled = true; };
  }, [urls]);

  useEffect(() => {
    if (loaded.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % loaded.length), SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [loaded.length]);

  return { slides: loaded, active: loaded.length ? index % loaded.length : -1, setIndex };
}

export default function TransferDownloadClient({ initial, demo = false }: { initial: PublicTransferView; demo?: boolean }) {
  const [transfer, setTransfer] = useState(initial);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; name: string } | null>(null);
  const [finished, setFinished] = useState(false);
  const [zipMode, setZipMode] = useState(false);
  const [showFiles, setShowFiles] = useState(initial.files.length <= 6);

  const backgrounds = useMemo(() => transfer.backgroundUrls, [transfer.backgroundUrls]);
  const { slides, active, setIndex } = useSlideshow(backgrounds);

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    if (demo) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/transfers/" + transfer.token + "/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!data.ok) {
        setMessage(data.message || "Could not open this transfer.");
        return;
      }
      setIndex(0);
      setTransfer(data.transfer);
      setShowFiles(data.transfer.files.length <= 6);
    } finally {
      setBusy(false);
    }
  }

  async function requestUrl(fileId: string, partOfAll = false) {
    // One automatic retry covers a brief network blip.
    for (let attempt = 1; ; attempt += 1) {
      try {
        const response = await fetch("/api/transfers/" + transfer.token + "/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId, password, r: recipientCode(), partOfAll }),
        });
        const data = await response.json().catch(() => ({}));
        if (!data.ok || !data.url) throw new Error(data.message || "Download unavailable.");
        return data.url as string;
      } catch (error) {
        if (attempt >= 2) {
          throw new Error(
            error instanceof TypeError
              ? "The connection dropped. Please press Download all again."
              : error instanceof Error ? error.message : "Download unavailable.",
          );
        }
        await wait(1200);
      }
    }
  }

  async function download(fileId: string) {
    if (demo) {
      setMessage("This is a preview — downloads are switched off.");
      return;
    }
    setMessage("");
    try {
      startDownload(await requestUrl(fileId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Download unavailable.");
    }
  }

  /** The old way: each file saved separately (used if the zip can't be made). */
  async function downloadOneByOne(alreadyLogged = true) {
    for (let i = 0; i < transfer.files.length; i += 1) {
      setProgress({ done: i, total: transfer.files.length, name: transfer.files[i].name });
      startDownload(await requestUrl(transfer.files[i].id, alreadyLogged));
      await wait(transfer.files.length > 1 ? 900 : 0);
    }
    setProgress({ done: transfer.files.length, total: transfer.files.length, name: "" });
    setZipMode(false);
    setFinished(true);
  }

  async function downloadAll() {
    if (demo) {
      setMessage("This is a preview — downloads are switched off.");
      return;
    }
    setBusy(true);
    setFinished(false);
    setMessage("");
    setProgress({ done: 0, total: transfer.files.length, name: PREPARING });
    try {
      const [worker, links] = await Promise.all([
        zipHelper(),
        fetch("/api/transfers/" + transfer.token + "/download-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password, r: recipientCode() }),
        }).then((response) => response.json()).catch(() => ({ ok: false })),
      ]);

      if (!links.ok) {
        if (links.message) throw new Error(links.message);
        await downloadOneByOne(false);
        return;
      }
      const files = links.files as ZipFile[];
      if (!worker || !files.length || !(await storageReadable(files[0].url))) {
        await downloadOneByOne();
        return;
      }

      const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      await postToWorker(worker, { type: "zip-job", id, name: links.name || transfer.title, files });

      // Hear progress from the helper, and keep it awake during long downloads.
      const onMessage = (event: MessageEvent) => {
        const data = event.data || {};
        if (data.id !== id) return;
        if (data.type === "zip-progress") setProgress({ done: data.done, total: data.total, name: "" });
        if (data.type === "zip-done") { setProgress({ done: data.total, total: data.total, name: "" }); setFinished(true); stop(); }
        if (data.type === "zip-error") { setMessage("The download stopped part-way (" + data.message + "). Please press Download all again."); stop(); }
      };
      const keepAlive = window.setInterval(() => worker.postMessage({ type: "keep-alive" }), 10000);
      const stop = () => {
        window.clearInterval(keepAlive);
        navigator.serviceWorker.removeEventListener("message", onMessage);
      };
      navigator.serviceWorker.addEventListener("message", onMessage);

      // If this browser can't build the zip after all, the server answers the
      // request instead and the page falls back to one-by-one downloads.
      const onFallback = (event: MessageEvent) => {
        if (event.origin !== window.location.origin || event.data?.type !== "zip-unsupported" || event.data.id !== id) return;
        window.removeEventListener("message", onFallback);
        stop();
        setZipMode(false);
        void downloadOneByOne().catch((error) => setMessage(error instanceof Error ? error.message : "Download unavailable."));
      };
      window.addEventListener("message", onFallback);

      setZipMode(true);
      startDownload("/transfer/zip-download/" + id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Download unavailable.");
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  const single = transfer.files.length === 1;
  const remaining = daysLeft(transfer.expiresAt);
  const percent = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;

  return (
    <main className={styles.page}>
      <div className={styles.stage} aria-hidden="true">
        {slides.map((url, i) => (
          <div
            key={url}
            className={styles.slide + (i === active ? " " + styles.slideActive : "")}
            style={{ backgroundImage: "url(" + url + ")" }}
          />
        ))}
        <div className={styles.scrim} />
      </div>

      <header className={styles.header}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.logo} src="/images/branding/steve-gregson-logo-white.png" alt="Steve Gregson Photography" width={900} height={512} />
        <a className={styles.siteLink} href="https://www.stevegregson.com" target="_blank" rel="noopener">stevegregson.com</a>
      </header>

      <div className={styles.layout}>
        <section className={styles.panel} aria-labelledby="transfer-title">
          <p className={styles.eyebrow}>
            {transfer.available ? "Steve Gregson sent you files" : "Steve Gregson Photography"}
          </p>
          <h1 id="transfer-title" className={styles.title}>{transfer.title}</h1>

          {!transfer.available ? (
            <div className={styles.notice}>
              <p>This transfer has expired or is no longer available.</p>
              <p>If you still need these files, just get in touch and Steve will send them again.</p>
              <a className={styles.secondaryButton} href={"mailto:info@stevegregson.com?subject=" + encodeURIComponent("Files: " + transfer.title)}>
                Email info@stevegregson.com
              </a>
            </div>
          ) : (
            <>
              <ul className={styles.facts}>
                <li>{transfer.fileCount} {transfer.fileCount === 1 ? "file" : "files"}</li>
                <li>{bytes(transfer.totalSizeBytes)}</li>
                <li title={"Available until " + longDate(transfer.expiresAt)}>
                  {remaining <= 1 ? "Last day to download" : remaining <= 7 ? remaining + " days left" : "Until " + longDate(transfer.expiresAt)}
                </li>
              </ul>

              {transfer.locked ? (
                <form className={styles.unlock} onSubmit={unlock}>
                  <label htmlFor="transfer-password">This transfer is password protected</label>
                  <div className={styles.unlockRow}>
                    <input
                      id="transfer-password"
                      type="password"
                      autoComplete="off"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter password"
                    />
                    <button type="submit" className={styles.primaryButton} disabled={busy || !password}>
                      {busy ? "Checking…" : "Unlock"}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {transfer.message ? <blockquote className={styles.message}>{transfer.message}</blockquote> : null}

                  <button
                    type="button"
                    className={styles.primaryButton + " " + styles.downloadAll}
                    disabled={busy || !transfer.files.length}
                    onClick={() => (single ? void download(transfer.files[0].id) : void downloadAll())}
                  >
                    <span aria-hidden="true">↓</span>
                    {single ? "Download" : "Download all"}
                    <small>{bytes(transfer.totalSizeBytes)}</small>
                  </button>

                  {progress && !finished ? (
                    <div className={styles.progress} aria-live="polite">
                      <div className={styles.progressBar}><span style={{ width: percent + "%" }} /></div>
                      <p>
                        {zipMode
                          ? "Downloading as one zip · " + progress.done + " of " + progress.total + " files"
                          : progress.name === PREPARING
                            ? PREPARING
                            : "Starting " + Math.min(progress.done + 1, progress.total) + " of " + progress.total + (progress.name ? " · " + progress.name : "")}
                      </p>
                      {zipMode ? <p>Please keep this page open until it finishes.</p> : null}
                    </div>
                  ) : null}
                  {finished ? (
                    <p className={styles.success} aria-live="polite">
                      {zipMode
                        ? "✓ Done — all " + transfer.files.length + " files are in one zip in your Downloads."
                        : "✓ All " + transfer.files.length + " downloads started. If your browser asks, allow it to download multiple files."}
                    </p>
                  ) : !single && !progress ? (
                    <p className={styles.hint}>Downloads as a single zip file, with folders kept.</p>
                  ) : null}

                  {!single ? (
                    <div className={styles.files}>
                      <button type="button" className={styles.filesToggle} onClick={() => setShowFiles((open) => !open)} aria-expanded={showFiles}>
                        {showFiles ? "Hide files" : "View files"} <span>{transfer.files.length}</span>
                      </button>
                      {showFiles ? (
                        <ul className={styles.fileList}>
                          {transfer.files.map((file) => {
                            const parts = file.name.split("/");
                            const name = parts.pop() || file.name;
                            return (
                              <li key={file.id}>
                                <span className={styles.fileKind}>{kindOf(name)}</span>
                                <span className={styles.fileName}>
                                  <strong title={file.name}>{name}</strong>
                                  <small>{parts.length ? parts.join(" / ") + " · " : ""}{bytes(file.sizeBytes)}</small>
                                </span>
                                <button type="button" onClick={() => void download(file.id)} aria-label={"Download " + name} title="Download">↓</button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
              {message ? <p className={styles.error} aria-live="polite">{message}</p> : null}
            </>
          )}

          <p className={styles.contact}>
            Questions? <a href="mailto:info@stevegregson.com">info@stevegregson.com</a>
          </p>
        </section>
      </div>

      <footer className={styles.footer}>
        <span>Photography © Steve Gregson</span>
        {slides.length > 1 ? (
          <div className={styles.dots}>
            {slides.map((url, i) => (
              <button
                type="button"
                key={url}
                aria-label={"Show photograph " + (i + 1)}
                className={i === active ? styles.dotActive : ""}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        ) : null}
      </footer>
    </main>
  );
}
