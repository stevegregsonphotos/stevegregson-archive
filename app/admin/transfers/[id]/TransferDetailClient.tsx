"use client";

import { useRef, useState } from "react";
import type { TransferRecord } from "@/lib/transfers/types";
import styles from "../transfers.module.css";

type QueuedFile = { file: File; relativePath: string };

function bytes(value: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value, unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return (size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)) + " " + units[unit];
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London",
  }).format(new Date(value));
}

function inputFiles(list: FileList | null): QueuedFile[] {
  if (!list) return [];
  return Array.from(list).map((file) => ({
    file,
    relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }));
}

export default function TransferDetailClient({ initialTransfer, publicUrl }: {
  initialTransfer: TransferRecord; publicUrl: string;
}) {
  const [transfer, setTransfer] = useState(initialTransfer);
  const [editing, setEditing] = useState(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const folderRef = useRef<HTMLInputElement | null>(null);

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/transfers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({ ok: false, message: "The server returned an invalid response." }));
    if (!response.ok || !data.ok) throw new Error(data.message || "Transfer update failed.");
    return data;
  }

  async function addQueued() {
    if (!queue.length) return;
    setBusy(true); setMessage("");
    try {
      const batchSize = 20;
      for (let start = 0; start < queue.length; start += batchSize) {
        const batch = queue.slice(start, start + batchSize);
        const signed = await post({
          action: "presign-batch", transferId: transfer.id,
          files: batch.map(({ file, relativePath }) => ({
            name: file.name, relativePath, size: file.size,
            type: file.type || "application/octet-stream",
          })),
        });
        const committed = [];
        for (let i = 0; i < batch.length; i += 1) {
          const job = signed.jobs[i];
          const queued = batch[i];
          setMessage("Uploading " + (start + i + 1) + " of " + queue.length + " · " + queued.file.name);
          const put = await fetch(job.uploadUrl, { method: "PUT", body: queued.file });
          if (!put.ok) throw new Error("Upload failed for " + queued.file.name + " (HTTP " + put.status + ").");
          committed.push(job);
        }
        await post({ action: "commit-batch", transferId: transfer.id, files: committed });
      }
      const refreshed = await post({ action: "refresh-files", transferId: transfer.id });
      setTransfer(refreshed.transfer);
      setQueue([]);
      setMessage("Files added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add files.");
    } finally { setBusy(false); }
  }

  async function removeFile(fileId: string) {
    if (!confirm("Remove this file from the transfer?")) return;
    setBusy(true); setMessage("");
    try {
      const result = await post({ action: "remove-file", transferId: transfer.id, fileId });
      setTransfer(result.transfer);
      setMessage("File removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove file.");
    } finally { setBusy(false); }
  }

  const latestDownload = transfer.downloads[0];
  return <main className={styles.detail}>
    <a className={styles.detailBack} href="/admin/transfers">← Back to Transfers</a>
    <header className={styles.detailHero}>
      <div>
        <p className={styles.detailEyebrow}>Steve Gregson Delivery</p>
        <h1>{transfer.title}</h1>
        <p className={styles.detailMeta}>{transfer.fileCount} {transfer.fileCount === 1 ? "file" : "files"} · {bytes(transfer.totalSizeBytes)} · Sent {date(transfer.finalizedAt || transfer.createdAt)}</p>
      </div>
      <div className={styles.detailActions}>
        <button type="button" onClick={() => navigator.clipboard.writeText(publicUrl)}>Copy link</button>
        <button type="button" onClick={() => setEditing((value) => !value)}>Edit files</button>
        <a href={publicUrl} target="_blank" rel="noreferrer">Preview</a>
      </div>
    </header>

    <div className={styles.detailLink}><input readOnly value={publicUrl}/><button type="button" onClick={() => navigator.clipboard.writeText(publicUrl)}>Copy</button></div>

    <section className={styles.detailCards}>
      <article><span>Expiration date</span><strong>{date(transfer.expiresAt)}</strong></article>
      <article><span>Total downloads</span><strong>{transfer.downloads.length}</strong>{latestDownload && <small>Latest {date(latestDownload.createdAt)}</small>}</article>
      <article><span>Access</span><strong>{transfer.hasPassword ? "Password protected" : "Anyone with the link"}</strong></article>
    </section>

    <div className={styles.detailGrid}>
      <section className={styles.detailPanel}>
        <div className={styles.panelHead}><h2>Transfer activity</h2></div>
        <div className={styles.eventRow}><span>Sent to {transfer.recipients.map((r) => r.email).join(", ")}</span><span>{date(transfer.finalizedAt || transfer.createdAt)}</span></div>
        {transfer.downloads.map((event) => <div className={styles.eventRow} key={event.id}><span>{event.eventType === "all" ? "Transfer downloaded" : "File downloaded"}{event.recipientEmail ? " · " + event.recipientEmail : ""}</span><span>{date(event.createdAt)}</span></div>)}
        {!transfer.downloads.length && <p className={styles.muted}>No downloads yet.</p>}
      </section>

      <section className={styles.detailPanel}>
        <div className={styles.panelHead}><h2>{transfer.fileCount} {transfer.fileCount === 1 ? "file" : "files"}</h2>{editing && <span>Edit files</span>}</div>
        {editing && <div className={styles.editFiles}>
          <label><input type="file" multiple onChange={(e) => setQueue((q) => [...q, ...inputFiles(e.target.files)])}/><span>+ Add files</span></label>
          <button type="button" onClick={() => folderRef.current?.click()}>+ Add folder</button>
          <input ref={folderRef} className={styles.hidden} type="file" multiple {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)} onChange={(e) => setQueue((q) => [...q, ...inputFiles(e.target.files)])}/>
          {queue.length > 0 && <button type="button" disabled={busy} onClick={addQueued}>Upload {queue.length} {queue.length === 1 ? "file" : "files"}</button>}
        </div>}
        <div className={styles.fileList}>{transfer.files.map((file) => <div className={styles.fileRow} key={file.id}><span>{file.relativePath}<small>{bytes(file.sizeBytes)}</small></span>{editing && <button type="button" disabled={busy || transfer.files.length <= 1} onClick={() => removeFile(file.id)}>Remove</button>}</div>)}</div>
        {message && <p className={styles.editMessage} aria-live="polite">{message}</p>}
      </section>
    </div>
  </main>;
}
