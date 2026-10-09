"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { TransferRecord } from "@/lib/transfers/types";
import BackgroundPicker from "./BackgroundPicker";
import styles from "../transfers.module.css";
import {
  describeProgress,
  filesFromInput as inputFiles,
  formatBytes as bytes,
  oversizedFiles,
  postTransferAction,
  uploadFilesToTransfer,
  warnBeforeLeaving,
  type QueuedFile,
} from "@/lib/transfers/upload-client";
import { useFileDrop } from "@/lib/transfers/use-file-drop";

function date(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London",
  }).format(new Date(value));
}

export default function TransferDetailClient({ initialTransfer, publicUrl }: {
  initialTransfer: TransferRecord; publicUrl: string;
}) {
  const [transfer, setTransfer] = useState(initialTransfer);
  const [editing, setEditing] = useState(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [designing, setDesigning] = useState(false);
  const folderRef = useRef<HTMLInputElement | null>(null);
  const canEdit = transfer.status === "active" && !transfer.filesPurgedAt;
  const { dragging, dropProps } = useFileDrop((files) => {
    setEditing(true);
    setQueue((q) => [...q, ...files]);
  }, canEdit && !busy);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const post = (body: Record<string, unknown>) => postTransferAction<any>(body);

  async function addQueued() {
    if (!queue.length) return;
    const tooBig = oversizedFiles(queue);
    if (tooBig.length) {
      setMessage("These files are over 5 GB and can't be added in one piece yet: " + tooBig.slice(0, 3).join(", ") + ".");
      return;
    }
    setBusy(true); setMessage("");
    const stopWarning = warnBeforeLeaving();
    try {
      await uploadFilesToTransfer(transfer.id, queue, (p) => setMessage(describeProgress(p)));
      setQueue([]);
      setMessage("Files added.");
    } catch (error) {
      setMessage((error instanceof Error ? error.message : "Could not add files.") + " Any files that finished are already in the transfer.");
    } finally {
      // Show whatever made it in, even after a failure part-way through.
      const refreshed = await post({ action: "refresh-files", transferId: transfer.id }).catch(() => null);
      if (refreshed?.transfer) setTransfer(refreshed.transfer);
      stopWarning();
      setBusy(false);
    }
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
  return <main
    className={styles.detail + " " + styles.dropZone + (dragging ? " " + styles.dropActive : "")}
    data-drop-label="Drop files or folders to add them to this transfer"
    {...dropProps}
  >
    <Link className={styles.detailBack} href="/admin/transfers">← Back to Transfers</Link>
    <header className={styles.detailHero}>
      <div>
        <p className={styles.detailEyebrow}>Steve Gregson · Transfer</p>
        <h1>{transfer.title}</h1>
        <p className={styles.detailMeta}>{transfer.fileCount} {transfer.fileCount === 1 ? "file" : "files"} · {bytes(transfer.totalSizeBytes)} · Sent {date(transfer.finalizedAt || transfer.createdAt)}</p>
      </div>
      <div className={styles.detailActions}>
        <button type="button" onClick={() => navigator.clipboard.writeText(publicUrl)}>Copy link</button>
        <button type="button" disabled={!canEdit} title={canEdit ? undefined : "Only live transfers can be edited"} onClick={() => setEditing((value) => !value)}>Edit files</button>
        <button type="button" disabled={!canEdit} onClick={() => setDesigning((value) => !value)}>{designing ? "Close backgrounds" : "Client page backgrounds"}</button>
        <a href={"/transfer/preview?id=" + encodeURIComponent(transfer.id)} target="_blank" rel="noopener">Preview as client ↗</a>
      </div>
    </header>
    {designing && canEdit ? <BackgroundPicker transfer={transfer} onChange={setTransfer} /> : null}
    {transfer.filesPurgedAt && <p className={styles.purgedNote}>This transfer expired and its uploaded files were cleared from storage on {date(transfer.filesPurgedAt)}. Anything sent from Storage is still in Storage.</p>}

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
          {queue.length > 0 && <button type="button" disabled={busy} onClick={() => setQueue([])}>Clear</button>}
        </div>}
        {editing && <p className={styles.detailDropHint}>Tip: you can also drag files or folders onto this page.</p>}
        <div className={styles.fileList}>{transfer.files.map((file) => <div className={styles.fileRow} key={file.id}><span>{file.relativePath}<small>{bytes(file.sizeBytes)}</small></span>{editing && <button type="button" disabled={busy || transfer.files.length <= 1} onClick={() => removeFile(file.id)}>Remove</button>}</div>)}</div>
        {message && <p className={styles.editMessage} aria-live="polite">{message}</p>}
      </section>
    </div>
  </main>;
}
