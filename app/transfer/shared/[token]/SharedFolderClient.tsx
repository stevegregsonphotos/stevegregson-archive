"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./shared.module.css";
import {
  downloadAsZip,
  prepareZip,
  recipientCodeFromUrl,
  startDownload,
  wait,
  type ZipFile,
} from "@/lib/transfers/zip-client";

type Folder = { name: string; path: string };
type FileItem = { name: string; path: string; sizeBytes: number; lastModified?: string; isImage: boolean; thumb?: string };

function bytes(value: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return (size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)) + " " + units[unit];
}

function shortDate(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(new Date(value));
}

function kindOf(name: string) {
  const ext = name.toLowerCase().split(".").pop() || "";
  if (ext === "jpeg") return "JPG";
  if (["cr3", "cr2", "nef", "arw", "dng"].includes(ext)) return "RAW";
  if (["mp4", "mov", "m4v"].includes(ext)) return "Video";
  return ext ? ext.toUpperCase().slice(0, 4) : "File";
}

function pathFromHash() {
  try {
    return decodeURIComponent(window.location.hash.replace(/^#\/?/, ""));
  } catch {
    return "";
  }
}

const MAX_ONE_BY_ONE = 150;
const SLIDE_MS = 7000;

export default function SharedFolderClient({ token, available, title, message: initialMessage, hasPassword, backgrounds }: {
  token: string; available: boolean; title: string; message: string; hasPassword: boolean; backgrounds: string[];
}) {
  const [path, setPath] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(hasPassword);
  const [gone, setGone] = useState(!available);
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [preview, setPreview] = useState<{ index: number; url: string } | null>(null);
  const [zip, setZip] = useState<{ label: string; done: number; total: number; finished: boolean; zipping: boolean } | null>(null);
  const [slide, setSlide] = useState(0);
  const [view, setView] = useState<"grid" | "list">("grid");
  const opened = useRef(false);
  const passwordRef = useRef("");

  useEffect(() => {
    if (backgrounds.length < 2) return;
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % backgrounds.length), SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [backgrounds.length]);

  const call = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch("/api/shared/" + token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, password: passwordRef.current, r: recipientCodeFromUrl() }),
    });
    const data = await response.json().catch(() => ({ ok: false, message: "Something went wrong. Please try again." }));
    if (data.gone) setGone(true);
    if (data.locked) setLocked(true);
    if (!data.ok) throw new Error(data.message || "");
    return data;
  }, [token]);

  const load = useCallback(async (next: string, more?: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await call({ action: "list", path: next, cursor: more, first: !opened.current });
      opened.current = true;
      setLocked(false);
      setMessage(data.message || "");
      setPath(data.path);
      setFolders((current) => (more ? [...current, ...data.folders] : data.folders));
      setFiles((current) => (more ? [...current, ...data.files] : data.files));
      setCursor(data.nextCursor || undefined);
      if (!more) { setFilter(""); setZip(null); }
    } catch (problem) {
      const text = problem instanceof Error ? problem.message : "";
      if (text) setError(text);
    } finally {
      setLoading(false);
    }
  }, [call]);

  // Folders open via the address (#/Hamlet/Act 1), so Back works as expected.
  useEffect(() => {
    if (!available) return;
    const onHash = () => void load(pathFromHash());
    const timer = window.setTimeout(onHash, 0);
    window.addEventListener("hashchange", onHash);
    return () => { window.clearTimeout(timer); window.removeEventListener("hashchange", onHash); };
  }, [available, load]);

  function open(next: string) {
    const hash = next ? "#/" + next.split("/").map(encodeURIComponent).join("/") : "#/";
    if (window.location.hash === hash) void load(next);
    else window.location.hash = hash;
    window.scrollTo({ top: document.getElementById("folder-browser")?.offsetTop ?? 0, behavior: "smooth" });
  }

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    passwordRef.current = password;
    await load(pathFromHash());
  }

  async function downloadFile(file: FileItem) {
    setNote("");
    try {
      const data = await call({ action: "file", path: file.path });
      startDownload(data.url);
      setNote("Downloading " + file.name + "…");
    } catch (problem) {
      setNote(problem instanceof Error && problem.message ? problem.message : "Download unavailable.");
    }
  }

  async function downloadFolder() {
    const label = path ? path.split("/").pop()! : title;
    setZip({ label, done: 0, total: 0, finished: false, zipping: false });
    setNote("");
    try {
      const [worker, data] = await Promise.all([prepareZip(), call({ action: "folder", path })]);
      const list = data.files as Array<ZipFile & { path: string }>;
      if (!list.length) { setZip(null); setNote("This folder is empty."); return; }
      setZip({ label, done: 0, total: list.length, finished: false, zipping: true });
      const oneByOne = async () => {
        if (list.length > MAX_ONE_BY_ONE) {
          setZip(null);
          setNote("This browser can't save a folder this big in one go. Please try Chrome, Safari or Edge on a computer, or download the folders inside it one at a time.");
          return;
        }
        setZip({ label, done: 0, total: list.length, finished: false, zipping: false });
        for (let i = 0; i < list.length; i += 1) {
          const file = await call({ action: "file", path: list[i].path, partOfFolder: true });
          startDownload(file.url);
          setZip({ label, done: i + 1, total: list.length, finished: i + 1 === list.length, zipping: false });
          await wait(900);
        }
      };
      const started = await downloadAsZip(worker, data.name || label, list, {
        progress: (done, total) => setZip({ label, done, total, finished: false, zipping: true }),
        done: (total) => setZip({ label, done: total, total, finished: true, zipping: true }),
        error: (text) => { setZip(null); setNote("The download stopped part-way (" + text + "). Please try again."); },
        unsupported: () => void oneByOne().catch(() => setNote("Download unavailable.")),
      });
      if (!started) await oneByOne();
    } catch (problem) {
      setZip(null);
      setNote(problem instanceof Error && problem.message ? problem.message : "Download unavailable.");
    }
  }

  const shownFolders = useMemo(() => folders.filter((f) => f.name.toLowerCase().includes(filter.toLowerCase())), [folders, filter]);
  const shownFiles = useMemo(() => files.filter((f) => f.name.toLowerCase().includes(filter.toLowerCase())), [files, filter]);
  const images = shownFiles.filter((file) => file.isImage && /\.(jpe?g|png|webp|gif)$/i.test(file.name));

  async function showPreview(index: number) {
    const file = images[index];
    if (!file) return;
    try {
      const data = await call({ action: "preview", path: file.path });
      setPreview({ index, url: data.url });
    } catch {
      setNote("Preview unavailable.");
    }
  }

  useEffect(() => {
    if (!preview) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
      if (event.key === "ArrowRight" && preview.index < images.length - 1) void showPreview(preview.index + 1);
      if (event.key === "ArrowLeft" && preview.index > 0) void showPreview(preview.index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const crumbs = path ? path.split("/") : [];
  const here = crumbs.at(-1) || title;
  const percent = zip && zip.total ? Math.round((zip.done / zip.total) * 100) : 0;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.stage} aria-hidden="true">
          {backgrounds.map((url, i) => (
            <div key={url} className={styles.slide + (i === slide ? " " + styles.slideActive : "")} style={{ backgroundImage: "url(" + url + ")" }} />
          ))}
          <div className={styles.scrim} />
        </div>
        <header className={styles.header}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.logo} src="/images/branding/steve-gregson-logo-white.png" alt="Steve Gregson Photography" width={900} height={512} />
          <a className={styles.siteLink} href="https://www.stevegregson.com" target="_blank" rel="noopener">stevegregson.com</a>
        </header>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>{gone ? "Steve Gregson Photography" : "Shared with you by Steve Gregson"}</p>
          <h1 className={styles.title}>{title}</h1>
          {!gone && !locked && message ? <p className={styles.message}>{message}</p> : null}
        </div>
      </section>

      <section className={styles.browser} id="folder-browser">
        {gone ? (
          <div className={styles.notice}>
            <p>This folder is no longer shared.</p>
            <p>If you still need these photographs, just get in touch.</p>
            <a className={styles.button} href="mailto:info@stevegregson.com">Email info@stevegregson.com</a>
          </div>
        ) : locked ? (
          <form className={styles.unlock} onSubmit={unlock}>
            <label htmlFor="share-password">This folder is password protected</label>
            <div>
              <input id="share-password" type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" />
              <button className={styles.button} type="submit" disabled={!password || loading}>{loading ? "Checking…" : "Open"}</button>
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
          </form>
        ) : (
          <>
            <div className={styles.bar}>
              <nav className={styles.crumbs} aria-label="Folder path">
                <button type="button" onClick={() => open("")} disabled={!path}>{title}</button>
                {crumbs.map((crumb, i) => (
                  <span key={i}>
                    <span className={styles.sep}>›</span>
                    <button type="button" disabled={i === crumbs.length - 1} onClick={() => open(crumbs.slice(0, i + 1).join("/"))}>{crumb}</button>
                  </span>
                ))}
              </nav>
              <div className={styles.barActions}>
                {folders.length + files.length > 8 ? (
                  <input className={styles.filter} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find in this folder" aria-label="Find in this folder" />
                ) : null}
                {files.some((file) => file.thumb) ? (
                  <div className={styles.viewToggle} role="group" aria-label="View">
                    <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")}>Photos</button>
                    <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
                  </div>
                ) : null}
                <button type="button" className={styles.button} disabled={loading || Boolean(zip && !zip.finished) || !(folders.length + files.length)} onClick={() => void downloadFolder()}>
                  ↓ Download {path ? "“" + here + "”" : "everything"}
                </button>
              </div>
            </div>

            {zip ? (
              <div className={styles.progress} aria-live="polite">
                <div className={styles.progressBar}><span style={{ width: (zip.total ? percent : 4) + "%" }} /></div>
                <p>
                  {zip.finished
                    ? zip.zipping ? "✓ Done — “" + zip.label + "” is in your Downloads as one zip." : "✓ All " + zip.total + " downloads started."
                    : !zip.total ? "Preparing “" + zip.label + "”…"
                    : zip.zipping ? "Downloading “" + zip.label + "” as one zip · " + zip.done + " of " + zip.total + " files · please keep this page open"
                    : "Starting " + zip.done + " of " + zip.total + "…"}
                </p>
              </div>
            ) : null}
            {note ? <p className={styles.note} aria-live="polite">{note}</p> : null}
            {error ? <p className={styles.error}>{error}</p> : null}

            <div className={styles.list} aria-busy={loading}>
              {path ? (
                <button type="button" className={styles.row + " " + styles.up} onClick={() => open(crumbs.slice(0, -1).join("/"))}>
                  <span className={styles.icon}>↰</span><span className={styles.name}>Back to {crumbs.length > 1 ? crumbs.at(-2) : title}</span>
                </button>
              ) : null}
              {shownFolders.map((folder) => (
                <button type="button" className={styles.row} key={folder.path} onClick={() => open(folder.path)}>
                  <span className={styles.icon + " " + styles.folderIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2h8.4A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" /></svg>
                  </span>
                  <span className={styles.name}><strong>{folder.name}</strong></span>
                  <span className={styles.chev} aria-hidden="true">›</span>
                </button>
              ))}
              {view === "grid" && shownFiles.some((file) => file.thumb) ? (
                <div className={styles.grid}>
                  {shownFiles.map((file) => {
                    const imageIndex = images.indexOf(file);
                    return (
                      <figure className={styles.tile} key={file.path}>
                        <button type="button" className={styles.tileImage} onClick={() => (imageIndex >= 0 ? void showPreview(imageIndex) : void downloadFile(file))} title={file.name}>
                          {file.thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={file.thumb} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} />
                          ) : <span className={styles.kind}>{kindOf(file.name)}</span>}
                        </button>
                        <figcaption>
                          <span title={file.name}>{file.name}</span>
                          <button type="button" className={styles.get} onClick={() => void downloadFile(file)} aria-label={"Download " + file.name} title="Download">↓</button>
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              ) : (<>
              {shownFiles.map((file) => {
                const imageIndex = images.indexOf(file);
                return (
                  <div className={styles.row + " " + styles.fileRow} key={file.path}>
                    <span className={styles.icon + " " + styles.kind}>{kindOf(file.name)}</span>
                    {imageIndex >= 0 ? (
                      <button type="button" className={styles.name + " " + styles.nameButton} onClick={() => void showPreview(imageIndex)} title="Preview">
                        <strong>{file.name}</strong><small>{bytes(file.sizeBytes)}{file.lastModified ? " · " + shortDate(file.lastModified) : ""}</small>
                      </button>
                    ) : (
                      <span className={styles.name}><strong>{file.name}</strong><small>{bytes(file.sizeBytes)}{file.lastModified ? " · " + shortDate(file.lastModified) : ""}</small></span>
                    )}
                    <button type="button" className={styles.get} onClick={() => void downloadFile(file)} aria-label={"Download " + file.name} title="Download">↓</button>
                  </div>
                );
              })}
              </>)}
              {!loading && !shownFolders.length && !shownFiles.length ? (
                <p className={styles.empty}>{filter ? "Nothing here matches “" + filter + "”." : "This folder is empty for now. Anything Steve adds will appear here."}</p>
              ) : null}
              {loading ? <p className={styles.empty}>Loading…</p> : null}
            </div>
            {cursor && !loading ? (
              <button type="button" className={styles.more} onClick={() => void load(path, cursor)}>Show more</button>
            ) : null}
          </>
        )}
        <footer className={styles.footer}>
          <p>When sharing these images, please credit <strong>Photography: Steve Gregson</strong> with a link to <a href="https://www.stevegregson.com">stevegregson.com</a></p>
          <p>Questions? <a href="mailto:info@stevegregson.com">info@stevegregson.com</a> · Photography © Steve Gregson</p>
        </footer>
      </section>

      {preview && images[preview.index] ? (
        <div className={styles.lightbox} role="dialog" aria-label={images[preview.index].name} onClick={() => setPreview(null)}>
          <div className={styles.lightboxBar} onClick={(e) => e.stopPropagation()}>
            <span>{images[preview.index].name}<small>{preview.index + 1} of {images.length}</small></span>
            <button type="button" className={styles.button} onClick={() => void downloadFile(images[preview.index])}>↓ Download</button>
            <button type="button" className={styles.close} aria-label="Close" onClick={() => setPreview(null)}>×</button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt={images[preview.index].name} onClick={(e) => e.stopPropagation()} />
          {preview.index > 0 ? <button type="button" className={styles.prev} aria-label="Previous" onClick={(e) => { e.stopPropagation(); void showPreview(preview.index - 1); }}>‹</button> : null}
          {preview.index < images.length - 1 ? <button type="button" className={styles.next} aria-label="Next" onClick={(e) => { e.stopPropagation(); void showPreview(preview.index + 1); }}>›</button> : null}
        </div>
      ) : null}
    </main>
  );
}
