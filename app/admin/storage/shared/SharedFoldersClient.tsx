"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import styles from "../shares.module.css";
import { describeEmail, shareApi, when, type AdminShare, type AdminShareEvent, type EmailResult } from "../share-api";
import { FolderIcon } from "../StorageIcons";

function describe(event: AdminShareEvent, title: string) {
  if (event.eventType === "open") return "Opened the folder";
  if (event.eventType === "folder") {
    return "Downloaded " + (event.path ? "“" + event.path + "”" : "everything in " + title) + (event.fileCount !== undefined ? " (" + event.fileCount + " files)" : "");
  }
  return "Downloaded " + event.path;
}

function ShareCard({ share, onChange }: { share: AdminShare; onChange: () => Promise<void> }) {
  const [events, setEvents] = useState<AdminShareEvent[] | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);

  const loadEvents = useCallback(async () => {
    const data = await shareApi<{ events: AdminShareEvent[] }>({ action: "share-events", id: share.id });
    setEvents(data.events);
  }, [share.id]);

  async function run(work: () => Promise<string>) {
    setBusy(true);
    setStatus("");
    try {
      setStatus(await work());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActivity() {
    const next = !showActivity;
    setShowActivity(next);
    if (next) await run(async () => { await loadEvents(); return ""; });
  }

  const addPeople = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const data = await shareApi<{ email: EmailResult }>({ action: "share-update", id: share.id, addEmails: adding });
      setAdding("");
      await onChange();
      return "Added." + describeEmail(data.email);
    });
  };

  const resend = (email: string) => run(async () => {
    const data = await shareApi<{ email: EmailResult }>({ action: "share-resend", id: share.id, email });
    return describeEmail(data.email).trim() || "Sent.";
  });

  const remove = (email: string) => {
    if (!window.confirm("Remove " + email + "? Their personal link will stop being credited to them, but anyone with the folder link can still open it. To lock everyone out, use Stop sharing.")) return;
    void run(async () => {
      await shareApi({ action: "share-update", id: share.id, removeEmail: email });
      await onChange();
      return "Removed " + email + ".";
    });
  };

  const password = () => {
    const value = window.prompt(share.hasPassword ? "New password (leave empty to remove the password):" : "Password for this folder:", "");
    if (value === null) return;
    void run(async () => {
      await shareApi({ action: "share-update", id: share.id, password: value.trim() ? value : null });
      await onChange();
      return value.trim() ? "Password set. Let your client know it." : "Password removed.";
    });
  };

  const stop = () => {
    if (!window.confirm("Stop sharing “" + share.title + "”? The link stops working straight away for everyone. Nothing in Storage is deleted.")) return;
    void run(async () => {
      await shareApi({ action: "share-delete", id: share.id });
      await onChange();
      return "";
    });
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(share.link);
      setCopied(true);
    } catch {
      setStatus("Couldn't copy automatically — select the link and copy it.");
    }
  }

  const unavailable = share.path.startsWith(".trash/");

  return (
    <article className={styles.card}>
      <header className={styles.cardHead}>
        <FolderIcon size={40} />
        <div>
          <h2>{share.title}{share.hasPassword ? <span className={styles.badge}>Password</span> : null}{unavailable ? <span className={styles.badgeWarn}>In Deleted Files — not available</span> : null}</h2>
          <p>Storage › {unavailable ? "Deleted files" : share.path.split("/").join(" › ")} · shared {when(share.createdAt)}</p>
          <p>{share.downloads} {share.downloads === 1 ? "download" : "downloads"}{share.lastActivityAt ? " · last visited " + when(share.lastActivityAt) : " · not opened yet"}</p>
        </div>
        <div className={styles.cardActions}>
          <a className={styles.secondary} href={share.link} target="_blank" rel="noopener">Open as client ↗</a>
          <button type="button" className={styles.secondary} disabled={busy} onClick={password}>{share.hasPassword ? "Change password" : "Add password"}</button>
          <button type="button" className={styles.dangerButton} disabled={busy} onClick={stop}>Stop sharing</button>
        </div>
      </header>

      <div className={styles.linkBox}>
        <input readOnly value={share.link} onFocus={(event) => event.currentTarget.select()} />
        <button type="button" onClick={() => void copy()}>{copied ? "Copied ✓" : "Copy link"}</button>
      </div>

      <div className={styles.people}>
        <strong>People</strong>
        {share.recipients.length ? share.recipients.map((email) => (
          <span key={email} className={styles.person}>
            {email}
            <button type="button" disabled={busy} onClick={() => void resend(email)} title="Email them the link again">Resend</button>
            <button type="button" disabled={busy} onClick={() => remove(email)} aria-label={"Remove " + email}>×</button>
          </span>
        )) : <span className={styles.muted}>Nobody emailed yet — the link works for anyone you give it to.</span>}
        <form onSubmit={addPeople} className={styles.addPeople}>
          <input value={adding} onChange={(event) => setAdding(event.target.value)} placeholder="Add email addresses" aria-label="Add email addresses" />
          <button type="submit" disabled={busy || !adding.trim()}>Add &amp; email link</button>
        </form>
      </div>

      {status ? <p className={styles.status}>{status}</p> : null}

      <button type="button" className={styles.activityToggle} onClick={() => void toggleActivity()} aria-expanded={showActivity}>
        {showActivity ? "Hide activity" : "Show activity"}
      </button>
      {showActivity && events ? (
        events.length ? (
          <div className={styles.events}>
            {events.map((event) => (
              <div key={event.id} className={styles.event}>
                <span>{when(event.createdAt)}</span>
                <span className={styles.who}>{event.recipientEmail || "Copied link"}</span>
                <span>{describe(event, share.title)}</span>
              </div>
            ))}
          </div>
        ) : <p className={styles.muted}>Nothing yet.</p>
      ) : null}
    </article>
  );
}

export default function SharedFoldersClient() {
  const [shares, setShares] = useState<AdminShare[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await shareApi<{ shares: AdminShare[] }>({ action: "share-list" });
      setShares(data.shares);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Couldn't load shared folders.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <main className={styles.page}>
      <Link className={styles.back} href="/admin/storage">← Storage</Link>
      <h1>Shared with clients</h1>
      <p className={styles.intro}>
        Each shared folder has its own private link. Clients can open it, browse everything inside (including anything you add
        later) and download single photos or whole folders as one zip. To share a folder, open its <strong>…</strong> menu in
        Storage and choose <strong>Share with client</strong>.
      </p>
      {error ? <p className={styles.status}>{error}</p> : null}
      {shares === null && !error ? <p className={styles.muted}>Loading…</p> : null}
      {shares && !shares.length ? <p className={styles.muted}>No folders are shared yet.</p> : null}
      <div className={styles.cards}>
        {shares?.map((share) => <ShareCard key={share.id} share={share} onChange={load} />)}
      </div>
    </main>
  );
}
