"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * Sidebar card: full-size downloads. Steve picks his original JPEGs (a
 * folder or files); they're matched to the gallery's photos by file name
 * and uploaded untouched, so visitors' downloads are the full-size JPEG
 * rather than the smaller proof. "Remove" deletes them all again (they're
 * the big files) — downloads then fall back to the proofs.
 */

const BATCH = 24;
const AT_ONCE = 4;

type ImageRow = { webFilename: string; originalFilename: string; hasOriginal: boolean };
type Phase = "checking" | "idle" | "working" | "removing" | "error";

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/admin/proofing/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string } & T;
  if (!response.ok || !data.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

const baseName = (name: string) => name.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "").trim().toLowerCase();

function bytes(value: number) {
  if (value >= 1024 ** 3) return (value / 1024 ** 3).toFixed(2) + " GB";
  return Math.round(value / 1024 ** 2) + " MB";
}

export default function ProofingOriginals({ galleryId, imageCount }: { galleryId: string; imageCount: number }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [rows, setRows] = useState<ImageRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0, sent: 0, size: 0 });
  const [message, setMessage] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const folderInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);

  const check = useCallback(async () => {
    try {
      const status = await post<{ images: ImageRow[] }>({ action: "originals-status", galleryId });
      setRows(status.images);
      setPhase("idle");
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Couldn't check the full-size downloads.");
    }
  }, [galleryId]);

  useEffect(() => {
    const timer = window.setTimeout(check, 0);
    return () => window.clearTimeout(timer);
  }, [check, imageCount]);

  useEffect(() => {
    // Lets the "Choose folder" button pick a whole folder.
    folderInput.current?.setAttribute("webkitdirectory", "");
  }, [phase]);

  async function upload(fileList: FileList | null) {
    if (!fileList?.length) return;
    const jpegs = Array.from(fileList).filter((file) => /\.jpe?g$/i.test(file.name));
    const byName = new Map(jpegs.map((file) => [baseName(file.name), file]));
    // Photos that already have their full-size file are skipped, so
    // "Add the rest" only sends what's missing instead of everything again.
    const matches = rows
      .filter((row) => !row.hasOriginal)
      .map((row) => ({ row, file: byName.get(baseName(row.originalFilename)) }))
      .filter((match): match is { row: ImageRow; file: File } => !!match.file);

    if (!matches.length) {
      setMessage(
        rows.every((row) => row.hasOriginal)
          ? "Every photo already has its full-size file."
          : "None of those JPEGs match the photos still missing a full-size file.",
      );
      return;
    }

    const unmatched = rows.filter((row) => !row.hasOriginal).length - matches.length;
    const size = matches.reduce((sum, match) => sum + match.file.size, 0);
    setMessage("");
    setPhase("working");
    setProgress({ done: 0, total: matches.length, sent: 0, size });
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    let failures = 0;
    let firstError = "";

    try {
      for (let start = 0; start < matches.length; start += BATCH) {
        const batch = matches.slice(start, start + BATCH);
        const { jobs } = await post<{ jobs: Array<{ webFilename: string; uploadUrl: string }> }>({
          action: "presign-originals",
          galleryId,
          webFilenames: batch.map((match) => match.row.webFilename),
        });
        const links = new Map(jobs.map((job) => [job.webFilename, job.uploadUrl]));
        let next = 0;
        const worker = async () => {
          while (next < batch.length) {
            const { row, file } = batch[next++];
            const url = links.get(row.webFilename);
            // Big full-size files can drop on a home connection, so each
            // one is tried up to 3 times before it counts as failed.
            let lastError = "";
            let ok = false;
            for (let attempt = 0; attempt < 3 && !ok; attempt += 1) {
              try {
                if (!url) throw new Error("no upload link");
                const response = await fetch(url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: file });
                if (!response.ok) throw new Error("HTTP " + response.status);
                ok = true;
              } catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
                if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
              }
            }
            if (!ok) {
              failures += 1;
              firstError ||= lastError;
              console.warn("Full-size upload failed:", file.name, lastError);
            }
            setProgress((value) => ({ ...value, done: value.done + 1, sent: value.sent + file.size }));
          }
        };
        await Promise.all(Array.from({ length: AT_ONCE }, worker));
      }
    } catch (error) {
      failures += 1;
      setMessage(error instanceof Error ? error.message : "Upload stopped.");
    } finally {
      window.removeEventListener("beforeunload", warn);
      await check();
      const notes = [];
      if (failures) notes.push(failures + " didn't upload" + (firstError ? " (" + firstError + ")" : "") + " — choose them again to retry.");
      if (unmatched > 0) notes.push(unmatched + " gallery photo" + (unmatched === 1 ? "" : "s") + " had no matching JPEG in what you chose.");
      setMessage(notes.join(" "));
    }
  }

  async function remove() {
    setConfirmRemove(false);
    setPhase("removing");
    try {
      await post({ action: "remove-originals", galleryId });
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't remove them.");
    } finally {
      await check();
    }
  }

  if (phase === "checking" || imageCount === 0) return null;

  const withOriginal = rows.filter((row) => row.hasOriginal).length;
  const percent = progress.size ? Math.round((progress.sent / progress.size) * 100) : 0;

  return (
    <div className="sp-gallery-sidebar-card sp-gallery-thumbs" aria-live="polite">
      <strong className="sp-gallery-thumbs-title">Full-size downloads</strong>

      {phase === "working" ? (
        <>
          <p>
            Uploading {progress.done.toLocaleString("en-GB")} of {progress.total.toLocaleString("en-GB")} · {bytes(progress.sent)} of {bytes(progress.size)}. Keep this tab open.
          </p>
          <div className="sp-gallery-thumbs-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: Math.max(2, percent) + "%" }} />
          </div>
        </>
      ) : phase === "removing" ? (
        <p>Removing…</p>
      ) : (
        <>
          {withOriginal > 0 ? (
            <p className="sp-gallery-thumbs-good">
              ✓ {withOriginal.toLocaleString("en-GB")} of {rows.length.toLocaleString("en-GB")} photos download at full size (your original JPEG).
            </p>
          ) : (
            <p>
              Downloads are the smaller proofs. Add your original JPEGs (matched by file name) and visitors download those instead. Remove them when the gallery is done, as they use storage.
            </p>
          )}
          {message ? <p className="sp-gallery-thumbs-note">{message}</p> : null}

          {withOriginal < rows.length ? (
            <>
              <button type="button" className="sp-gallery-thumbs-button" onClick={() => folderInput.current?.click()}>
                {withOriginal ? "Add the rest — choose folder" : "Add full-size — choose folder"}
              </button>
              <button type="button" className="sp-gallery-originals-link" onClick={() => filesInput.current?.click()}>
                or choose files instead
              </button>
            </>
          ) : null}

          {withOriginal > 0 ? (
            confirmRemove ? (
              <div className="sp-gallery-originals-confirm">
                <p>Remove all {withOriginal} full-size originals? Downloads go back to the smaller proofs. Your photos in the gallery stay.</p>
                <button type="button" className="sp-gallery-originals-danger" onClick={() => void remove()}>Yes, remove them</button>
                <button type="button" className="sp-gallery-originals-link" onClick={() => setConfirmRemove(false)}>Cancel</button>
              </div>
            ) : (
              <button type="button" className="sp-gallery-originals-link" onClick={() => setConfirmRemove(true)}>
                Remove full-size originals
              </button>
            )
          ) : null}
        </>
      )}

      <input
        ref={folderInput}
        type="file"
        multiple
        hidden
        onChange={(event) => { void upload(event.currentTarget.files); event.currentTarget.value = ""; }}
      />
      <input
        ref={filesInput}
        type="file"
        accept="image/jpeg,.jpg,.jpeg"
        multiple
        hidden
        onChange={(event) => { void upload(event.currentTarget.files); event.currentTarget.value = ""; }}
      />
    </div>
  );
}
