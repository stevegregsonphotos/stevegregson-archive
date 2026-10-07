"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { TransferRecord } from "@/lib/transfers/types";
import styles from "./transfers.module.css";

type QueuedFile = { file: File; relativePath: string };

function bytes(value: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value, unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return (size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)) + " " + units[unit];
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

function inputFiles(list: FileList | null): QueuedFile[] {
  if (!list) return [];
  return Array.from(list).map((file) => ({
    file,
    relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }));
}

export default function TransferWorkspace({ initialTransfers }: { initialTransfers: TransferRecord[] }) {
  const [transfers, setTransfers] = useState(initialTransfers);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [recipient, setRecipient] = useState("");
  const [senderEmail, setSenderEmail] = useState("info@stevegregson.com");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [expiryDays, setExpiryDays] = useState("60");
  const [password, setPassword] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const folderRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transfers;
    return transfers.filter((transfer) =>
      [transfer.title, ...transfer.recipients.map((r) => r.email), ...transfer.files.map((f) => f.relativePath)]
        .some((value) => value.toLowerCase().includes(q)),
    );
  }, [search, transfers]);

  const totalBytes = queue.reduce((sum, item) => sum + item.file.size, 0);

  async function refresh() {
    const response = await fetch("/api/admin/transfers", { cache: "no-store" });
    const data = await response.json();
    if (data.ok) setTransfers(data.transfers);
  }

  async function send() {
    if (!queue.length || !recipient.trim() || !title.trim()) return;
    setSending(true);
    setResultUrl("");
    try {
      const expiresAt = new Date(Date.now() + Number(expiryDays) * 86400000).toISOString();
      setProgress("Creating transfer…");
      const createdResponse = await fetch("/api/admin/transfers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create", title, message, senderEmail,
          recipientEmails: recipient.split(/[,\n;]/).map((v) => v.trim()).filter(Boolean),
          expiresAt, password,
        }),
      });
      const created = await createdResponse.json();
      if (!created.ok) throw new Error(created.message || "Could not create transfer.");
      const transferId = created.transfer.id;

      const batchSize = 20;
      let uploaded = 0;
      for (let start = 0; start < queue.length; start += batchSize) {
        const batch = queue.slice(start, start + batchSize);
        setProgress("Preparing " + (start + 1) + "–" + Math.min(start + batch.length, queue.length) + " of " + queue.length + "…");
        const signResponse = await fetch("/api/admin/transfers", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "presign-batch", transferId,
            files: batch.map(({ file, relativePath }) => ({
              name: file.name, relativePath, size: file.size,
              type: file.type || "application/octet-stream",
            })),
          }),
        });
        const signed = await signResponse.json();
        if (!signed.ok) throw new Error(signed.message || "Could not prepare upload.");

        const committed = [];
        for (let i = 0; i < batch.length; i += 1) {
          const job = signed.jobs[i];
          const queued = batch[i];
          setProgress("Uploading " + (uploaded + 1) + " of " + queue.length + " · " + queued.file.name);
          const put = await fetch(
            job.uploadUrl,
            {
              method: "PUT",
              headers: {
                "Content-Type":
                  queued.file.type ||
                  "application/octet-stream",
              },
              body: queued.file,
            },
          );
          if (!put.ok) {
            throw new Error(
              "Upload failed for " +
                queued.file.name +
                " (HTTP " +
                put.status +
                ").",
            );
          }
          committed.push(job);
          uploaded += 1;
        }

        const commitResponse = await fetch("/api/admin/transfers", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "commit-batch", transferId, files: committed }),
        });
        const commit = await commitResponse.json();
        if (!commit.ok) throw new Error(commit.message || "Could not verify uploaded files.");
      }

      setProgress("Finishing transfer…");
      const finishResponse = await fetch("/api/admin/transfers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finalize", transferId }),
      });
      const finish = await finishResponse.json();
      if (!finish.ok) throw new Error(finish.message || "Could not finish transfer.");
      setResultUrl(finish.publicUrl);
      setQueue([]); setTitle(""); setMessage(""); setPassword("");
      setProgress(finish.email?.previewSuppressed ? "Ready · preview email suppressed" : "Sent");
      await refresh();
    } catch (error) {
      setProgress(error instanceof Error ? error.message : "Transfer failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.send}>
        <div className={styles.sendHead}>
          <p>Steve Gregson Delivery</p>
          <h1>Send files</h1>
        </div>

        <div className={styles.pickers}>
          <label>
            <input type="file" multiple onChange={(e) => setQueue((q) => [...q, ...inputFiles(e.target.files)])} />
            <span className={styles.plus}>+</span><strong>{queue.length > 0 ? "Add more files" : "Add files"}</strong>
          </label>
          <button type="button" onClick={() => folderRef.current?.click()}>
            <span className={styles.folder}>▰</span><strong>{queue.length > 0 ? "Add more folders" : "Add folders"}</strong>
          </button>
          <input
            ref={folderRef}
            className={styles.hidden}
            type="file"
            multiple
            {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
            onChange={(e) => setQueue((q) => [...q, ...inputFiles(e.target.files)])}
          />
        </div>

        {queue.length > 0 && (
          <div className={styles.queue}>
            <span>{queue.length} {queue.length === 1 ? "file" : "files"}</span>
            <span>{bytes(totalBytes)}</span>
            <button type="button" onClick={() => setQueue([])}>Clear</button>
          </div>
        )}

        <label className={styles.field}><span>Email to</span><input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="client@example.com" /></label>
        <label className={styles.field}><span>Your email</span><input value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} /></label>
        <label className={styles.field}><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className={styles.field}><span>Message</span><textarea value={message} onChange={(e) => setMessage(e.target.value)} /></label>

        <div className={styles.options}>
          <label><span>Expires</span><select value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)}><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></label>
          <label><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Optional" /></label>
        </div>

        <button className={styles.transferButton} type="button" disabled={sending || !queue.length || !recipient.trim() || !title.trim()} onClick={send}>
          {sending ? "Transferring…" : "Transfer"}
        </button>
        {progress && <p className={styles.progress} aria-live="polite">{progress}</p>}
        {resultUrl && <div className={styles.result}><input readOnly value={resultUrl} /><button type="button" onClick={() => navigator.clipboard.writeText(resultUrl)}>Copy link</button></div>}
      </section>

      <section className={styles.history}>
        <div className={styles.historyHead}>
          <div><p>Steve Gregson</p><h2>Transfers</h2></div>
          <span>{transfers.length} sent</span>
        </div>
        <div className={styles.tabs}><button className={styles.activeTab}>Sent</button><button disabled>Requested</button><button disabled>Received</button></div>
        <label className={styles.search}><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title, file name, or email" /></label>

        <div className={styles.list}>
          {filtered.map((transfer) => {
            const downloaded = transfer.downloads.length > 0;
            return (
              <Link href={"/admin/transfers/" + transfer.id} className={styles.row} key={transfer.id}>
                <div>
                  <h3>{transfer.title}</h3>
                  <p>{transfer.recipients.map((r) => r.email).join(", ")}</p>
                  <p>Sent {date(transfer.finalizedAt || transfer.createdAt)} · {bytes(transfer.totalSizeBytes)} ({transfer.fileCount} files) · <strong>{downloaded ? "Downloaded" : transfer.status === "expired" ? "Expired" : "Not downloaded"}</strong></p>
                </div>
                <span aria-hidden="true">›</span>
              </Link>
            );
          })}
          {!filtered.length && <p className={styles.empty}>No transfers match your search.</p>}
        </div>
      </section>
    </main>
  );
}
