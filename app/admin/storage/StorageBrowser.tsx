"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./storage.module.css";

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
type Listing = {
  path: string;
  folders: Folder[];
  files: FileItem[];
  nextCursor?: string;
  truncated: boolean;
};

function bytes(value: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value, unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return (size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)) + " " + units[unit];
}

function joinPath(base: string, relative: string) {
  return [base, relative].filter(Boolean).join("/").replace(/\/+/g, "/");
}

export default function StorageBrowser() {
  const [listing, setListing] = useState<Listing>({ path: "", folders: [], files: [], truncated: false });
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const folderRef = useRef<HTMLInputElement | null>(null);

  async function load(path = listing.path) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/storage?path=" + encodeURIComponent(path), { cache: "no-store" });
      const data = await response.json();
      if (!data.ok) throw new Error(data.message || "Could not load storage.");
      setListing(data.listing);
      setMessage("");
      setLoaded(true);
      setSelectedFiles([]);
      setSelectedFolders([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load storage.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(""); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return { folders: listing.folders, files: listing.files };
    return {
      folders: listing.folders.filter((item) => item.name.toLowerCase().includes(q)),
      files: listing.files.filter((item) => item.name.toLowerCase().includes(q)),
    };
  }, [listing, search]);

  async function upload(files: FileList | null, folderMode = false) {
    if (!files?.length) return;
    setBusy(true);
    try {
      let done = 0;
      for (const file of Array.from(files)) {
        const relative = folderMode
          ? ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name)
          : file.name;
        const path = joinPath(listing.path, relative);
        setMessage("Uploading " + (done + 1) + " of " + files.length + " · " + file.name);
        const signResponse = await fetch("/api/admin/storage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "presign-upload", path }),
        });
        const signed = await signResponse.json();
        if (!signed.ok) throw new Error(signed.message || "Could not prepare upload.");
        const put = await fetch(signed.uploadUrl, { method: "PUT", body: file });
        if (!put.ok) throw new Error("Upload failed for " + file.name + " (HTTP " + put.status + ").");
        done += 1;
      }
      setMessage(files.length + (files.length === 1 ? " file uploaded." : " files uploaded."));
      await load(listing.path);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function download(file: FileItem) {
    const response = await fetch("/api/admin/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "download", objectKey: file.objectKey, name: file.name }),
    });
    const data = await response.json();
    if (data.ok) window.location.assign(data.url);
    else setMessage(data.message || "Download unavailable.");
  }

  async function remove(file: FileItem) {
    if (!confirm("Delete " + file.name + " from the client archive?")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-file", objectKey: file.objectKey }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.message || "Delete failed.");
      await load(listing.path);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }


  function toggleFile(objectKey: string) {
    setSelectedFiles((current) => current.includes(objectKey) ? current.filter((key) => key !== objectKey) : [...current, objectKey]);
  }

  function toggleFolder(path: string) {
    setSelectedFolders((current) => current.includes(path) ? current.filter((item) => item !== path) : [...current, path]);
  }

  function sendSelection() {
    if (!selectedFiles.length && !selectedFolders.length) return;
    sessionStorage.setItem("backstage-transfer-archive-selection", JSON.stringify({
      objectKeys: selectedFiles,
      folderPaths: selectedFolders,
    }));
    window.location.assign("/admin/transfers?archive=1");
  }

  const crumbs = listing.path ? listing.path.split("/") : [];

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <div>
          <p>Steve Gregson · Client archive</p>
          <h1>Storage</h1>
          <span>Long-term client files in Backblaze B2. Uploads and downloads travel directly between this browser and storage.</span>
        </div>
        <div className={styles.actions}>
          {(selectedFiles.length > 0 || selectedFolders.length > 0) && <button type="button" onClick={sendSelection}>Send selected ({selectedFiles.length + selectedFolders.length})</button>}
          <label><input type="file" multiple onChange={(e) => void upload(e.target.files)} />+ Add files</label>
          <button type="button" onClick={() => folderRef.current?.click()}>+ Add folder</button>
          <input ref={folderRef} className={styles.hidden} type="file" multiple {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)} onChange={(e) => void upload(e.target.files, true)} />
        </div>
      </header>

      <div className={styles.toolbar}>
        <nav aria-label="Archive path">
          <button type="button" onClick={() => void load("")}>Storage</button>
          {crumbs.map((crumb, index) => {
            const path = crumbs.slice(0, index + 1).join("/");
            return <span key={path}> / <button type="button" onClick={() => void load(path)}>{crumb}</button></span>;
          })}
        </nav>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter this folder" />
      </div>

      {message && <p className={styles.message} aria-live="polite">{message}</p>}

      <section className={styles.grid} aria-busy={busy}>
        {filtered.folders.map((folder) => (
          <article className={styles.folder} key={folder.path}>
            <label className={styles.select}><input type="checkbox" checked={selectedFolders.includes(folder.path)} onChange={() => toggleFolder(folder.path)} /> Select</label>
            <button className={styles.folderOpen} type="button" onClick={() => void load(folder.path)}>
              <span className={styles.folderIcon}>▰</span>
              <strong>{folder.name}</strong>
              <small>Folder</small>
            </button>
          </article>
        ))}
        {filtered.files.map((file) => (
          <article className={styles.file} key={file.objectKey}>
            <label className={styles.select}><input type="checkbox" checked={selectedFiles.includes(file.objectKey)} onChange={() => toggleFile(file.objectKey)} /> Select</label>
            <div className={styles.thumb}>
              {file.isImage && file.viewUrl ? <img src={file.viewUrl} alt="" /> : <span>FILE</span>}
            </div>
            <div className={styles.fileMeta}>
              <strong title={file.name}>{file.name}</strong>
              <span>{bytes(file.sizeBytes)}{file.lastModified ? " · " + new Date(file.lastModified).toLocaleDateString("en-GB") : ""}</span>
            </div>
            <div className={styles.fileActions}>
              <button type="button" onClick={() => void download(file)}>Download</button>
              <button type="button" onClick={() => void remove(file)}>Delete</button>
            </div>
          </article>
        ))}
        {!busy && !filtered.folders.length && !filtered.files.length && <p className={styles.empty}>This folder is empty.</p>}
      </section>

      {listing.truncated && <button className={styles.loadMore} type="button" onClick={async () => {
        if (!listing.nextCursor) return;
        setBusy(true);
        try {
          const response = await fetch("/api/admin/storage?path=" + encodeURIComponent(listing.path) + "&cursor=" + encodeURIComponent(listing.nextCursor), { cache: "no-store" });
          const data = await response.json();
          if (!data.ok) throw new Error(data.message || "Could not load more files.");
          setListing((current) => ({ ...data.listing, folders: [...current.folders, ...data.listing.folders], files: [...current.files, ...data.listing.files] }));
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Could not load more files.");
        } finally { setBusy(false); }
      }}>Load more</button>}
      {loaded && !busy && listing.path === "" && !listing.folders.length && !listing.files.length && <p className={styles.notice}>Archive ready. Add a client folder from your Mac to begin.</p>}
    </main>
  );
}
