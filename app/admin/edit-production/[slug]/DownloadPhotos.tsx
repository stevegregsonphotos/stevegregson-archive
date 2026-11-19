"use client";

/*
 * Backstage › Productions › Edit › "Download photos".
 * One zip of the production's website photos, as Full res or Web res:
 *  - Full res: Steve's full-size JPEGs from Storage (matched by file name).
 *  - Web res: his Web JPEGs from Storage; any not in Storage are made from
 *    the website's own copy (WebP → JPEG, up to 2560px).
 * Storage-only zips stream through /transfer-zip-sw.js (like Storage ›
 * Download folder); a zip that needs website copies is built in the page
 * with JSZip and saved with a "Save zip" link (Safari stalls downloads
 * that start after an await).
 */

import { useEffect, useRef, useState } from "react";

import { getProductionImageUrl } from "@/lib/production-image-url";
import { websiteStem } from "@/lib/production-download/match";
import { downloadAsZip, prepareZip, type ZipFile } from "@/lib/transfers/zip-client";

import styles from "./production-edit.module.css";

type StoredFile = { name: string; path: string; objectKey: string; size: number; url: string };
type Photo = { website: string; full?: StoredFile; web?: StoredFile };
type Kind = "full" | "web";
type Phase =
  | { step: "idle" }
  | { step: "finding" }
  | { step: "choose" }
  | { step: "browse"; path: string; folders: { name: string; path: string }[]; loading: boolean }
  | { step: "working"; text: string }
  | { step: "save"; url: string; filename: string; count: number }
  | { step: "done"; text: string }
  | { step: "error"; text: string };

type Props = {
  slug: string;
  title: string;
  venue: string;
  month?: number | null;
  year: number;
  hero: string;
  images: string[];
};

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/admin/production-download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as { ok?: boolean; message?: string } & T;
  if (!response.ok || !data.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

function megabytes(bytes: number) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + " GB";
  return Math.max(1, Math.round(bytes / 1e6)) + " MB";
}

function safeZipName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "Photos";
}

/** The website's WebP copy as a JPEG (canvas → JPEG works in every browser). */
async function websiteCopyAsJpeg(url: string) {
  const response = await fetch(url + (url.includes("?") ? "&" : "?") + "download=" + Date.now(), { mode: "cors", cache: "no-store" });
  if (!response.ok) throw new Error("Couldn't fetch a photo from the website (" + response.status + ").");
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser couldn't convert a photo.");
    context.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("This browser couldn't convert a photo."))), "image/jpeg", 0.92);
    });
  } finally {
    bitmap.close();
  }
}

export default function DownloadPhotos(props: Props) {
  const { slug, title, venue, month, year, hero, images } = props;
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("full");
  const savedUrl = useRef<string | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const websiteFiles = [hero, ...images.filter((src) => src !== hero)].filter(Boolean);
  const count = websiteFiles.length;
  const busy = phase.step === "working" || phase.step === "finding";

  useEffect(() => () => { if (savedUrl.current) URL.revokeObjectURL(savedUrl.current); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) setOpen(false); };
    const onClick = (event: MouseEvent) => {
      if (!busy && boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [open, busy]);

  async function findInStorage(chosenFolder?: string) {
    setPhase({ step: "finding" });
    try {
      const data = await post<{ folder: string | null; photos: { full?: StoredFile; web?: StoredFile }[] }>({
        action: "match", filenames: websiteFiles, title, venue, month: month ?? null, year, folder: chosenFolder || "",
      });
      const next = websiteFiles.map((website, index) => ({ website, ...data.photos[index] }));
      setPhotos(next);
      setFolder(data.folder);
      setKind(next.some((photo) => photo.full) ? "full" : "web");
      setPhase({ step: "choose" });
    } catch (error) {
      setPhotos(websiteFiles.map((website) => ({ website })));
      setFolder(null);
      setKind("web");
      setPhase({ step: "error", text: error instanceof Error ? error.message : "Couldn't search Storage." });
    }
  }

  function toggle() {
    if (open) { if (!busy) setOpen(false); return; }
    setOpen(true);
    if (!photos.length || phase.step === "error") void findInStorage();
    else if (phase.step !== "working") setPhase({ step: "choose" });
  }

  async function browse(path: string) {
    setPhase({ step: "browse", path, folders: [], loading: true });
    try {
      const data = await post<{ folders: { name: string; path: string }[] }>({ action: "folders", path });
      setPhase({ step: "browse", path, folders: data.folders, loading: false });
    } catch (error) {
      setPhase({ step: "error", text: error instanceof Error ? error.message : "Couldn't open Storage." });
    }
  }

  const fullCount = photos.filter((photo) => photo.full).length;
  const webCount = photos.filter((photo) => photo.web).length;
  const fullBytes = photos.reduce((sum, photo) => sum + (photo.full?.size || 0), 0);
  const allWebInStorage = count > 0 && webCount === count;
  const webBytes = allWebInStorage
    ? photos.reduce((sum, photo) => sum + (photo.web?.size || 0), 0)
    : photos.reduce((sum, photo) => sum + (photo.web?.size || 900_000), 0);

  async function streamFromStorage(files: StoredFile[], label: string) {
    setPhase({ step: "working", text: "Starting the download…" });
    const zipName = safeZipName(title + " - " + label);
    const entries: ZipFile[] = files.map((file) => ({ name: file.name, size: file.size, url: file.url }));
    const worker = await prepareZip();
    const started = await downloadAsZip(worker, zipName, entries, {
      progress: (done, total) => setPhase({ step: "working", text: "Downloading " + done + " of " + total + " photos…" }),
      done: (total) => setPhase({ step: "done", text: "Downloaded " + total + " photos as “" + zipName + ".zip”." }),
      error: (text) => setPhase({ step: "error", text: "The download stopped part-way (" + text + "). Please try again." }),
      unsupported: () => setPhase({ step: "error", text: "This browser can't save a zip. Please try Chrome or Safari on your Mac." }),
    });
    if (!started) setPhase({ step: "error", text: "This browser can't save a zip. Please try Chrome or Safari on your Mac." });
  }

  async function buildWebZip() {
    setPhase({ step: "working", text: "Preparing photos…" });
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const used = new Set<string>();
      const uniqueName = (name: string) => {
        let candidate = name;
        for (let n = 2; used.has(candidate.toLowerCase()); n += 1) candidate = name.replace(/(\.[^.]+)$/, " (" + n + ")$1");
        used.add(candidate.toLowerCase());
        return candidate;
      };
      for (const [index, photo] of photos.entries()) {
        setPhase({ step: "working", text: "Preparing photo " + (index + 1) + " of " + photos.length + "…" });
        if (photo.web) {
          const response = await fetch(photo.web.url, { mode: "cors", credentials: "omit" });
          if (!response.ok) throw new Error("Couldn't fetch " + photo.web.name + " from Storage.");
          zip.file(uniqueName(photo.web.name), await response.blob(), { binary: true });
        } else {
          const blob = await websiteCopyAsJpeg(getProductionImageUrl(slug, photo.website));
          zip.file(uniqueName(websiteStem(photo.website) + ".jpg"), blob, { binary: true });
        }
      }
      setPhase({ step: "working", text: "Making the zip…" });
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
      if (savedUrl.current) URL.revokeObjectURL(savedUrl.current);
      savedUrl.current = URL.createObjectURL(blob);
      setPhase({ step: "save", url: savedUrl.current, filename: safeZipName(title + " - Web res") + ".zip", count: photos.length });
    } catch (error) {
      setPhase({ step: "error", text: error instanceof Error ? error.message : "Couldn't prepare the photos." });
    }
  }

  function start() {
    if (kind === "full") {
      const files = photos.flatMap((photo) => (photo.full ? [photo.full] : []));
      if (files.length) void streamFromStorage(files, "Full res");
      return;
    }
    if (allWebInStorage) void streamFromStorage(photos.map((photo) => photo.web as StoredFile), "Web res");
    else void buildWebZip();
  }

  const folderLabel = folder ? folder.split("/").join(" › ") : null;
  const fullNote = !photos.length ? "" : fullCount === count
    ? "✓ All " + count + " found"
    : fullCount ? fullCount + " of " + count + " found — the other " + (count - fullCount) + " will be left out"
      : folder ? "None of these photos are in that Storage folder." : "Not in Storage yet — this show's files are elsewhere (e.g. Dropbox).";
  const webNote = !photos.length ? "" : allWebInStorage
    ? "✓ All " + count + " found in Storage"
    : webCount ? webCount + " from Storage, " + (count - webCount) + " from the website (2560px)"
      : "From the website's copies, saved as JPEGs (up to 2560px wide)";
  const ready = phase.step === "choose" || phase.step === "done" || phase.step === "error";
  const canStart = ready && photos.length > 0 && (kind === "web" || fullCount > 0);
  const size = kind === "full" ? fullBytes : webBytes;

  return (
    <div className={styles.download} ref={boxRef}>
      <button type="button" className={styles.downloadButton} onClick={toggle} aria-expanded={open}>
        ↓ Download photos
      </button>
      {open ? (
        <div className={styles.downloadPanel} role="dialog" aria-label="Download photos">
          {phase.step === "browse" ? (
            <>
              <h3 className={styles.downloadTitle}>Choose the show&rsquo;s folder</h3>
              <p className={styles.downloadCrumbs}>
                <button type="button" onClick={() => void browse("")}>Storage</button>
                {phase.path ? phase.path.split("/").map((part, index, parts) => (
                  <span key={index}> › <button type="button" onClick={() => void browse(parts.slice(0, index + 1).join("/"))}>{part}</button></span>
                )) : null}
              </p>
              <ul className={styles.downloadFolders}>
                {phase.loading ? <li className={styles.downloadMuted}>Loading…</li> : null}
                {!phase.loading && !phase.folders.length ? <li className={styles.downloadMuted}>No folders inside.</li> : null}
                {phase.folders.map((item) => (
                  <li key={item.path}><button type="button" onClick={() => void browse(item.path)}>📁 {item.name}</button></li>
                ))}
              </ul>
              <div className={styles.downloadRow}>
                <button type="button" className={styles.downloadGhost} onClick={() => setPhase({ step: "choose" })}>Cancel</button>
                <button type="button" className={styles.downloadGo} disabled={!phase.path} onClick={() => void findInStorage(phase.path)}>
                  Use this folder
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className={styles.downloadTitle}>Download the {count} photos</h3>
              <p className={styles.downloadLede}>The same photos as the website gallery, as one zip.</p>

              {phase.step === "finding" ? <p className={styles.downloadMuted}>Looking for them in Storage…</p> : (
                <>
                  <label className={`${styles.downloadOption} ${kind === "full" ? styles.downloadOptionOn : ""} ${fullCount ? "" : styles.downloadOptionOff}`}>
                    <input type="radio" name="download-kind" checked={kind === "full"} disabled={!fullCount || busy} onChange={() => setKind("full")} />
                    <span>
                      <strong>Full res</strong>
                      <span>Your full-size JPEGs from Storage.</span>
                      <span className={fullCount === count ? styles.downloadOk : styles.downloadWarn}>{fullNote}</span>
                    </span>
                  </label>
                  <label className={`${styles.downloadOption} ${kind === "web" ? styles.downloadOptionOn : ""}`}>
                    <input type="radio" name="download-kind" checked={kind === "web"} disabled={busy} onChange={() => setKind("web")} />
                    <span>
                      <strong>Web res</strong>
                      <span>Your Web JPEGs from Storage — or, if they&rsquo;re not there, the website&rsquo;s copies saved as JPEGs.</span>
                      <span className={allWebInStorage ? styles.downloadOk : styles.downloadMuted}>{webNote}</span>
                    </span>
                  </label>
                  <p className={styles.downloadFolder}>
                    {folderLabel ? <>Storage folder: {folderLabel} · </> : <>No matching folder found in Storage · </>}
                    <button type="button" disabled={busy} onClick={() => void browse(folder ? folder.split("/").slice(0, -1).join("/") : "")}>
                      {folderLabel ? "Change folder" : "Choose a folder"}
                    </button>
                  </p>
                </>
              )}

              {phase.step === "working" ? <p className={styles.downloadStatus}>{phase.text} Keep this tab open.</p> : null}
              {phase.step === "done" ? <p className={styles.downloadOk}>{phase.text}</p> : null}
              {phase.step === "error" ? <p className={styles.downloadError}>{phase.text}</p> : null}

              {phase.step === "save" ? (
                <a className={styles.downloadGo} href={phase.url} download={phase.filename} onClick={() => setPhase({ step: "done", text: "Saved " + phase.count + " photos as “" + phase.filename + "”." })}>
                  Ready — save zip ({phase.count} photos)
                </a>
              ) : (
                <button type="button" className={styles.downloadGo} disabled={!canStart} onClick={start}>
                  {phase.step === "working" ? "Working…" : "Download zip" + (canStart && size ? " (≈ " + megabytes(size) + ")" : "")}
                </button>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
