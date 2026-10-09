"use client";

import { useEffect, useState } from "react";
import type { PublicTransferView } from "@/lib/transfers/types";
import styles from "../../admin/transfers/transfers.module.css";
import { TRANSFER_BRAND_BACKGROUNDS } from "@/lib/transfers/backgrounds";

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

function date(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(new Date(value));
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

export default function TransferDownloadClient({ initial }: { initial: PublicTransferView }) {
  const [transfer, setTransfer] = useState(initial);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [index, setIndex] = useState(0);

  const backgrounds = transfer.backgroundUrls.length
    ? transfer.backgroundUrls
    : [...TRANSFER_BRAND_BACKGROUNDS];

  useEffect(() => {
    if (backgrounds.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % backgrounds.length), 7000);
    return () => window.clearInterval(timer);
  }, [backgrounds.length]);

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
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
    setMessage("Preparing download…");
    try {
      startDownload(await requestUrl(fileId));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Download unavailable.");
    }
  }

  async function downloadAll() {
    setBusy(true);
    try {
      for (let i = 0; i < transfer.files.length; i += 1) {
        setMessage("Downloading " + (i + 1) + " of " + transfer.files.length + "…");
        startDownload(await requestUrl(transfer.files[i].id));
        await wait(700);
      }
      setMessage("All downloads started. If your browser asks, allow it to download multiple files.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Download unavailable.");
    } finally {
      setBusy(false);
    }
  }

  const background = backgrounds[index % backgrounds.length];

  return (
    <main
      className={styles.publicShowcase}
      style={background ? { backgroundImage: "linear-gradient(90deg,rgba(0,0,0,.18),rgba(0,0,0,.05)),url(" + background + ")" } : undefined}
    >
      <div className={styles.publicBrand}>
        <strong>STEVE GREGSON</strong>
        <span>THEATRE & PERFORMANCE PHOTOGRAPHY</span>
      </div>

      <section className={styles.publicFloat}>
        <p className={styles.publicEyebrow}>Steve Gregson · File transfer</p>
        <h1>{transfer.title}</h1>

        {!transfer.available ? (
          <p>This transfer is no longer available. Please contact Steve if you still need these files.</p>
        ) : (
          <>
            <p className={styles.publicMeta}>
              {transfer.fileCount} {transfer.fileCount === 1 ? "file" : "files"} · {bytes(transfer.totalSizeBytes)} · Available until {date(transfer.expiresAt)}
            </p>

            {transfer.locked ? (
              <form onSubmit={unlock}>
                <label className={styles.publicPassword}>
                  <span>This transfer is password protected</span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                  />
                </label>
                <div className={styles.publicFile}>
                  <span />
                  <button type="submit" disabled={busy || !password}>{busy ? "Checking…" : "Open"}</button>
                </div>
              </form>
            ) : (
              <>
                {transfer.message && <p className={styles.publicMessage}>{transfer.message}</p>}
                {transfer.files.length > 1 && (
                  <div className={styles.publicFile}>
                    <span>All files</span>
                    <button type="button" disabled={busy} onClick={downloadAll}>Download all</button>
                  </div>
                )}
                <div className={styles.publicFiles}>
                  {transfer.files.map((file) => (
                    <div className={styles.publicFile} key={file.id}>
                      <span>{file.name} · {bytes(file.sizeBytes)}</span>
                      <button type="button" disabled={busy} onClick={() => download(file.id)}>Download</button>
                    </div>
                  ))}
                </div>
              </>
            )}
            {message && <p aria-live="polite">{message}</p>}
          </>
        )}
      </section>

      {backgrounds.length > 1 && (
        <div className={styles.publicDots}>
          {backgrounds.map((_, i) => (
            <button
              type="button"
              key={i}
              aria-label={"Background " + (i + 1)}
              className={i === index % backgrounds.length ? styles.dotActive : ""}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
