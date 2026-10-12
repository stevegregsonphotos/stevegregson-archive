"use client";

import { useRef, useState } from "react";
import styles from "./request.module.css";
import {
  describeProgress,
  filesFromInput,
  formatBytes,
  oversizedFiles,
  uploadQueue,
  warnBeforeLeaving,
  type QueuedFile,
} from "@/lib/transfers/upload-client";
import { useFileDrop } from "@/lib/transfers/use-file-drop";

function longDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(new Date(value));
}

export default function RequestUploadClient({ token, open, title, message, expiresAt, background }: {
  token: string; open: boolean; title: string; message: string; expiresAt?: string; background?: string;
}) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState("");
  const [done, setDone] = useState<number | null>(null);
  const [closed, setClosed] = useState(!open);
  const folderRef = useRef<HTMLInputElement | null>(null);
  const { dragging, dropProps } = useFileDrop((files) => setQueue((q) => [...q, ...files]), !busy && !closed && done === null);
  const total = queue.reduce((sum, item) => sum + item.file.size, 0);

  async function call(body: Record<string, unknown>) {
    const response = await fetch("/api/requests/" + token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({ ok: false, message: "Something went wrong. Please try again." }));
    if (data.closed) setClosed(true);
    if (!data.ok) throw new Error(data.message || "Something went wrong.");
    return data;
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!queue.length || !name.trim()) return;
    const tooBig = oversizedFiles(queue);
    if (tooBig.length) { setError("These files are over 5 GB: " + tooBig.slice(0, 3).join(", ") + ". Please send them another way."); return; }
    setBusy(true);
    setError("");
    const stop = warnBeforeLeaving();
    const startedAt = new Date().toISOString();
    try {
      await uploadQueue(
        queue,
        async (items) => {
          const data = await call({ action: "presign", name, email, startedAt, files: items.map((item) => ({ path: item.relativePath, size: item.file.size })) });
          return (data.uploads as Array<{ url: string }>).map((upload) => ({ uploadUrl: upload.url }));
        },
        async () => {},
        (p) => { setPercent(p.totalBytes ? Math.floor((p.sentBytes / p.totalBytes) * 100) : 0); setProgress(describeProgress(p)); },
      );
      setProgress("Finishing…");
      const result = await call({ action: "complete", name, email, startedAt });
      setDone(result.fileCount);
      setQueue([]);
    } catch (problem) {
      setError((problem instanceof Error ? problem.message : "Upload failed.") + " Anything that finished is safely with Steve; press Send to try the rest again.");
    } finally {
      stop();
      setBusy(false);
    }
  }

  return (
    <main className={styles.page} {...dropProps}>
      {background ? <div className={styles.photo} style={{ backgroundImage: "url(" + background + ")" }} aria-hidden="true" /> : null}
      <div className={styles.scrim} aria-hidden="true" />
      <header className={styles.header}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/branding/steve-gregson-logo-white.png" alt="Steve Gregson Photography" width={900} height={512} />
        <a href="https://www.stevegregson.com" target="_blank" rel="noopener">stevegregson.com</a>
      </header>

      <section className={styles.card + (dragging ? " " + styles.dragging : "")}>
        <p className={styles.eyebrow}>{closed ? "Steve Gregson Photography" : "Send files to Steve Gregson"}</p>
        <h1>{title}</h1>

        {closed ? (
          <p className={styles.text}>This upload link has closed. If you still need to send something, just email <a href="mailto:info@stevegregson.com">info@stevegregson.com</a> and Steve will send a new link.</p>
        ) : done !== null ? (
          <div className={styles.done}>
            <span aria-hidden="true">✓</span>
            <p><strong>Thank you{name ? ", " + name.split(" ")[0] : ""}.</strong> {done} {done === 1 ? "file has" : "files have"} been sent to Steve.</p>
            <button type="button" className={styles.link} onClick={() => setDone(null)}>Send more files</button>
          </div>
        ) : (
          <form onSubmit={send} className={styles.form}>
            {message ? <blockquote className={styles.message}>{message}</blockquote> : null}

            <div className={styles.drop}>
              <strong>{dragging ? "Drop to add" : queue.length ? "Add more" : "Drag files or folders here"}</strong>
              <span>
                <label>Browse files<input type="file" multiple disabled={busy} onChange={(e) => setQueue((q) => [...q, ...filesFromInput(e.target.files)])} /></label>
                {" · "}
                <button type="button" disabled={busy} onClick={() => folderRef.current?.click()}>Browse folders</button>
              </span>
              <input ref={folderRef} className={styles.hidden} type="file" multiple
                {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
                onChange={(e) => setQueue((q) => [...q, ...filesFromInput(e.target.files)])} />
            </div>

            {queue.length ? (
              <div className={styles.chip}>
                <span><strong>{queue.length} {queue.length === 1 ? "file" : "files"}</strong> {formatBytes(total)}</span>
                <button type="button" disabled={busy} onClick={() => setQueue([])}>Remove all</button>
              </div>
            ) : null}

            <label className={styles.field}><span>Your name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required disabled={busy} /></label>
            <label className={styles.field}><span>Your email <em>optional</em></span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={busy} /></label>

            <button
              type="submit"
              className={styles.send + (busy ? " " + styles.sending : "")}
              style={busy ? ({ "--fill": percent + "%" } as React.CSSProperties) : undefined}
              disabled={busy || !queue.length || !name.trim()}
            >
              {busy ? <span>{progress || "Starting…"}</span> : "Send to Steve"}
            </button>
            {error ? <p className={styles.error}>{error}</p> : null}
            {expiresAt ? <p className={styles.small}>This link works until {longDate(expiresAt)}.</p> : null}
          </form>
        )}
      </section>
    </main>
  );
}
