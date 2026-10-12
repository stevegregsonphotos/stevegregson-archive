"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./shares.module.css";
import { describeEmail, shareApi, type AdminShare, type EmailResult } from "./share-api";

/** "Share with client" for one Storage folder. */
export default function ShareDialog({ path, name, onClose, onShared }: {
  path: string; name: string; onClose: () => void; onShared: () => void;
}) {
  const [existing, setExisting] = useState<AdminShare[] | null>(null);
  const [title, setTitle] = useState(name);
  const [emails, setEmails] = useState("");
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [created, setCreated] = useState<AdminShare | null>(null);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let cancelled = false;
    shareApi<{ shares: AdminShare[] }>({ action: "share-list" })
      .then((data) => { if (!cancelled) setExisting(data.shares.filter((share) => share.path === path)); })
      .catch(() => { if (!cancelled) setExisting([]); });
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { cancelled = true; window.removeEventListener("keydown", onKey); };
  }, [path, onClose]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const data = await shareApi<{ share: AdminShare; email: EmailResult }>({
        action: "share-create", path, title, emails, message, password, sendEmail,
      });
      setCreated(data.share);
      setStatus("Shared." + describeEmail(data.email));
      onShared();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Couldn't share this folder.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(link);
    } catch {
      setStatus("Couldn't copy automatically — select the link and copy it.");
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-label={"Share " + name} onClick={(event) => event.stopPropagation()}>
        <div className={styles.dialogHead}>
          <div>
            <p className={styles.kicker}>Share with a client</p>
            <h2>{name}</h2>
            <p className={styles.sub}>They&rsquo;ll be able to open this folder and everything in it, including anything you add later, and download single files or whole folders. Nothing else in Storage is visible.</p>
          </div>
          <button type="button" className={styles.x} aria-label="Close" onClick={onClose}>×</button>
        </div>

        {existing && existing.length && !created ? (
          <div className={styles.already}>
            <strong>Already shared</strong>
            {existing.map((share) => (
              <div key={share.id} className={styles.alreadyRow}>
                <span>{share.title}<small>{share.recipients.join(", ") || "Link only"}</small></span>
                <button type="button" onClick={() => void copy(share.link)}>{copied === share.link ? "Copied ✓" : "Copy link"}</button>
              </div>
            ))}
            <Link href="/admin/storage/shared">Manage people and see activity →</Link>
          </div>
        ) : null}

        {created ? (
          <div className={styles.done}>
            <p>{status}</p>
            <div className={styles.linkBox}>
              <input readOnly value={created.link} onFocus={(event) => event.currentTarget.select()} />
              <button type="button" onClick={() => void copy(created.link)}>{copied === created.link ? "Copied ✓" : "Copy"}</button>
            </div>
            <p className={styles.hint}>Emailed links are personal to each person, so you can see who downloaded what. This copied link shows as &ldquo;Copied link&rdquo;.</p>
            <div className={styles.actions}>
              <Link href="/admin/storage/shared" className={styles.secondary}>See shared folders</Link>
              <button type="button" className={styles.primary} onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <form className={styles.form} onSubmit={create}>
            <label>
              <span>Name shown to the client</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} required />
            </label>
            <label>
              <span>Email addresses <em>(optional — separate with commas)</em></span>
              <textarea rows={2} value={emails} onChange={(event) => setEmails(event.target.value)} placeholder="press@mountview.org.uk, marketing@mountview.org.uk" />
            </label>
            <label>
              <span>Message <em>(optional)</em></span>
              <textarea rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Here's your folder of production photographs. New shows will appear here as I add them." />
            </label>
            <label>
              <span>Password <em>(optional)</em></span>
              <input type="text" autoComplete="off" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="No password" />
            </label>
            <label className={styles.check}>
              <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} />
              <span>Email them the link</span>
            </label>
            {status ? <p className={styles.status}>{status}</p> : null}
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} onClick={onClose}>Cancel</button>
              <button type="submit" className={styles.primary} disabled={busy || !title.trim()}>{busy ? "Sharing…" : "Share folder"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
