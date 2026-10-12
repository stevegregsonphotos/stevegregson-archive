"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { TransferRecord } from "@/lib/transfers/types";
import styles from "./workspace.module.css";
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
import { canMakeBackdrop, uploadTransferBackdrop } from "@/lib/transfers/backdrop-client";
import { MAX_BACKGROUNDS } from "@/lib/transfers/backgrounds";

/** How many of the queued photos are offered as background choices. */
const PICKABLE_LIMIT = 60;

const ARCHIVE_SELECTION_KEY = "backstage-transfer-archive-selection";
const EMPTY_SELECTION = { objectKeys: [] as string[], folderPaths: [] as string[] };

function readArchiveSelection() {
  if (typeof window === "undefined") return EMPTY_SELECTION;
  try {
    const raw = sessionStorage.getItem(ARCHIVE_SELECTION_KEY);
    if (!raw) return EMPTY_SELECTION;
    const parsed = JSON.parse(raw) as { objectKeys?: unknown; folderPaths?: unknown };
    return {
      objectKeys: Array.isArray(parsed.objectKeys) ? parsed.objectKeys.filter((v): v is string => typeof v === "string") : [],
      folderPaths: Array.isArray(parsed.folderPaths) ? parsed.folderPaths.filter((v): v is string => typeof v === "string") : [],
    };
  } catch {
    return EMPTY_SELECTION;
  }
}

function clearArchiveSelection() {
  try { sessionStorage.removeItem(ARCHIVE_SELECTION_KEY); } catch { /* ignore */ }
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

function daysUntil(value: string) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
}

export default function TransferWorkspace({ initialTransfers }: { initialTransfers: TransferRecord[] }) {
  const [transfers, setTransfers] = useState(initialTransfers);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [archiveSelection, setArchiveSelection] = useState<{ objectKeys: string[]; folderPaths: string[] }>(EMPTY_SELECTION);
  const [recipient, setRecipient] = useState("");
  const [senderEmail, setSenderEmail] = useState("info@stevegregson.com");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [expiryDays, setExpiryDays] = useState("60");
  const [password, setPassword] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState("");
  // While sending, the gold Transfer button fills up and shows the status.
  const [percent, setPercent] = useState<number | null>(null);
  const [resultUrl, setResultUrl] = useState("");
  // Queue positions of photos picked as client-page backgrounds (in pick order).
  const [backgroundPicks, setBackgroundPicks] = useState<number[]>([]);
  const folderRef = useRef<HTMLInputElement | null>(null);
  const { dragging, dropProps } = useFileDrop((files) => setQueue((q) => [...q, ...files]), !sending);

  // The Storage screen hands over its selection via sessionStorage; read it
  // once the page is in the browser.
  useEffect(() => {
    const selection = readArchiveSelection();
    if (!selection.objectKeys.length && !selection.folderPaths.length) return;
    const timer = window.setTimeout(() => setArchiveSelection(selection), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transfers;
    return transfers.filter((transfer) =>
      [transfer.title, ...transfer.recipients.map((r) => r.email), ...transfer.files.map((f) => f.relativePath)]
        .some((value) => value.toLowerCase().includes(q)),
    );
  }, [search, transfers]);

  const totalBytes = queue.reduce((sum, item) => sum + item.file.size, 0);

  // Small on-screen previews of the queued photos, so one can be picked as the background.
  const pickable = useMemo(
    () => queue
      .map((item, index) => ({ index, item }))
      .filter(({ item }) => canMakeBackdrop(item.file))
      .slice(0, PICKABLE_LIMIT)
      .map(({ index, item }) => ({ index, name: item.relativePath, url: URL.createObjectURL(item.file) })),
    [queue],
  );
  useEffect(() => () => pickable.forEach((p) => URL.revokeObjectURL(p.url)), [pickable]);

  function togglePick(index: number) {
    setBackgroundPicks((current) => current.includes(index)
      ? current.filter((i) => i !== index)
      : current.length >= MAX_BACKGROUNDS ? current : [...current, index]);
  }

  function clearQueue() {
    setQueue([]);
    setBackgroundPicks([]);
  }

  async function refresh() {
    try {
      const response = await fetch("/api/admin/transfers", { cache: "no-store" });
      const data = await response.json();
      if (data.ok) setTransfers(data.transfers);
    } catch {
      // The list will catch up on the next page load.
    }
  }

  async function send() {
    if ((!queue.length && !archiveSelection.objectKeys.length && !archiveSelection.folderPaths.length) || !recipient.trim() || !title.trim()) return;
    const tooBig = oversizedFiles(queue);
    if (tooBig.length) {
      setProgress("These files are over 5 GB and can't be sent in one piece yet: " + tooBig.slice(0, 3).join(", ") + (tooBig.length > 3 ? " and " + (tooBig.length - 3) + " more" : "") + ".");
      return;
    }
    setSending(true);
    setResultUrl("");
    const stopWarning = warnBeforeLeaving();
    let transferId = "";
    try {
      setProgress("Creating transfer…");
      const created = await postTransferAction<{ transfer: TransferRecord }>({
        action: "create", title, message, senderEmail,
        recipientEmails: recipient.split(/[,\n;]/).map((v) => v.trim()).filter(Boolean),
        expiryDays: Number(expiryDays), password,
      });
      transferId = created.transfer.id;

      if (archiveSelection.objectKeys.length || archiveSelection.folderPaths.length) {
        setProgress("Attaching files from Storage…");
        await postTransferAction({
          action: "attach-archive", transferId,
          objectKeys: archiveSelection.objectKeys,
          folderPaths: archiveSelection.folderPaths,
        });
      }

      if (queue.length) {
        const uploadedIds = await uploadFilesToTransfer(transferId, queue, (p) => {
          setPercent(p.totalBytes ? Math.floor((p.sentBytes / p.totalBytes) * 100) : 0);
          setProgress(describeProgress(p));
        });
        const picks = backgroundPicks.filter((index) => uploadedIds[index]);
        if (picks.length) {
          await postTransferAction({ action: "set-backgrounds", transferId, fileIds: picks.map((index) => uploadedIds[index]) });
          // Light, web-sized copies so the client page opens quickly. Not fatal if one fails.
          for (let i = 0; i < picks.length; i += 1) {
            setProgress("Preparing the client page background " + (i + 1) + " of " + picks.length + "…");
            await uploadTransferBackdrop(transferId, uploadedIds[picks[i]], queue[picks[i]].file).catch(() => {});
          }
        }
      }

      setProgress("Finishing transfer…");
      const finish = await postTransferAction<{
        publicUrl: string;
        email?: { sent: number; failed: string[]; previewSuppressed: boolean };
      }>({ action: "finalize", transferId });
      transferId = "";
      setResultUrl(finish.publicUrl);
      clearQueue(); setArchiveSelection(EMPTY_SELECTION); clearArchiveSelection(); setTitle(""); setMessage(""); setPassword("");
      if (finish.email?.previewSuppressed) setProgress("Ready · emails aren't sent from previews, so copy the link below.");
      else if (finish.email?.failed.length) setProgress("Transfer is live, but the email to " + finish.email.failed.join(", ") + " didn't send. Copy the link below and send it yourself.");
      else setProgress("Sent");
      await refresh();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Transfer failed.";
      if (transferId) {
        // Tidy up the half-finished transfer so nothing is left behind.
        await postTransferAction({ action: "abort", transferId }).catch(() => {});
        setProgress(reason + " Nothing was sent; your files are still selected, so you can press Transfer to try again.");
      } else {
        setProgress(reason);
      }
    } finally {
      stopWarning();
      setSending(false);
      setPercent(null);
    }
  }

  const hasFiles = queue.length > 0 || archiveSelection.objectKeys.length > 0 || archiveSelection.folderPaths.length > 0;
  const ready = hasFiles && recipient.trim() && title.trim();

  return (
    <main className={styles.page}>
      <section className={styles.sendColumn}>
        <div
          className={styles.card + (dragging ? " " + styles.cardDragging : "")}
          {...dropProps}
        >
          <div className={styles.cardBody}>
            <h1 className={styles.cardTitle}>Send files</h1>

            <div className={styles.dropArea}>
              <span className={styles.dropIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15" /></svg>
              </span>
              <strong>{dragging ? "Drop to add" : hasFiles ? "Add more" : "Drag files or folders here"}</strong>
              <span className={styles.dropLinks}>
                <label>
                  <input type="file" multiple onChange={(e) => setQueue((q) => [...q, ...inputFiles(e.target.files)])} />
                  Browse files
                </label>
                <span aria-hidden="true">·</span>
                <button type="button" onClick={() => folderRef.current?.click()}>Browse folders</button>
              </span>
              <input
                ref={folderRef}
                className={styles.hidden}
                type="file"
                multiple
                {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
                onChange={(e) => setQueue((q) => [...q, ...inputFiles(e.target.files)])}
              />
            </div>

            {(archiveSelection.objectKeys.length > 0 || archiveSelection.folderPaths.length > 0) && (
              <div className={styles.chip}>
                <span><strong>From Storage</strong> {archiveSelection.objectKeys.length} files · {archiveSelection.folderPaths.length} folders</span>
                <button type="button" onClick={() => { setArchiveSelection(EMPTY_SELECTION); clearArchiveSelection(); }}>Remove</button>
              </div>
            )}

            {queue.length > 0 && (
              <div className={styles.chip}>
                <span><strong>{queue.length} {queue.length === 1 ? "file" : "files"}</strong> {bytes(totalBytes)}</span>
                <button type="button" onClick={clearQueue} disabled={sending}>Remove all</button>
              </div>
            )}

            {pickable.length > 0 && (
              <details className={styles.backgrounds} open={backgroundPicks.length > 0 || undefined}>
                <summary>
                  <span>Client page photos</span>
                  <small>{backgroundPicks.length ? backgroundPicks.length + " of up to " + MAX_BACKGROUNDS + " picked" : "Using your defaults"}</small>
                </summary>
                <p>
                  {backgroundPicks.length
                    ? "Shown full-screen on your client’s page, in this order."
                    : <>Tap photos to show them full-screen on your client&rsquo;s page, or keep your <Link href="/admin/transfers/backgrounds">default backgrounds</Link>.</>}
                </p>
                <div className={styles.pickGrid}>
                  {pickable.map((photo) => {
                    const position = backgroundPicks.indexOf(photo.index);
                    return (
                      <button type="button" key={photo.index} aria-pressed={position >= 0} title={photo.name} onClick={() => togglePick(photo.index)} disabled={sending}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt="" loading="lazy" decoding="async" />
                        {position >= 0 ? <em>{position + 1}</em> : null}
                      </button>
                    );
                  })}
                </div>
                {backgroundPicks.length ? <button type="button" className={styles.linkButton} onClick={() => setBackgroundPicks([])}>Use defaults instead</button> : null}
              </details>
            )}

            <div className={styles.fields}>
              <label className={styles.field}><span>Email to</span><input inputMode="email" autoComplete="off" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="client@example.com" /></label>
              <label className={styles.field}><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Steel Pier — press photos" /></label>
              <label className={styles.field}><span>Message <em>optional</em></span><textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
              <div className={styles.row2}>
                <label className={styles.field}><span>Expires after</span><select value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)}><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></label>
                <label className={styles.field}><span>Password <em>optional</em></span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="None" /></label>
              </div>
              <label className={styles.field}><span>Your email</span><input value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} /></label>
            </div>
          </div>

          <div className={styles.dock}>
            <button
              className={styles.sendButton + (sending ? " " + styles.sending : "")}
              type="button"
              style={sending && percent !== null ? ({ "--fill": percent + "%" } as React.CSSProperties) : undefined}
              disabled={sending || !ready}
              onClick={send}
              aria-live="polite"
            >
              {sending ? <span>{progress || "Transferring…"}</span> : "Transfer"}
            </button>
            {!sending && !ready && !progress ? <p className={styles.hint}>{!hasFiles ? "Add files to send." : !recipient.trim() ? "Add an email address." : "Add a title."}</p> : null}
            {progress && !sending && <p className={styles.status} aria-live="polite">{progress}</p>}
            {resultUrl && (
              <div className={styles.result}>
                <input readOnly value={resultUrl} onFocus={(e) => e.currentTarget.select()} />
                <button type="button" onClick={() => navigator.clipboard.writeText(resultUrl).catch(() => {})}>Copy</button>
                <a href={resultUrl} target="_blank" rel="noopener">Open ↗</a>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.history}>
        <header className={styles.historyHead}>
          <div>
            <h2>Transfers</h2>
            <p>{transfers.length} sent</p>
          </div>
          <nav className={styles.historyLinks}>
            <Link href="/admin/transfers/backgrounds">Client page backgrounds</Link>
            <a href="/transfer/preview" target="_blank" rel="noopener">Preview client page ↗</a>
          </nav>
        </header>

        <label className={styles.search}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title, file name or email" />
        </label>

        <div className={styles.list}>
          {filtered.map((transfer) => {
            const downloaded = transfer.downloads.length > 0;
            const daysLeft = daysUntil(transfer.expiresAt);
            const state = transfer.filesPurgedAt ? { label: "Files cleared", tone: styles.pillMuted }
              : transfer.status === "expired" ? { label: "Expired", tone: styles.pillMuted }
              : transfer.status === "disabled" ? { label: "Disabled", tone: styles.pillMuted }
              : downloaded ? { label: "Downloaded", tone: styles.pillGood }
              : { label: "Not downloaded yet", tone: styles.pillWait };
            return (
              <Link href={"/admin/transfers/" + transfer.id} className={styles.item} key={transfer.id}>
                <span className={styles.itemIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5z" /><path d="M4 7.5 12 11l8-3.5M12 11v9" /></svg>
                </span>
                <span className={styles.itemMain}>
                  <strong>{transfer.title}</strong>
                  <small>{transfer.recipients.map((r) => r.email).join(", ") || "Link only"}</small>
                </span>
                <span className={styles.itemMeta}>
                  <span className={styles.pill + " " + state.tone}>{state.label}</span>
                  <small>
                    {transfer.fileCount} {transfer.fileCount === 1 ? "file" : "files"} · {bytes(transfer.totalSizeBytes)} · {date(transfer.finalizedAt || transfer.createdAt)}
                    {transfer.status === "active" && daysLeft > 0 ? " · expires in " + daysLeft + (daysLeft === 1 ? " day" : " days") : ""}
                  </small>
                </span>
                <span className={styles.chevron} aria-hidden="true">›</span>
              </Link>
            );
          })}
          {!filtered.length && <p className={styles.empty}>{transfers.length ? "No transfers match your search." : "Nothing sent yet."}</p>}
        </div>
      </section>
    </main>
  );
}
