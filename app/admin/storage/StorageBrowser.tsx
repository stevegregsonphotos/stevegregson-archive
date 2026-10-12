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
import Link from "next/link";
import ShareDialog from "./ShareDialog";
import { shareApi, type AdminShare } from "./share-api";
import {
  ChevronIcon,
  FileIcon,
  FilesIcon,
  FolderIcon,
  GridIcon,
  LaptopIcon,
  ListIcon,
  MoreIcon,
  PeopleIcon,
  SearchIcon,
  TrashIcon,
} from "./StorageIcons";

type SortKey = "name" | "modified" | "size";
const VIEW_KEY = "backstage-storage-view";

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
  const [view, setViewState] = useState<"grid" | "list">("list");
  const [sort, setSort] = useState<{ key: SortKey; ascending: boolean }>({ key: "name", ascending: true });
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  function setView(next: "grid" | "list") {
    setViewState(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* ignore */ }
  }

  // Remember list/grid choice between visits.
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(VIEW_KEY); } catch { /* ignore */ }
    if (saved !== "grid" && saved !== "list") return;
    const timer = window.setTimeout(() => setViewState(saved as "grid" | "list"), 0);
    return () => window.clearTimeout(timer);
  }, []);

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
  const [shareFor, setShareFor] = useState<{ path: string; name: string } | null>(null);
  const [sharedPaths, setSharedPaths] = useState<Set<string>>(new Set());
  const filesRef = useRef<HTMLInputElement | null>(null);
  const folderRef = useRef<HTMLInputElement | null>(null);

  // Close any open menu when clicking elsewhere.
  useEffect(() => {
    if (!menuFor && !newOpen && !uploadOpen) return;
    const close = () => { setMenuFor(null); setNewOpen(false); setUploadOpen(false); };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuFor, newOpen, uploadOpen]);

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

  const loadShared = useCallback(async () => {
    try {
      const data = await shareApi<{ shares: AdminShare[] }>({ action: "share-list" });
      setSharedPaths(new Set(data.shares.map((share) => share.path)));
    } catch {
      // The "Shared" labels are a nicety; Storage works without them.
    }
  }, []);

  // Load the top folder once the page is in the browser.
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(""); void loadShared(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, loadShared]);

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

  // ---- Sorting & preview --------------------------------------------------

  const raw = searchResults || { folders: listing.folders, files: listing.files };
  const direction = sort.ascending ? 1 : -1;
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "en-GB", { numeric: true, sensitivity: "base" });
  const folders = [...raw.folders].sort((a, b) => (sort.key === "name" ? byName(a, b) * direction : byName(a, b)));
  const files = [...raw.files].sort((a, b) => {
    if (sort.key === "size") return (a.sizeBytes - b.sizeBytes) * direction || byName(a, b);
    if (sort.key === "modified") return ((a.lastModified || "").localeCompare(b.lastModified || "")) * direction || byName(a, b);
    return byName(a, b) * direction;
  });
  const images = files.filter((file) => file.isImage && file.viewUrl);
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

  function sortBy(key: SortKey) {
    setSort((current) => (current.key === key ? { key, ascending: !current.ascending } : { key, ascending: key === "name" }));
  }

  function sortMark(key: SortKey) {
    return sort.key === key ? <span className={styles.sortMark}>{sort.ascending ? "↑" : "↓"}</span> : null;
  }

  // ---- Rendering ----------------------------------------------------------

  function treeButton(folder: Folder, depth: number): React.ReactNode {
    const open = mode === "files" && (listing.path === folder.path || listing.path.startsWith(folder.path + "/"));
    const current = mode === "files" && listing.path === folder.path;
    return (
      <div key={folder.path}>
        <button
          type="button"
          className={styles.treeItem + (current ? " " + styles.navActive : "")}
          style={{ paddingLeft: 10 + depth * 16 }}
          onClick={() => void load(folder.path)}
          title={folder.name}
        >
          <ChevronIcon open={open} />
          <FolderIcon size={20} />
          <span>{folder.name}</span>
        </button>
        {open ? (treeChildren[folder.path] || []).map((child) => treeButton(child, depth + 1)) : null}
      </div>
    );
  }

  const crumbs = listing.path ? listing.path.split("/") : [];
  const allSelected = files.length + folders.length > 0 && selected.length === files.length + folders.length;

  function toggleAll() {
    setSelected(allSelected ? [] : [...folders.map(folderItem), ...files.map(fileItem)]);
  }

  function itemMenu(item: Item, file?: FileItem) {
    const open = menuFor === item.path;
    return (
      <div className={styles.menuWrap} onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={"More actions for " + item.name}
          aria-expanded={open}
          onClick={() => setMenuFor(open ? null : item.path)}
        >
          <MoreIcon />
        </button>
        {open ? (
          <div className={styles.menu} role="menu">
            {file ? <button type="button" role="menuitem" onClick={() => { setMenuFor(null); void download(file); }}>Download</button> : null}
            {file?.isImage && file.viewUrl ? <button type="button" role="menuitem" onClick={() => { setMenuFor(null); openPreview(file); }}>Preview</button> : null}
            {item.kind === "folder" ? <button type="button" role="menuitem" onClick={() => { setMenuFor(null); setShareFor({ path: item.path, name: item.name }); }}>Share with client…</button> : null}
            <button type="button" role="menuitem" onClick={() => { setMenuFor(null); setSelected([item]); window.setTimeout(sendSelectionFor([item]), 0); }}>Send as transfer</button>
            <hr />
            <button type="button" role="menuitem" onClick={() => { setMenuFor(null); void rename(item); }}>Rename</button>
            <button type="button" role="menuitem" onClick={() => { setMenuFor(null); void openMover([item]); }}>Move</button>
            <hr />
            <button type="button" role="menuitem" className={styles.danger} onClick={() => { setMenuFor(null); void remove([item]); }}>Delete</button>
          </div>
        ) : null}
      </div>
    );
  }

  const closeShare = useCallback(() => setShareFor(null), []);

  function sendSelectionFor(items: Item[]) {
    return () => {
      try {
        sessionStorage.setItem("backstage-transfer-archive-selection", JSON.stringify({
          objectKeys: items.filter((i) => i.kind === "file").map((i) => i.objectKey),
          folderPaths: items.filter((i) => i.kind === "folder").map((i) => i.path),
        }));
        window.location.assign("/admin/transfers?archive=1");
      } catch {
        setMessage("Your browser blocked passing the selection to Transfers.");
      }
    };
  }

  const title = mode === "trash" ? "Deleted files" : searchResults ? "Search results" : crumbs.at(-1) || "All files";

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.newWrap} onClick={(event) => event.stopPropagation()}>
            <button type="button" className={styles.newButton} disabled={busy} onClick={() => setNewOpen((open) => !open)}>
              <span aria-hidden="true">+</span> New
            </button>
            {newOpen ? (
              <div className={styles.menu + " " + styles.newMenu} role="menu">
                <button type="button" role="menuitem" onClick={() => { setNewOpen(false); filesRef.current?.click(); }}>Upload files</button>
                <button type="button" role="menuitem" onClick={() => { setNewOpen(false); folderRef.current?.click(); }}>Upload folder</button>
                <hr />
                <button type="button" role="menuitem" onClick={() => { setNewOpen(false); void createFolder(); }}>New folder</button>
              </div>
            ) : null}
          </div>

          <nav className={styles.nav} aria-label="Storage">
            <button type="button" className={styles.navItem + (mode === "files" && !listing.path && !searchResults ? " " + styles.navActive : "")} onClick={() => void load("")}>
              <FilesIcon /> <span>All files</span>
            </button>
            <div className={styles.tree}>{rootFolders.map((folder) => treeButton(folder, 0))}</div>
            <div className={styles.navRule} />
            <button type="button" className={styles.navItem + (mode === "trash" ? " " + styles.navActive : "")} onClick={() => void openTrash()}>
              <TrashIcon /> <span>Deleted files</span>
            </button>
            <Link className={styles.navItem} href="/admin/storage/shared">
              <PeopleIcon /> <span>Shared with clients</span>
            </Link>
            <Link className={styles.navItem} href="/admin/storage/mac">
              <LaptopIcon /> <span>Mac app</span>
            </Link>
          </nav>
        </aside>

        <section
          className={styles.main + " " + styles.dropZone + (dragging ? " " + styles.dropActive : "")}
          data-drop-label={"Drop to upload to " + (crumbs.at(-1) || "All files")}
          aria-busy={busy}
          {...dropProps}
        >
          <div className={styles.toolbar}>
            <form className={styles.search} onSubmit={(event) => { event.preventDefault(); void search(); }}>
              <SearchIcon />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" aria-label="Search Storage" />
              {query ? <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); setSearchResults(null); }}>×</button> : null}
            </form>
          </div>

          <div className={styles.titleRow}>
            <div className={styles.titleBlock}>
              {mode === "files" && crumbs.length > 0 && !searchResults ? (
                <nav className={styles.breadcrumbs} aria-label="Folder path">
                  <button type="button" onClick={() => void load("")}>All files</button>
                  {crumbs.slice(0, -1).map((crumb, index) => {
                    const path = crumbs.slice(0, index + 1).join("/");
                    return (
                      <span key={path}>
                        <span className={styles.crumbSep}>/</span>
                        <button type="button" onClick={() => void load(path)}>{crumb}</button>
                      </span>
                    );
                  })}
                </nav>
              ) : null}
              <h1>{searchResults ? "Results for “" + query + "”" : title}</h1>
            </div>
            {mode === "files" ? (
              <div className={styles.titleActions}>
                <div className={styles.menuWrap} onClick={(event) => event.stopPropagation()}>
                  <button type="button" className={styles.softButton} disabled={busy} onClick={() => setUploadOpen((open) => !open)}>
                    ↑ Upload <span aria-hidden="true">▾</span>
                  </button>
                  {uploadOpen ? (
                    <div className={styles.menu} role="menu">
                      <button type="button" role="menuitem" onClick={() => { setUploadOpen(false); filesRef.current?.click(); }}>Files</button>
                      <button type="button" role="menuitem" onClick={() => { setUploadOpen(false); folderRef.current?.click(); }}>Folder</button>
                    </div>
                  ) : null}
                </div>
                <button type="button" className={styles.softButton} disabled={busy} onClick={() => void createFolder()}>＋ New folder</button>
              </div>
            ) : null}
          </div>

          {mode === "files" ? (
            <div className={styles.subbar}>
              {selected.length > 0 ? (
                <div className={styles.selectionBar}>
                  <strong>{selected.length} selected</strong>
                  <button type="button" disabled={busy} onClick={sendSelection}>Send as transfer</button>
                  <button type="button" disabled={busy} onClick={() => void openMover(selected)}>Move</button>
                  <button type="button" disabled={busy} onClick={() => void remove(selected)}>Delete</button>
                  <button type="button" className={styles.clearSelection} onClick={() => setSelected([])}>Clear</button>
                </div>
              ) : (
                <span className={styles.countNote}>
                  {folders.length ? folders.length + (folders.length === 1 ? " folder" : " folders") : ""}
                  {folders.length && files.length ? " · " : ""}
                  {files.length ? files.length + (files.length === 1 ? " file" : " files") : ""}
                </span>
              )}
              <div className={styles.viewToggle} role="group" aria-label="View">
                <button className={view === "list" ? styles.viewActive : ""} type="button" onClick={() => setView("list")} title="List" aria-label="List view"><ListIcon /></button>
                <button className={view === "grid" ? styles.viewActive : ""} type="button" onClick={() => setView("grid")} title="Thumbnails" aria-label="Thumbnail view"><GridIcon /></button>
              </div>
            </div>
          ) : null}

          {message ? (
            <div className={styles.toast} aria-live="polite">
              <span>{message}</span>
              <button type="button" aria-label="Dismiss" onClick={() => setMessage("")}>×</button>
            </div>
          ) : null}

          {mode === "trash" ? (
            <>
              <p className={styles.trashNote}>Deleted items are kept for 30 days, then removed for good.</p>
              <div className={styles.table}>
                <div className={styles.headRow + " " + styles.trashCols}>
                  <span>Name</span><span>Was in</span><span>Deleted</span><span>Size</span><span />
                </div>
                {trash.map((entry) => (
                  <div className={styles.row + " " + styles.trashCols} key={entry.id}>
                    <span className={styles.nameCell}>
                      {entry.kind === "folder" ? <FolderIcon /> : <FileIcon name={entry.name} />}
                      <span className={styles.nameText}>
                        <strong>{entry.name}</strong>
                        {entry.kind === "folder" ? <small>{entry.itemCount} {entry.itemCount === 1 ? "file" : "files"}</small> : null}
                      </span>
                    </span>
                    <span className={styles.muted}>{entry.originalParent || "All files"}</span>
                    <span className={styles.muted}>{modified(entry.deletedAt)}</span>
                    <span className={styles.muted}>{bytes(entry.sizeBytes)}</span>
                    <span className={styles.rowButtons}>
                      <button type="button" className={styles.textButton} disabled={busy} onClick={() => void restore(entry)}>Restore</button>
                      <button type="button" className={styles.textButton + " " + styles.danger} disabled={busy} onClick={() => void deleteForever(entry)}>Delete forever</button>
                    </span>
                  </div>
                ))}
              </div>
              {!busy && !trash.length ? <p className={styles.empty}>Nothing has been deleted.</p> : null}
            </>
          ) : view === "list" ? (
            <div className={styles.table}>
              <div className={styles.headRow + " " + styles.listCols}>
                <span className={styles.checkCell}>
                  <input type="checkbox" aria-label="Select all" checked={allSelected} onChange={toggleAll} />
                </span>
                <button type="button" className={styles.sortButton} onClick={() => sortBy("name")}>Name {sortMark("name")}</button>
                <button type="button" className={styles.sortButton} onClick={() => sortBy("modified")}>Last modified {sortMark("modified")}</button>
                <button type="button" className={styles.sortButton} onClick={() => sortBy("size")}>Size {sortMark("size")}</button>
                <span />
              </div>
              {folders.map((folder) => {
                const checked = isSelected(folder.path);
                return (
                  <div
                    className={styles.row + " " + styles.listCols + (checked ? " " + styles.rowSelected : "")}
                    key={folder.path}
                    onDoubleClick={() => void load(folder.path)}
                  >
                    <span className={styles.checkCell}>
                      <input aria-label={"Select " + folder.name} type="checkbox" checked={checked} onChange={() => toggle(folderItem(folder))} />
                    </span>
                    <button className={styles.nameCell} type="button" onClick={() => void load(folder.path)}>
                      <FolderIcon />
                      <span className={styles.nameText}>
                        <strong>{folder.name}{sharedPaths.has(folder.path) ? <span className={styles.sharedTag}>Shared</span> : null}</strong>
                        {searchResults && parentOf(folder.path) ? <small>in {parentOf(folder.path)}</small> : null}
                      </span>
                    </button>
                    <span className={styles.muted}>—</span>
                    <span className={styles.muted}>—</span>
                    <span className={styles.rowButtons}>{itemMenu(folderItem(folder))}</span>
                  </div>
                );
              })}
              {files.map((file) => {
                const checked = isSelected(file.path);
                return (
                  <div className={styles.row + " " + styles.listCols + (checked ? " " + styles.rowSelected : "")} key={file.objectKey}>
                    <span className={styles.checkCell}>
                      <input aria-label={"Select " + file.name} type="checkbox" checked={checked} onChange={() => toggle(fileItem(file))} />
                    </span>
                    <button
                      className={styles.nameCell}
                      type="button"
                      onClick={() => (file.isImage && file.viewUrl ? openPreview(file) : toggle(fileItem(file)))}
                      title={file.name}
                    >
                      {file.isImage && file.viewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className={styles.rowThumb} src={file.viewUrl} alt="" loading="lazy" />
                      ) : (
                        <FileIcon name={file.name} />
                      )}
                      <span className={styles.nameText}>
                        <strong>{file.name}</strong>
                        {searchResults && parentOf(file.path) ? <small>in {parentOf(file.path)}</small> : null}
                      </span>
                    </button>
                    <span className={styles.muted}>{modified(file.lastModified)}</span>
                    <span className={styles.muted}>{bytes(file.sizeBytes)}</span>
                    <span className={styles.rowButtons}>
                      <button type="button" className={styles.hoverButton} onClick={() => void download(file)}>Download</button>
                      {itemMenu(fileItem(file), file)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.grid}>
              {folders.map((folder) => {
                const checked = isSelected(folder.path);
                return (
                  <article className={styles.tile + (checked ? " " + styles.tileSelected : "")} key={folder.path}>
                    <input className={styles.tileCheck} type="checkbox" aria-label={"Select " + folder.name} checked={checked} onChange={() => toggle(folderItem(folder))} />
                    <div className={styles.tileMenu}>{itemMenu(folderItem(folder))}</div>
                    <button type="button" className={styles.tileBody} onClick={() => void load(folder.path)}>
                      <span className={styles.tileArt}><FolderIcon size={88} /></span>
                      <strong>{folder.name}</strong>
                      <small>{sharedPaths.has(folder.path) ? "Shared folder" : searchResults && parentOf(folder.path) ? "in " + parentOf(folder.path) : "Folder"}</small>
                    </button>
                  </article>
                );
              })}
              {files.map((file) => {
                const checked = isSelected(file.path);
                return (
                  <article className={styles.tile + (checked ? " " + styles.tileSelected : "")} key={file.objectKey}>
                    <input className={styles.tileCheck} type="checkbox" aria-label={"Select " + file.name} checked={checked} onChange={() => toggle(fileItem(file))} />
                    <div className={styles.tileMenu}>{itemMenu(fileItem(file), file)}</div>
                    <button
                      type="button"
                      className={styles.tileBody}
                      onClick={() => (file.isImage && file.viewUrl ? openPreview(file) : void download(file))}
                      title={file.name}
                    >
                      <span className={styles.tileArt + (file.isImage && file.viewUrl ? " " + styles.tilePhoto : "")}>
                        {file.isImage && file.viewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={file.viewUrl} alt="" loading="lazy" />
                        ) : (
                          <FileIcon name={file.name} size={72} />
                        )}
                      </span>
                      <strong>{file.name}</strong>
                      <small>{bytes(file.sizeBytes)} · {modified(file.lastModified)}</small>
                    </button>
                  </article>
                );
              })}
            </div>
          )}

          {mode === "files" && !searchResults && listing.nextCursor ? (
            <div className={styles.loadMore}>
              <button type="button" className={styles.softButton} disabled={busy} onClick={() => void loadMore()}>Load more</button>
            </div>
          ) : null}

          {mode === "files" && !busy && !folders.length && !files.length ? (
            <div className={styles.emptyState}>
              <FolderIcon size={96} />
              <h2>{searchResults ? "No matches" : "This folder is empty"}</h2>
              <p>{searchResults ? "Try a different word or part of the file name." : "Drag files or folders here, or use Upload."}</p>
            </div>
          ) : null}

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

      {shareFor ? (
        <ShareDialog path={shareFor.path} name={shareFor.name} onClose={closeShare} onShared={() => void loadShared()} />
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
                    <FolderIcon size={24} /> {folder.name}
                  </button>
                );
              })}
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.softButton} onClick={() => setMover(null)}>Cancel</button>
              <button type="button" className={styles.primaryButton} disabled={mover.loading} onClick={() => void moveHere()}>
                Move to {mover.path.split("/").at(-1) || "All files"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
