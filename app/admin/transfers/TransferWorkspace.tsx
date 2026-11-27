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
  changedFilesMessage,
  changedSincePicked,
  postTransferAction,
  uploadFilesToTransfer,
  warnBeforeLeaving,
  type QueuedFile,
} from "@/lib/transfers/upload-client";
import { useFileDrop } from "@/lib/transfers/use-file-drop";
import { canMakeBackdrop, uploadTransferBackdrop, uploadTransferBackdropFromUrl } from "@/lib/transfers/backdrop-client";
import { MAX_BACKGROUNDS } from "@/lib/transfers/backgrounds";
import RequestsPanel from "./RequestsPanel";
import RecipientInput from "./RecipientInput";
import { macBusyFor, macBusyText } from "@/lib/mac/busy-client";
import SendProgressPanel from "./SendProgressPanel";

/** How many photos show per page when picking client page photos. */
const PICK_PAGE_SIZE = 40;

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

export default function TransferWorkspace({ initialTransfers, knownEmails: initialKnownEmails = [] }: { initialTransfers: TransferRecord[]; knownEmails?: string[] }) {
  const [transfers, setTransfers] = useState(initialTransfers);
  // Addresses sent to before, most recent first (suggested in "Email to").
  const [knownEmails, setKnownEmails] = useState(initialKnownEmails);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [archiveSelection, setArchiveSelection] = useState<{ objectKeys: string[]; folderPaths: string[] }>(EMPTY_SELECTION);
  const [recipient, setRecipient] = useState("");
  const [senderEmail, setSenderEmail] = useState("info@stevegregson.com");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [expiryDays, setExpiryDays] = useState("60");
  const [password, setPassword] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"sent" | "requests">("sent");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState("");
  // While sending, the gold Transfer button fills up and shows the status.
  const [percent, setPercent] = useState<number | null>(null);
  const [resultUrl, setResultUrl] = useState("");
  // Photos picked as client-page backgrounds, in pick order:
  // "q:<queue position>" for files from the Mac, "s:<Storage key>" for Storage files.
  const [backgroundPicks, setBackgroundPicks] = useState<string[]>([]);
  // Photos inside the Storage selection (for the picker), tagged with the
  // selection they belong to so a stale list is never shown.
  const [archiveImages, setArchiveImages] = useState<{ forSelection: string; images: { objectKey: string; name: string }[] }>({ forSelection: "", images: [] });
  // Which page of photos the picker is showing (all queued photos, in pages).
  const [pickPage, setPickPage] = useState(0);
  // Upload numbers for the strip at the top of the page.
  const [counts, setCounts] = useState<{ done: number; total: number; sent: number; size: number } | null>(null);
  // After sending, the strip stays with the outcome until closed.
  const [outcome, setOutcome] = useState<{ tone: "done" | "warn"; title: string } | null>(null);
  const [sendingTitle, setSendingTitle] = useState("");
  const [sentToText, setSentToText] = useState("");
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

  // List the photos in the Storage selection so they can be picked too.
  const selectionId = archiveSelection.objectKeys.length || archiveSelection.folderPaths.length
    ? JSON.stringify(archiveSelection) : "";
  useEffect(() => {
    if (!selectionId) return;
    let cancelled = false;
    const selection = JSON.parse(selectionId) as { objectKeys: string[]; folderPaths: string[] };
    postTransferAction<{ images: { objectKey: string; name: string }[] }>({ action: "archive-images", ...selection })
      .then((data) => { if (!cancelled) setArchiveImages({ forSelection: selectionId, images: data.images }); })
      .catch(() => { /* picker just won't show Storage photos */ });
    return () => { cancelled = true; };
  }, [selectionId]);
  const storageImages = useMemo(
    () => (selectionId && archiveImages.forSelection === selectionId ? archiveImages.images : []),
    [selectionId, archiveImages],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transfers;
    return transfers.filter((transfer) =>
      [transfer.title, ...transfer.recipients.map((r) => r.email), ...transfer.files.map((f) => f.relativePath)]
        .some((value) => value.toLowerCase().includes(q)),
    );
  }, [search, transfers]);

  const totalBytes = queue.reduce((sum, item) => sum + item.file.size, 0);

  // Every queued photo can be picked; previews are made one page at a time
  // so hundreds of photos don't all load at once.
  const pickableAll = useMemo(
    () => [
      ...queue
        .map((item, index) => ({ token: "q:" + index, name: item.relativePath, file: item.file as File | null, objectKey: "" }))
        .filter(({ file }) => file && canMakeBackdrop(file)),
      ...storageImages.map((image) => ({ token: "s:" + image.objectKey, name: image.name, file: null as File | null, objectKey: image.objectKey })),
    ],
    [queue, storageImages],
  );
  const pickPages = Math.max(1, Math.ceil(pickableAll.length / PICK_PAGE_SIZE));
  const page = Math.min(pickPage, pickPages - 1);
  const pickable = useMemo(
    () => pickableAll
      .slice(page * PICK_PAGE_SIZE, (page + 1) * PICK_PAGE_SIZE)
      .map(({ token, name, file, objectKey }) => ({
        token, name, local: Boolean(file),
        // Storage photos use their small Storage preview.
        url: file ? URL.createObjectURL(file) : "/api/admin/storage/thumb?key=" + encodeURIComponent(objectKey),
      })),
    [pickableAll, page],
  );
  useEffect(() => () => pickable.forEach((p) => { if (p.local) URL.revokeObjectURL(p.url); }), [pickable]);

  function togglePick(token: string) {
    setBackgroundPicks((current) => current.includes(token)
      ? current.filter((t) => t !== token)
      : current.length >= MAX_BACKGROUNDS ? current : [...current, token]);
  }

  function clearQueue() {
    setQueue([]);
    setBackgroundPicks((current) => current.filter((t) => !t.startsWith("q:")));
    setPickPage(0);
  }

  function removeArchiveSelection() {
    setArchiveSelection(EMPTY_SELECTION);
    clearArchiveSelection();
    setBackgroundPicks((current) => current.filter((t) => !t.startsWith("s:")));
    setPickPage(0);
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
    // Picked files that changed since (e.g. Bridge metadata edits) can't be
    // sent — say so straight away, before anything is created.
    const changed = await changedSincePicked(queue);
    if (changed.length) {
      clearQueue(); // the old picks can't be read any more; pick again
      setOutcome({ tone: "warn", title: title.trim() });
      setProgress(changedFilesMessage(changed));
      return;
    }
    // Files chosen from Storage: is the Mac still sending newer versions of them?
    if (archiveSelection.objectKeys.length || archiveSelection.folderPaths.length) {
      const paths = [
        ...archiveSelection.folderPaths,
        // Storage keys are "<storage area>/<path>".
        ...archiveSelection.objectKeys.map((key) => key.split("/").slice(1).join("/")),
      ];
      const busy = await macBusyFor(paths, 0);
      if (busy && !window.confirm(macBusyText(busy) + "\n\nSend anyway?")) return;
    }
    const sentTo = recipient.split(/[,\n;]/).map((v) => v.trim()).filter(Boolean);
    // Suggest these next time too (the server keeps them as well).
    setKnownEmails((known) => {
      const fresh = sentTo.map((email) => email.toLowerCase());
      return [...fresh, ...known.filter((email) => !fresh.includes(email))];
    });
    setSending(true);
    setResultUrl("");
    setOutcome(null);
    setCounts(null);
    const sendTitle = title.trim();
    setSendingTitle(sendTitle);
    setSentToText(sentTo.join(", "));
    const stopWarning = warnBeforeLeaving();
    let transferId = "";
    try {
      setProgress("Creating transfer…");
      const created = await postTransferAction<{ transfer: TransferRecord }>({
        action: "create", title, message, senderEmail,
        recipientEmails: sentTo,
        expiryDays: Number(expiryDays), password,
      });
      transferId = created.transfer.id;

      // Storage key → this transfer's file id, for photos picked from Storage.
      const archiveIds = new Map<string, string>();
      if (archiveSelection.objectKeys.length || archiveSelection.folderPaths.length) {
        setProgress("Attaching files from Storage…");
        const attached = await postTransferAction<{ transfer?: TransferRecord | null }>({
          action: "attach-archive", transferId,
          objectKeys: archiveSelection.objectKeys,
          folderPaths: archiveSelection.folderPaths,
        });
        for (const file of attached.transfer?.files ?? []) {
          if (file.source === "archive") archiveIds.set(file.objectKey, file.id);
        }
      }

      let uploadedIds: string[] = [];
      if (queue.length) {
        uploadedIds = await uploadFilesToTransfer(transferId, queue, (p) => {
          setPercent(p.totalBytes ? Math.floor((p.sentBytes / p.totalBytes) * 100) : 0);
          setCounts({ done: p.doneFiles, total: p.totalFiles, sent: p.sentBytes, size: p.totalBytes });
          setProgress(describeProgress(p));
        });
      }

      // Client page backgrounds, from the Mac and/or Storage, in pick order.
      const picks = backgroundPicks
        .map((token) => token.startsWith("q:")
          ? { fileId: uploadedIds[Number(token.slice(2))], file: queue[Number(token.slice(2))]?.file ?? null }
          : { fileId: archiveIds.get(token.slice(2)), file: null })
        .filter((pick): pick is { fileId: string; file: File | null } => Boolean(pick.fileId));
      if (picks.length) {
        await postTransferAction({ action: "set-backgrounds", transferId, fileIds: picks.map((pick) => pick.fileId) });
        // Light, web-sized copies so the client page opens quickly. Not fatal if
        // one fails (the client page then uses the original photo).
        for (let i = 0; i < picks.length; i += 1) {
          setProgress("Preparing the client page background " + (i + 1) + " of " + picks.length + "…");
          const { fileId, file } = picks[i];
          if (file) {
            await uploadTransferBackdrop(transferId, fileId, file).catch(() => {});
          } else {
            await postTransferAction<{ url: string }>({ action: "backdrop-source", transferId, fileId })
              .then(({ url }) => uploadTransferBackdropFromUrl(transferId, fileId, url))
              .catch(() => {});
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
      clearQueue(); removeArchiveSelection(); setBackgroundPicks([]); setTitle(""); setMessage(""); setPassword("");
      setOutcome({ tone: finish.email?.failed.length ? "warn" : "done", title: sendTitle });
      if (finish.email?.previewSuppressed) setProgress("Ready · emails aren't sent from previews, so copy the link below.");
      else if (finish.email?.failed.length) setProgress("Transfer is live, but the email to " + finish.email.failed.join(", ") + " didn't send. Copy the link below and send it yourself.");
      else setProgress("Sent");
      await refresh();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Transfer failed.";
      setOutcome({ tone: "warn", title: sendTitle });
      if (transferId) {
        // Tidy up the half-finished transfer so nothing is left behind.
        await postTransferAction({ action: "abort", transferId }).catch(() => {});
        setProgress(/changed on your Mac/.test(reason) ? reason : reason + " Nothing was sent; your files are still selected, so you can press Transfer to try again.");
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
  const showStrip = sending || outcome !== null;
  const firstShown = page * PICK_PAGE_SIZE + 1;
  const lastShown = Math.min((page + 1) * PICK_PAGE_SIZE, pickableAll.length);
  // While sending and after, the card shows a big progress ring instead of the form.
  const panelState = sending ? "sending" : outcome ? (outcome.tone === "warn" ? "warn" : "done") : null;
  const panelHeadline = sending
    ? counts && counts.total
      ? "Uploading " + Math.min(counts.done + 1, counts.total).toLocaleString("en-GB") + " of " + counts.total.toLocaleString("en-GB") + (counts.total === 1 ? " file" : " files")
      : "Sending…"
    : outcome?.tone === "warn" ? "Transfer needs attention" : "Transfer sent";
  const panelDetail = sending
    ? counts && counts.done < counts.total ? bytes(counts.sent) + " of " + bytes(counts.size) : progress
    : progress === "Sent" ? "" : progress;
  function backToForm() {
    setOutcome(null);
    setProgress("");
    setResultUrl("");
  }

  return (
    <main className={styles.page + (showStrip ? " " + styles.withStrip : "")}>
      {showStrip ? (
        <div
          className={styles.strip + " " + (sending ? styles.stripBusy : outcome?.tone === "warn" ? styles.stripWarn : styles.stripDone)}
          role="status"
          aria-live="polite"
        >
          <div className={styles.stripText}>
            <strong>
              {sending
                ? counts
                  ? "Uploading " + Math.min(counts.done + 1, counts.total).toLocaleString("en-GB") + " of " + counts.total.toLocaleString("en-GB") + (counts.total === 1 ? " file" : " files")
                  : "Sending…"
                : outcome?.tone === "warn" ? "Transfer needs attention" : "Transfer sent"}
              {sendingTitle ? <span className={styles.stripTitle}> · {sendingTitle}</span> : null}
            </strong>
            <span>
              {sending
                ? counts && counts.done < counts.total
                  ? bytes(counts.sent) + " of " + bytes(counts.size) + " · keep this tab open until it finishes"
                  : progress || "Keep this tab open until it finishes"
                : progress === "Sent" && sentToText ? "Emailed to " + sentToText : progress}
            </span>
          </div>
          {sending ? (
            <span className={styles.stripPercent}>{percent ?? 0}%</span>
          ) : (
            <span className={styles.stripActions}>
              {resultUrl ? <a href={resultUrl} target="_blank" rel="noopener">Open ↗</a> : null}
              <button type="button" onClick={backToForm} aria-label="Close">×</button>
            </span>
          )}
          {sending ? (
            <div className={styles.stripBar} role="progressbar" aria-valuenow={percent ?? 0} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: Math.max(2, percent ?? 0) + "%" }} />
            </div>
          ) : null}
        </div>
      ) : null}
      <section className={styles.sendColumn}>
        <div
          className={styles.card + (dragging ? " " + styles.cardDragging : "")}
          {...dropProps}
        >
          {panelState ? (
            <div className={styles.cardBody}>
              <SendProgressPanel
                state={panelState}
                percent={sending ? percent : 100}
                headline={panelHeadline}
                detail={panelDetail}
                title={sendingTitle}
                recipients={sentToText}
                resultUrl={resultUrl}
                onReset={backToForm}
              />
            </div>
          ) : (<>
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
                <button type="button" onClick={removeArchiveSelection}>Remove</button>
              </div>
            )}

            {queue.length > 0 && (
              <div className={styles.chip}>
                <span><strong>{queue.length} {queue.length === 1 ? "file" : "files"}</strong> {bytes(totalBytes)}</span>
                <button type="button" onClick={clearQueue} disabled={sending}>Remove all</button>
              </div>
            )}

            {pickableAll.length > 0 && (
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
                    const position = backgroundPicks.indexOf(photo.token);
                    return (
                      <button type="button" key={photo.token} aria-pressed={position >= 0} title={photo.name} onClick={() => togglePick(photo.token)} disabled={sending}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt="" loading="lazy" decoding="async" />
                        {position >= 0 ? <em>{position + 1}</em> : null}
                      </button>
                    );
                  })}
                </div>
                {pickPages > 1 ? (
                  <div className={styles.pager}>
                    <button type="button" onClick={() => setPickPage(page - 1)} disabled={page === 0}>‹ Previous</button>
                    <span>{firstShown.toLocaleString("en-GB")}–{lastShown.toLocaleString("en-GB")} of {pickableAll.length.toLocaleString("en-GB")} · page {page + 1} of {pickPages}</span>
                    <button type="button" onClick={() => setPickPage(page + 1)} disabled={page >= pickPages - 1}>Next ›</button>
                  </div>
                ) : null}
                {backgroundPicks.length ? <button type="button" className={styles.linkButton} onClick={() => setBackgroundPicks([])}>Use defaults instead</button> : null}
              </details>
            )}

            <div className={styles.fields}>
              <label className={styles.field}><span>Email to</span><RecipientInput value={recipient} onChange={setRecipient} knownEmails={knownEmails} /></label>
              <label className={styles.field}><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Steel Pier — press photos" /></label>
              <label className={styles.field}><span>Message <em>optional</em></span><textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
              <div className={styles.row2}>
                <label className={styles.field}><span>Expires after</span><select value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)}><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></label>
                <label className={styles.field}><span>Password <em>optional</em></span>{/* Not type="password": a password box makes Safari/Chrome treat this form as a
                    login and pop up saved-password suggestions on the email boxes. Dots via CSS. */}
                <input type="text" className={password ? styles.masked : undefined} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} data-1p-ignore="" data-lpignore="true" data-form-type="other" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="None" /></label>
              </div>
              <label className={styles.field}><span>Your email</span><input autoComplete="off" data-1p-ignore="" data-lpignore="true" data-form-type="other" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} /></label>
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
          </>)}
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

        <div className={styles.tabs} role="tablist">
          <button type="button" role="tab" aria-selected={tab === "sent"} onClick={() => setTab("sent")}>Sent</button>
          <button type="button" role="tab" aria-selected={tab === "requests"} onClick={() => setTab("requests")}>Requests</button>
        </div>

        {tab === "requests" ? <RequestsPanel /> : (<>
        <label className={styles.search}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title, file name or email" />
        </label>

        <div className={styles.list}>
          {filtered.map((transfer) => {
            const downloaded = transfer.downloads.length > 0;
            const daysLeft = daysUntil(transfer.expiresAt);
            const state = transfer.status === "disabled" ? { label: transfer.filesPurgedAt ? "Cancelled · files deleted" : "Cancelled", tone: styles.pillMuted }
              : transfer.filesPurgedAt ? { label: "Files cleared", tone: styles.pillMuted }
              : transfer.status === "expired" ? { label: "Expired", tone: styles.pillMuted }
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
        </>)}
      </section>
    </main>
  );
}
