"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./storage.module.css";
import {
  describeProgress,
  filesFromInput,
  formatBytes as bytes,
  oversizedFiles,
  uploadQueue,
  warnBeforeLeaving,
  type QueuedFile,
} from "@/lib/transfers/upload-client";
import { useFileDrop } from "@/lib/transfers/use-file-drop";

type Folder = { name: string; path: string };
type FileItem = {
  name: string;
  path: string;
  objectKey: string;
  sizeBytes: number;
  lastModified?: string;
  isImage: boolean;
  viewUrl?: string;
};
type Listing = { path: string; folders: Folder[]; files: FileItem[]; nextCursor?: string; truncated: boolean };
type TrashEntry = {
  id: string;
  name: string;
  kind: "file" | "folder";
  originalParent: string;
  itemCount: number;
  sizeBytes: number;
  deletedAt: string;
};
type Item = { kind: "file" | "folder"; path: string; name: string; objectKey?: string };
type Pair = { from: string; to: string };

const EMPTY_LISTING: Listing = { path: "", folders: [], files: [], truncated: false };

function joinPath(...parts: string[]) {
  return parts.flatMap((part) => part.split("/")).map((p) => p.trim()).filter(Boolean).join("/");
}

function parentOf(path: string) {
  return path.split("/").slice(0, -1).join("/");
}

function modified(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
  }).format(new Date(value));
}

function pathPrefixes(path: string) {
  const parts = path.split("/").filter(Boolean);
  return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

async function api<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/admin/storage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({ ok: false, message: "The server returned an unexpected response." }));
  if (response.status === 401) throw new Error("Your Backstage login has expired. Log in again in another tab, then retry.");
  if (!data.ok) throw new Error(data.message || "Something went wrong.");
  return data as T;
}

async function fetchListing(path: string, cursor?: string): Promise<Listing> {
  const response = await fetch(
    "/api/admin/storage?path=" + encodeURIComponent(path) + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
    { cache: "no-store" },
  );
  const data = await response.json().catch(() => ({ ok: false, message: "Storage returned an unexpected response (HTTP " + response.status + ")." }));
  if (!data.ok) throw new Error(data.message || "Could not load storage.");
  return data.listing;
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function StorageBrowser() {
  const [listing, setListing] = useState<Listing>(EMPTY_LISTING);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [mode, setMode] = useState<"files" | "trash">("files");
  const [trash, setTrash] = useState<TrashEntry[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ folders: Folder[]; files: FileItem[] } | null>(null);
  const [rootFolders, setRootFolders] = useState<Folder[]>([]);
  const [treeChildren, setTreeChildren] = useState<Record<string, Folder[]>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Item[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [mover, setMover] = useState<{ items: Item[]; path: string; folders: Folder[]; loading: boolean } | null>(null);
  const filesRef = useRef<HTMLInputElement | null>(null);
  const folderRef = useRef<HTMLInputElement | null>(null);

  // ---- Loading ------------------------------------------------------------

  const refreshTree = useCallback(async (path: string, current?: Listing) => {
    const loaded = await Promise.all(
      ["", ...pathPrefixes(path)].map((treePath) =>
        current && current.path === treePath ? current : fetchListing(treePath),
      ),
    );
    const root = loaded.find((item) => item.path === "");
    if (root) setRootFolders(root.folders);
    setTreeChildren((previous) => {
      const next = { ...previous };
      for (const item of loaded) if (item.path) next[item.path] = item.folders;
      return next;
    });
  }, []);

  const load = useCallback(async (path = "") => {
    setBusy(true);
    try {
      const current = await fetchListing(path);
      setMode("files");
      setListing(current);
      setSearchResults(null);
      setQuery("");
      setPreview(null);
      await refreshTree(path, current);
    } catch (error) {
      setMessage(errorText(error, "Could not load storage."));
    } finally {
      setBusy(false);
    }
  }, [refreshTree]);

  // Load the top folder once the page is in the browser.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(""), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function loadMore() {
    if (!listing.nextCursor) return;
    setBusy(true);
    try {
      const more = await fetchListing(listing.path, listing.nextCursor);
      setListing((current) => ({
        ...more,
        folders: [...current.folders, ...more.folders],
        files: [...current.files, ...more.files],
      }));
    } catch (error) {
      setMessage(errorText(error, "Could not load more."));
    } finally {
      setBusy(false);
    }
  }

  async function search() {
    const value = query.trim();
    if (!value) {
      setSearchResults(null);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/storage?q=" + encodeURIComponent(value), { cache: "no-store" });
      const data = await response.json().catch(() => ({ ok: false, message: "Search failed (HTTP " + response.status + ")." }));
      if (!data.ok) throw new Error(data.message || "Search failed.");
      setMode("files");
      setSearchResults(data.search);
    } catch (error) {
      setMessage(errorText(error, "Search failed."));
    } finally {
      setBusy(false);
    }
  }

  async function openTrash() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/storage?trash=1", { cache: "no-store" });
      const data = await response.json().catch(() => ({ ok: false, message: "Deleted Files failed to load (HTTP " + response.status + ")." }));
      if (!data.ok) throw new Error(data.message || "Could not load Deleted Files.");
      setTrash(data.trash);
      setMode("trash");
      setSelected([]);
      setSearchResults(null);
    } catch (error) {
      setMessage(errorText(error, "Could not load Deleted Files."));
    } finally {
      setBusy(false);
    }
  }

  // ---- Uploading ----------------------------------------------------------

  async function upload(queue: QueuedFile[]) {
    if (!queue.length || busy) return;
    const tooBig = oversizedFiles(queue);
    if (tooBig.length) {
      setMessage("These files are over 5 GB and can't be uploaded in one piece yet: " + tooBig.slice(0, 3).join(", ") + ".");
      return;
    }
    const folder = listing.path;
    setBusy(true);
    setUploadOpen(false);
    const stopWarning = warnBeforeLeaving();
    try {
      await uploadQueue<{ uploadUrl: string }>(
        queue,
        async (items) => (await api<{ jobs: { uploadUrl: string }[] }>({
          action: "presign-upload-batch",
          paths: items.map((item) => joinPath(folder, item.relativePath)),
        })).jobs,
        async () => {},
        (progress) => setMessage(describeProgress(progress)),
      );
      setMessage(queue.length + " " + (queue.length === 1 ? "file" : "files") + " uploaded.");
      if (folder === listing.path) await load(folder);
    } catch (error) {
      setMessage(errorText(error, "Upload failed.") + " Files that finished are already saved.");
      await load(folder);
    } finally {
      stopWarning();
      setBusy(false);
    }
  }

  const { dragging, dropProps } = useFileDrop((files) => void upload(files), mode === "files" && !searchResults && !busy);

  async function createFolder() {
    const name = window.prompt("New folder name");
    if (!name?.trim()) return;
    setBusy(true);
    try {
      await api({ action: "create-folder", path: joinPath(listing.path, name.trim()) });
      await load(listing.path);
    } catch (error) {
      setMessage(errorText(error, "Could not create folder."));
    } finally {
      setBusy(false);
    }
  }

  // ---- Moving, renaming, deleting ------------------------------------------

  /** Applies planned moves 100 at a time, with progress. */
  async function runPairs(pairs: Pair[], verb: string) {
    for (let start = 0; start < pairs.length; start += 100) {
      if (pairs.length > 100) setMessage(verb + " " + Math.min(start + 100, pairs.length) + " of " + pairs.length + " items…");
      await api({ action: "apply", pairs: pairs.slice(start, start + 100) });
    }
  }

  async function withWork(label: string, work: () => Promise<string | void>) {
    setBusy(true);
    setMessage(label);
    const stopWarning = warnBeforeLeaving();
    try {
      const done = await work();
      setMessage(done || "");
    } catch (error) {
      setMessage(errorText(error, "That didn't work."));
    } finally {
      stopWarning();
      setBusy(false);
    }
  }

  async function rename(item: Item) {
    const name = window.prompt("Rename “" + item.name + "” to:", item.name);
    if (!name?.trim() || name.trim() === item.name) return;
    await withWork("Renaming…", async () => {
      const { pairs } = await api<{ pairs: Pair[] }>({ action: "plan-rename", item, name: name.trim() });
      await runPairs(pairs, "Renaming");
      setSelected([]);
      await load(listing.path);
      return "Renamed to “" + name.trim() + "”.";
    });
  }

  async function remove(items: Item[]) {
    if (!items.length) return;
    let warning = "";
    try {
      const { transfers } = await api<{ transfers: { title: string }[] }>({ action: "check-in-use", items });
      if (transfers.length) {
        warning = "\n\nHeads up: this is part of a live transfer (" + transfers.map((t) => "“" + t.title + "”").join(", ") +
          "). Clients won't be able to download it while it's in Deleted Files.";
      }
    } catch {
      // If the check fails, still let Steve decide.
    }
    const label = items.length === 1 ? "“" + items[0].name + "”" : items.length + " items";
    if (!window.confirm("Move " + label + " to Deleted Files? You can restore it for 30 days." + warning)) return;
    await withWork("Deleting…", async () => {
      const { pairs } = await api<{ pairs: Pair[] }>({ action: "plan-delete", items });
      await runPairs(pairs, "Deleting");
      setSelected([]);
      await load(listing.path);
      return "Moved " + label + " to Deleted Files.";
    });
  }

  async function openMover(items: Item[]) {
    if (!items.length) return;
    setMover({ items, path: listing.path, folders: [], loading: true });
    await browseMover(listing.path, items);
  }

  async function browseMover(path: string, items?: Item[]) {
    setMover((current) => (current ? { ...current, path, loading: true } : current));
    try {
      const result = await fetchListing(path);
      setMover((current) => current ? { items: items ?? current.items, path, folders: result.folders, loading: false } : current);
    } catch (error) {
      setMessage(errorText(error, "Could not load folders."));
      setMover(null);
    }
  }

  async function moveHere() {
    if (!mover) return;
    const { items, path } = mover;
    setMover(null);
    await withWork("Moving…", async () => {
      const { pairs } = await api<{ pairs: Pair[] }>({ action: "plan-move", items, destination: path });
      await runPairs(pairs, "Moving");
      setSelected([]);
      await load(listing.path);
      return pairs.length ? "Moved to " + (path || "All files") + "." : "Already in that folder.";
    });
  }

  async function restore(entry: TrashEntry) {
    await withWork("Restoring…", async () => {
      const { pairs, restoredAs } = await api<{ pairs: Pair[]; restoredAs: string }>({ action: "plan-restore", trashId: entry.id });
      await runPairs(pairs, "Restoring");
      await api({ action: "finish-restore", trashId: entry.id });
      await openTrash();
      return "Restored to " + restoredAs + ".";
    });
  }

  async function deleteForever(entry: TrashEntry) {
    if (!window.confirm("Permanently delete “" + entry.name + "”? This can't be undone.")) return;
    await withWork("Deleting for good…", async () => {
      await api({ action: "delete-forever", trashId: entry.id });
      await openTrash();
      return "“" + entry.name + "” was permanently deleted.";
    });
  }

  async function download(file: FileItem) {
    try {
      const data = await api<{ url: string }>({ action: "download", objectKey: file.objectKey, name: file.name });
      window.location.assign(data.url);
    } catch (error) {
      setMessage(errorText(error, "Download unavailable."));
    }
  }

  // ---- Selection ----------------------------------------------------------

  const isSelected = (path: string) => selected.some((item) => item.path === path);
  function toggle(item: Item) {
    setSelected((current) => current.some((i) => i.path === item.path)
      ? current.filter((i) => i.path !== item.path)
      : [...current, item]);
  }
  const fileItem = (file: FileItem): Item => ({ kind: "file", path: file.path, name: file.name, objectKey: file.objectKey });
  const folderItem = (folder: Folder): Item => ({ kind: "folder", path: folder.path, name: folder.name });

  function sendSelection() {
    if (!selected.length) return;
    try {
      sessionStorage.setItem("backstage-transfer-archive-selection", JSON.stringify({
        objectKeys: selected.filter((i) => i.kind === "file").map((i) => i.objectKey),
        folderPaths: selected.filter((i) => i.kind === "folder").map((i) => i.path),
      }));
    } catch {
      setMessage("Your browser blocked passing the selection to Transfers.");
      return;
    }
    window.location.assign("/admin/transfers?archive=1");
  }

  // ---- Preview (lightbox) -------------------------------------------------

  const shown = searchResults || { folders: listing.folders, files: listing.files };
  const images = shown.files.filter((file) => file.isImage && file.viewUrl);
  const previewFile = preview === null ? null : images[preview];

  useEffect(() => {
    if (preview === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
      if (event.key === "ArrowRight") setPreview((i) => (i === null ? i : (i + 1) % images.length));
      if (event.key === "ArrowLeft") setPreview((i) => (i === null ? i : (i - 1 + images.length) % images.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, images.length]);

  function openPreview(file: FileItem) {
    const index = images.findIndex((image) => image.path === file.path);
    if (index >= 0) setPreview(index);
  }

  // ---- Rendering ----------------------------------------------------------

  function treeButton(folder: Folder, depth: number): React.ReactNode {
    const expanded = mode === "files" && (listing.path === folder.path || listing.path.startsWith(folder.path + "/"));
    return (
      <div key={folder.path}>
        <button
          type="button"
          className={expanded ? styles.treeActive : ""}
          style={{ paddingLeft: 12 + depth * 14 }}
          onClick={() => void load(folder.path)}
        >
          <span>{expanded ? "⌄" : "›"}</span>
          <span>📁</span>
          <span>{folder.name}</span>
        </button>
        {expanded ? (treeChildren[folder.path] || []).map((child) => treeButton(child, depth + 1)) : null}
      </div>
    );
  }

  const crumbs = listing.path ? listing.path.split("/") : [];

  function fileActions(file: FileItem) {
    return (
      <>
        <button type="button" onClick={() => void download(file)}>Download</button>
        <button type="button" onClick={() => void rename(fileItem(file))}>Rename</button>
        <button type="button" onClick={() => void openMover([fileItem(file)])}>Move</button>
        <button type="button" onClick={() => void remove([fileItem(file)])}>Delete</button>
      </>
    );
  }

  function folderActions(folder: Folder) {
    return (
      <>
        <button type="button" onClick={() => void rename(folderItem(folder))}>Rename</button>
        <button type="button" onClick={() => void openMover([folderItem(folder)])}>Move</button>
        <button type="button" onClick={() => void remove([folderItem(folder)])}>Delete</button>
      </>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div>
          <p>Steve Gregson</p>
          <h1>Storage</h1>
        </div>
        <form className={styles.search} onSubmit={(event) => { event.preventDefault(); void search(); }}>
          <span>⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Storage" />
          {query ? <button type="button" onClick={() => { setQuery(""); setSearchResults(null); }}>×</button> : null}
        </form>
        <div className={styles.topActions}>
          <div className={styles.uploadWrap}>
            <button type="button" className={styles.primary} disabled={busy} onClick={() => setUploadOpen((open) => !open)}>
              ↑ Upload <span>⌄</span>
            </button>
            {uploadOpen ? (
              <div className={styles.uploadMenu}>
                <button type="button" onClick={() => filesRef.current?.click()}>Files</button>
                <button type="button" onClick={() => folderRef.current?.click()}>Folder</button>
              </div>
            ) : null}
          </div>
          <button type="button" disabled={busy} onClick={() => void createFolder()}>▣ New folder</button>
        </div>
        <input
          ref={filesRef}
          className={styles.hidden}
          type="file"
          multiple
          onChange={(event) => { void upload(filesFromInput(event.target.files)); event.target.value = ""; }}
        />
        <input
          ref={folderRef}
          className={styles.hidden}
          type="file"
          multiple
          {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
          onChange={(event) => { void upload(filesFromInput(event.target.files)); event.target.value = ""; }}
        />
      </header>

      <div className={styles.browser}>
        <aside className={styles.sidebar}>
          <button className={mode === "files" ? styles.allFiles : ""} type="button" onClick={() => void load("")}>
            ▦ <span>All files</span>
          </button>
          <div className={styles.tree}>{rootFolders.map((folder) => treeButton(folder, 0))}</div>
          <button className={(mode === "trash" ? styles.allFiles + " " : "") + styles.trashLink} type="button" onClick={() => void openTrash()}>
            🗑 <span>Deleted files</span>
          </button>
        </aside>

        <section
          className={styles.content + " " + styles.dropZone + (dragging ? " " + styles.dropActive : "")}
          data-drop-label={"Drop to upload to " + (crumbs.at(-1) || "All files")}
          aria-busy={busy}
          {...dropProps}
        >
          {mode === "trash" ? (
            <>
              <div className={styles.folderHead}>
                <div>
                  <p>Storage</p>
                  <h2>Deleted files</h2>
                </div>
              </div>
              <p className={styles.trashNote}>Deleted items are kept for 30 days, then removed for good.</p>
              {message ? <p className={styles.message} aria-live="polite">{message}</p> : null}
              <div className={styles.list}>
                <div className={styles.trashHead}>
                  <strong>Name</strong><strong>From</strong><strong>Deleted</strong><strong>Size</strong><span />
                </div>
                {trash.map((entry) => (
                  <div className={styles.trashRow} key={entry.id}>
                    <strong>{entry.kind === "folder" ? "📁 " : ""}{entry.name}{entry.kind === "folder" ? " (" + entry.itemCount + " files)" : ""}</strong>
                    <span>{entry.originalParent || "All files"}</span>
                    <span>{modified(entry.deletedAt)}</span>
                    <span>{bytes(entry.sizeBytes)}</span>
                    <div className={styles.rowActions}>
                      <button type="button" disabled={busy} onClick={() => void restore(entry)}>Restore</button>
                      <button type="button" disabled={busy} onClick={() => void deleteForever(entry)}>Delete forever</button>
                    </div>
                  </div>
                ))}
              </div>
              {!busy && !trash.length ? <p className={styles.empty}>Nothing has been deleted.</p> : null}
            </>
          ) : (
            <>
              <div className={styles.breadcrumbs}>
                <button type="button" onClick={() => void load("")}>All files</button>
                {crumbs.map((crumb, index) => {
                  const path = crumbs.slice(0, index + 1).join("/");
                  return (
                    <span key={path}>
                      {" / "}
                      <button type="button" onClick={() => void load(path)}>{crumb}</button>
                    </span>
                  );
                })}
              </div>

              <div className={styles.folderHead}>
                <div>
                  <p>{searchResults ? "Search results" : crumbs.length ? "All files" : "Storage"}</p>
                  <h2>{searchResults ? "“" + query + "”" : crumbs.at(-1) || "All files"}</h2>
                </div>
                <div className={styles.viewToggle} aria-label="View">
                  <button className={view === "grid" ? styles.active : ""} type="button" onClick={() => setView("grid")} title="Thumbnail view" aria-label="Thumbnail view">▦</button>
                  <button className={view === "list" ? styles.active : ""} type="button" onClick={() => setView("list")} title="List view" aria-label="List view">☷</button>
                </div>
              </div>

              {selected.length > 0 ? (
                <div className={styles.selectionBar}>
                  <strong>{selected.length} selected</strong>
                  <button type="button" disabled={busy} onClick={sendSelection}>Send transfer</button>
                  <button type="button" disabled={busy} onClick={() => void openMover(selected)}>Move</button>
                  <button type="button" disabled={busy} onClick={() => void remove(selected)}>Delete</button>
                  <button type="button" onClick={() => setSelected([])}>Clear selection</button>
                </div>
              ) : null}

              {message ? <p className={styles.message} aria-live="polite">{message}</p> : null}

              {view === "list" ? (
                <div className={styles.list}>
                  <div className={styles.listHead}>
                    <span /><strong>Name</strong><strong>Last modified</strong><strong>Size</strong><span />
                  </div>
                  {shown.folders.map((folder) => (
                    <div className={styles.listRow} key={folder.path}>
                      <input aria-label={"Select " + folder.name} type="checkbox" checked={isSelected(folder.path)} onChange={() => toggle(folderItem(folder))} />
                      <button className={styles.nameButton} type="button" onClick={() => void load(folder.path)}>
                        📁 <strong>{folder.name}</strong>
                        {searchResults && parentOf(folder.path) ? <small className={styles.inFolder}> in {parentOf(folder.path)}</small> : null}
                      </button>
                      <span>—</span>
                      <span>—</span>
                      <div className={styles.rowActions}>{folderActions(folder)}</div>
                    </div>
                  ))}
                  {shown.files.map((file) => (
                    <div className={styles.listRow} key={file.objectKey}>
                      <input aria-label={"Select " + file.name} type="checkbox" checked={isSelected(file.path)} onChange={() => toggle(fileItem(file))} />
                      <div className={styles.fileName}>
                        {file.isImage && file.viewUrl ? (
                          <button type="button" className={styles.thumbButton} onClick={() => openPreview(file)} aria-label={"Preview " + file.name}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={file.viewUrl} alt="" loading="lazy" />
                          </button>
                        ) : (
                          <span className={styles.fileIcon}>FILE</span>
                        )}
                        <strong>{file.name}</strong>
                        {searchResults && parentOf(file.path) ? <small className={styles.inFolder}>in {parentOf(file.path)}</small> : null}
                      </div>
                      <span>{modified(file.lastModified)}</span>
                      <span>{bytes(file.sizeBytes)}</span>
                      <div className={styles.rowActions}>{fileActions(file)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.grid}>
                  {shown.folders.map((folder) => (
                    <article className={styles.folderCard} key={folder.path}>
                      <label>
                        <input type="checkbox" checked={isSelected(folder.path)} onChange={() => toggle(folderItem(folder))} /> Select
                      </label>
                      <button type="button" onClick={() => void load(folder.path)}>
                        <span>📁</span>
                        <strong>{folder.name}</strong>
                        <small>{searchResults && parentOf(folder.path) ? "in " + parentOf(folder.path) : "Folder"}</small>
                      </button>
                      <div className={styles.cardActions}>{folderActions(folder)}</div>
                    </article>
                  ))}
                  {shown.files.map((file) => (
                    <article className={styles.fileCard} key={file.objectKey}>
                      <label>
                        <input type="checkbox" checked={isSelected(file.path)} onChange={() => toggle(fileItem(file))} /> Select
                      </label>
                      <div className={styles.thumb}>
                        {file.isImage && file.viewUrl ? (
                          <button type="button" className={styles.thumbButton} onClick={() => openPreview(file)} aria-label={"Preview " + file.name}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={file.viewUrl} alt="" loading="lazy" />
                          </button>
                        ) : (
                          <span>FILE</span>
                        )}
                      </div>
                      <div className={styles.cardMeta}>
                        <strong title={file.name}>{file.name}</strong>
                        <span>{bytes(file.sizeBytes)} · {modified(file.lastModified)}</span>
                      </div>
                      <div className={styles.cardActions}>{fileActions(file)}</div>
                    </article>
                  ))}
                </div>
              )}

              {!searchResults && listing.nextCursor ? (
                <div className={styles.loadMore}>
                  <button type="button" disabled={busy} onClick={() => void loadMore()}>Load more</button>
                </div>
              ) : null}

              {!busy && !shown.folders.length && !shown.files.length ? (
                <p className={styles.empty}>
                  {searchResults ? "No matching files or folders." : "This folder is empty. Drag files or folders here to upload them."}
                </p>
              ) : null}
            </>
          )}
        </section>
      </div>

      {previewFile ? (
        <div className={styles.lightbox} role="dialog" aria-label={previewFile.name} onClick={() => setPreview(null)}>
          <div className={styles.lightboxBar} onClick={(event) => event.stopPropagation()}>
            <strong>{previewFile.name}</strong>
            <span>{(preview ?? 0) + 1} of {images.length}</span>
            <button type="button" onClick={() => void download(previewFile)}>Download</button>
            <button type="button" onClick={() => setPreview(null)} aria-label="Close">×</button>
          </div>
          {images.length > 1 ? (
            <button type="button" className={styles.lightboxPrev} aria-label="Previous"
              onClick={(event) => { event.stopPropagation(); setPreview((i) => (i === null ? i : (i - 1 + images.length) % images.length)); }}>‹</button>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewFile.viewUrl} alt={previewFile.name} onClick={(event) => event.stopPropagation()} />
          {images.length > 1 ? (
            <button type="button" className={styles.lightboxNext} aria-label="Next"
              onClick={(event) => { event.stopPropagation(); setPreview((i) => (i === null ? i : (i + 1) % images.length)); }}>›</button>
          ) : null}
        </div>
      ) : null}

      {mover ? (
        <div className={styles.modalBackdrop} onClick={() => setMover(null)}>
          <div className={styles.modal} role="dialog" aria-label="Move to folder" onClick={(event) => event.stopPropagation()}>
            <h3>Move {mover.items.length === 1 ? "“" + mover.items[0].name + "”" : mover.items.length + " items"}</h3>
            <div className={styles.modalPath}>
              <button type="button" onClick={() => void browseMover("")}>All files</button>
              {mover.path.split("/").filter(Boolean).map((crumb, index, parts) => {
                const path = parts.slice(0, index + 1).join("/");
                return (
                  <span key={path}> / <button type="button" onClick={() => void browseMover(path)}>{crumb}</button></span>
                );
              })}
            </div>
            <div className={styles.modalFolders}>
              {mover.loading ? <p>Loading…</p> : null}
              {!mover.loading && !mover.folders.length ? <p>No folders inside here.</p> : null}
              {mover.folders.map((folder) => {
                const blocked = mover.items.some((item) => item.kind === "folder" && (folder.path === item.path || folder.path.startsWith(item.path + "/")));
                return (
                  <button type="button" key={folder.path} disabled={blocked || mover.loading} onClick={() => void browseMover(folder.path)}>
                    📁 {folder.name}
                  </button>
                );
              })}
            </div>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setMover(null)}>Cancel</button>
              <button type="button" className={styles.primary} disabled={mover.loading} onClick={() => void moveHere()}>
                Move to {mover.path.split("/").at(-1) || "All files"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
