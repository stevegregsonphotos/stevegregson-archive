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
  // The storage link is served as an attachment, so this saves the file
  // without leaving the page (and allows several downloads in a row).
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
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

  async function requestUrl(fileId: string) {
    const response = await fetch("/api/transfers/" + transfer.token + "/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!data.ok || !data.url) throw new Error(data.message || "Download unavailable.");
    return data.url as string;
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

  async function downloadAll() {
    if (demo) {
      setMessage("This is a preview — downloads are switched off.");
      return;
    }
    setBusy(true);
    setFinished(false);
    setMessage("");
    try {
      for (let i = 0; i < transfer.files.length; i += 1) {
        setProgress({ done: i, total: transfer.files.length, name: transfer.files[i].name });
        startDownload(await requestUrl(transfer.files[i].id));
        await wait(transfer.files.length > 1 ? 700 : 0);
      }
      setProgress({ done: transfer.files.length, total: transfer.files.length, name: "" });
      setFinished(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Download unavailable.");
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
                      <p>Starting {progress.done + 1} of {progress.total}{progress.name ? " · " + progress.name : ""}</p>
                    </div>
                  ) : null}
                  {finished ? (
                    <p className={styles.success} aria-live="polite">
                      ✓ All {transfer.files.length} downloads started. If your browser asks, allow it to download multiple files.
                    </p>
                  ) : !single && !progress ? (
                    <p className={styles.hint}>Files download one after another. Your browser may ask you to allow multiple downloads.</p>
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
