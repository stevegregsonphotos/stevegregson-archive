"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { TransferRecord } from "@/lib/transfers/types";
import styles from "./transfers.module.css";
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
        const uploadedIds = await uploadFilesToTransfer(transferId, queue, (p) => setProgress(describeProgress(p)));
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
    }
  }

  return (
    <main className={styles.page}>
      <section
        className={styles.send + " " + styles.dropZone + (dragging ? " " + styles.dropActive : "")}
        data-drop-label="Drop files or folders to add them"
        {...dropProps}
      >
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

        <p className={styles.dropHint}>or drag files and folders anywhere here</p>

        {(archiveSelection.objectKeys.length > 0 || archiveSelection.folderPaths.length > 0) && (
          <div className={styles.queue}>
            <span>From Storage: {archiveSelection.objectKeys.length} files · {archiveSelection.folderPaths.length} folders</span>
            <button type="button" onClick={() => { setArchiveSelection(EMPTY_SELECTION); clearArchiveSelection(); }}>Clear</button>
          </div>
        )}

        {queue.length > 0 && (
          <div className={styles.queue}>
            <span>{queue.length} {queue.length === 1 ? "file" : "files"}</span>
            <span>{bytes(totalBytes)}</span>
            <button type="button" onClick={clearQueue}>Clear</button>
          </div>
        )}

        {pickable.length > 0 && (
          <div className={styles.sendBackgrounds}>
            <p>Client page background</p>
            <small>
              {backgroundPicks.length
                ? "Your client will see the picked photograph" + (backgroundPicks.length === 1 ? "" : "s") + " full-screen, in this order."
                : <>Tap photographs to show them full-screen on the client&rsquo;s page, or leave as is to use your <Link href="/admin/transfers/backgrounds">default backgrounds</Link>.</>}
            </small>
            <div className={styles.sendPickGrid}>
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
            <div className={styles.sendDefault}>
              <span>{backgroundPicks.length ? backgroundPicks.length + " of up to " + MAX_BACKGROUNDS + " picked" : "Using your default backgrounds"}</span>
              {backgroundPicks.length ? <button type="button" onClick={() => setBackgroundPicks([])}>Use defaults</button> : null}
            </div>
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

        <button className={styles.transferButton} type="button" disabled={sending || (!queue.length && !archiveSelection.objectKeys.length && !archiveSelection.folderPaths.length) || !recipient.trim() || !title.trim()} onClick={send}>
          {sending ? "Transferring…" : "Transfer"}
        </button>
        {progress && <p className={styles.progress} aria-live="polite">{progress}</p>}
        {resultUrl && <div className={styles.result}><input readOnly value={resultUrl} /><button type="button" onClick={() => navigator.clipboard.writeText(resultUrl).catch(() => {})}>Copy link</button><a className={styles.resultOpen} href={resultUrl} target="_blank" rel="noopener">Open ↗</a></div>}
      </section>

      <section className={styles.history}>
        <div className={styles.historyHead}>
          <div><p>Steve Gregson</p><h2>Transfers</h2></div>
          <div className={styles.historyLinks}>
            <Link href="/admin/transfers/backgrounds">Client page backgrounds</Link>
            <a href="/transfer/preview" target="_blank" rel="noopener">Preview client page ↗</a>
            <span>{transfers.length} sent</span>
          </div>
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
                  <p>Sent {date(transfer.finalizedAt || transfer.createdAt)} · {bytes(transfer.totalSizeBytes)} ({transfer.fileCount} files) · <strong>{transfer.filesPurgedAt ? "Expired · files cleared" : downloaded ? "Downloaded " + date(transfer.downloads[0].createdAt) : transfer.status === "expired" ? "Expired" : transfer.status === "disabled" ? "Disabled" : "Not downloaded"}</strong></p>
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
