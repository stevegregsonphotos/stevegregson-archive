"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./workspace.module.css";
import { formatBytes as bytes } from "@/lib/transfers/upload-client";

type Upload = { id: string; uploaderName: string; uploaderEmail?: string; folderPath: string; fileCount: number; totalBytes: number; createdAt: string };
type FileRequest = {
  id: string; token: string; title: string; message: string; recipientEmail?: string; folderPath: string;
  status: "open" | "closed"; expiresAt: string; createdAt: string; uploads: Upload[]; link: string;
};

function date(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(value));
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/admin/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({ ok: false, message: "Unexpected response." }));
  if (!data.ok) throw new Error(data.message || "Something went wrong.");
  return data as T;
}

function storageLink(path: string) {
  return "/admin/storage?path=" + encodeURIComponent(path);
}

/** "Requests" tab: links clients use to send files to Steve. */
export default function RequestsPanel() {
  const [requests, setRequests] = useState<FileRequest[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    try { setRequests((await call<{ requests: FileRequest[] }>({ action: "list" })).requests); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Couldn't load requests."); setRequests([]); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const data = await call<{ request: FileRequest; email: { sent: number; failed: string[]; previewSuppressed: boolean } | null }>({
        action: "create", title, email, message, expiryDays: Number(days),
      });
      setTitle(""); setEmail(""); setMessage(""); setCreating(false);
      await load();
      const note = !data.email ? "Copy the link below and send it." : data.email.previewSuppressed ? "This is the test site, so no email was sent — copy the link." : data.email.failed.length ? "The email didn't send — copy the link and send it yourself." : "Emailed to " + email + ".";
      setStatus("Request created. " + note);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Couldn't create the request.");
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "close" | "reopen" | "delete" | "resend") {
    if (action === "delete" && !window.confirm("Delete this request? The link stops working. Files already sent stay in Storage.")) return;
    setBusy(true);
    try {
      if (action === "resend") { await call({ action, id }); setStatus("Emailed again."); }
      else { const data = await call<{ requests: FileRequest[] }>({ action, id }); setRequests(data.requests); }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(link: string) {
    try { await navigator.clipboard.writeText(link); setCopied(link); } catch { setStatus("Couldn't copy — select the link and copy it."); }
  }

  return (
    <div className={styles.requests}>
      <div className={styles.requestsIntro}>
        <p>Send a client a link and they can upload files to you — logos, cast lists, programme credits. Everything they send lands in Storage.</p>
        <button type="button" className={styles.darkButton} onClick={() => setCreating((open) => !open)}>{creating ? "Cancel" : "+ New request"}</button>
      </div>

      {creating ? (
        <form className={styles.requestForm} onSubmit={create}>
          <label className={styles.field}><span>What do you need?</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Steel Pier — logos and cast list" required /></label>
          <div className={styles.row2}>
            <label className={styles.field}><span>Client&rsquo;s email <em>optional</em></span><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@example.com" inputMode="email" /></label>
            <label className={styles.field}><span>Link works for</span><select value={days} onChange={(e) => setDays(e.target.value)}><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></label>
          </div>
          <label className={styles.field}><span>Message <em>optional</em></span><textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
          <p className={styles.formNote}>Files will go into <strong>Storage › Received › {title.trim() || "…"}</strong>.</p>
          <button type="submit" className={styles.sendButton} disabled={busy || !title.trim()}>{busy ? "Creating…" : email.trim() ? "Create and email link" : "Create link"}</button>
        </form>
      ) : null}

      {status ? <p className={styles.requestStatus} aria-live="polite">{status}</p> : null}

      <div className={styles.list}>
        {requests === null ? <p className={styles.empty}>Loading…</p> : null}
        {requests && !requests.length ? <p className={styles.empty}>No requests yet.</p> : null}
        {requests?.map((item) => {
          const received = item.uploads.reduce((sum, upload) => sum + upload.fileCount, 0);
          return (
            <article className={styles.requestItem} key={item.id}>
              <div className={styles.requestTop}>
                <span className={styles.itemMain}>
                  <strong>{item.title}</strong>
                  <small>{item.recipientEmail || "Link only"} · {item.status === "open" ? "open until " + date(item.expiresAt) : "closed"}</small>
                </span>
                <span className={styles.pill + " " + (received ? styles.pillGood : item.status === "open" ? styles.pillWait : styles.pillMuted)}>
                  {received ? received + (received === 1 ? " file received" : " files received") : item.status === "open" ? "Waiting" : "Closed"}
                </span>
              </div>
              {item.status === "open" ? (
                <div className={styles.result}>
                  <input readOnly value={item.link} onFocus={(e) => e.currentTarget.select()} />
                  <button type="button" onClick={() => void copy(item.link)}>{copied === item.link ? "Copied ✓" : "Copy"}</button>
                </div>
              ) : null}
              {item.uploads.length ? (
                <ul className={styles.uploads}>
                  {item.uploads.map((upload) => (
                    <li key={upload.id}>
                      <span><strong>{upload.uploaderName}</strong>{upload.uploaderEmail ? " · " + upload.uploaderEmail : ""}<small>{upload.fileCount} files · {bytes(upload.totalBytes)} · {date(upload.createdAt)}</small></span>
                      <a href={storageLink(upload.folderPath)}>Open in Storage</a>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className={styles.requestActions}>
                <a href={storageLink(item.folderPath)}>Folder in Storage</a>
                {item.status === "open" && item.recipientEmail ? <button type="button" disabled={busy} onClick={() => void act(item.id, "resend")}>Email again</button> : null}
                {item.status === "open"
                  ? <button type="button" disabled={busy} onClick={() => void act(item.id, "close")}>Close link</button>
                  : <button type="button" disabled={busy} onClick={() => void act(item.id, "reopen")}>Reopen for 14 days</button>}
                <button type="button" disabled={busy} className={styles.dangerText} onClick={() => void act(item.id, "delete")}>Delete</button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
