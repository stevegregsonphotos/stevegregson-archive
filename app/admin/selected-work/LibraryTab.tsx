"use client";

/* eslint-disable @next/next/no-img-element -- photos come from our own image host at fixed sizes */

import { useEffect, useRef, useState, type DragEvent, type SyntheticEvent } from "react";

import {
  libraryDisplayUrl,
  libraryFullUrl,
  libraryPreviewUrl,
  type CategoryId,
  type SelectedWorkImage,
} from "./library/pipeline";
import type { LibraryApi } from "./library/useSelectedWorkLibrary";

import styles from "./backstage-selected-work.module.css";

const TILE_TYPE = "application/x-selected-work-tile";

/** Falls back to the full-size photo if a smaller copy is missing. */
export function fallbackToFull(category: CategoryId, filename: string) {
  return (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.dataset.fallback) return;
    image.dataset.fallback = "1";
    image.src = libraryFullUrl(category, filename);
  };
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function UploadZone({
  category,
  library,
  title,
  onUploaded,
}: {
  category: CategoryId;
  library: LibraryApi;
  title: string;
  onUploaded?: (files: Awaited<ReturnType<LibraryApi["uploadFiles"]>>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const progress = library.upload?.category === category ? library.upload : null;
  const done = progress?.files.filter((file) => file.state === "done").length ?? 0;
  const failed = progress?.files.filter((file) => file.state === "failed").length ?? 0;
  const total = progress?.files.length ?? 0;
  const describing = library.analysis?.category === category ? library.analysis : null;
  const disabled = Boolean(library.busy);

  async function start(files: File[]) {
    if (!files.length || disabled) return;
    const uploaded = await library.uploadFiles(category, files);
    if (uploaded.length) onUploaded?.(uploaded);
  }

  function isFileDrag(event: DragEvent) {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  return (
    <div
      className={over ? `${styles.dropzone} ${styles.dropzoneOver}` : styles.dropzone}
      onDragOver={(event) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        setOver(false);
        void start(Array.from(event.dataTransfer.files));
      }}
      data-testid={`dropzone-${category}`}
    >
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#c7a369" strokeWidth="1.5" aria-hidden="true">
        <path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" />
      </svg>
      <div className={styles.dropzoneText}>
        <p className={styles.dropzoneTitle}>{title}</p>
        <p className={styles.dropzoneSub}>
          Or{" "}
          <button type="button" className={styles.linkButton} disabled={disabled} onClick={() => inputRef.current?.click()}>
            choose files
          </button>
          . JPEG photographs only. They upload straight away, and Vision AI then writes a description and a suggested
          filename for each one.
        </p>
        <input
          ref={inputRef}
          className={styles.hiddenInput}
          type="file"
          accept="image/jpeg,.jpg,.jpeg"
          multiple
          disabled={disabled}
          data-testid={`file-input-${category}`}
          onChange={(event) => {
            const files = event.target.files ? Array.from(event.target.files) : [];
            event.target.value = "";
            void start(files);
          }}
        />
      </div>
      {progress ? (
        <div className={styles.progress} aria-live="polite">
          <div className={styles.progressHead}>
            <span>
              {describing
                ? `Describing ${describing.current} of ${describing.total} with AI…`
                : done + failed < total
                  ? `${total} uploading`
                  : failed
                    ? `${failed} could not be uploaded`
                    : `${total} uploaded`}
            </span>
            <span className={styles.hint}>
              {done} of {total} done
            </span>
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
          </div>
          <div className={styles.progressFiles}>
            {progress.files.map((file, index) => (
              <span key={`${file.name}-${index}`} className={file.state === "failed" ? styles.fileFailed : undefined}>
                {file.state === "done" ? "✓" : file.state === "failed" ? "✕" : "…"} {file.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function LibraryTab({
  category,
  images,
  library,
  uploadTitle,
  onField,
  onReorder,
  usedOnPage,
}: {
  category: CategoryId;
  images: SelectedWorkImage[];
  library: LibraryApi;
  uploadTitle: string;
  onField: (filename: string, field: "alt" | "suggestedFilename", value: string) => void;
  onReorder: (from: number, to: number) => void;
  usedOnPage?: (filename: string) => boolean;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const selection = library.selection[category];
  const busy = Boolean(library.busy);
  const activeIndex = active ? images.findIndex((image) => image.filename === active) : -1;
  const activeImage = activeIndex >= 0 ? images[activeIndex] : null;
  const pendingCount = images.filter((image) => image.analysisStatus === "pending").length;
  const { selectAll, clearSelection } = library;

  // Keyboard shortcuts from the old screen: Ctrl/Cmd+A selects all, Escape clears.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
      if (event.key === "Escape" && !typing) {
        clearSelection(category);
        return;
      }
      if (!typing && event.key.toLowerCase() === "a" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        selectAll(category);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [category, selectAll, clearSelection]);

  function finishDrag() {
    setDragFrom(null);
    setDragOver(null);
  }

  function drop(target: number) {
    if (dragFrom === null) return;
    const to = target > dragFrom ? target - 1 : target;
    if (to !== dragFrom) onReorder(dragFrom, to);
    finishDrag();
  }

  return (
    <div>
      <UploadZone
        category={category}
        library={library}
        title={uploadTitle}
        onUploaded={(files) => setActive(files[files.length - 1]?.filename ?? null)}
      />

      {selection.size > 0 ? (
        <div className={styles.selectBar} role="toolbar" aria-label="Selected photos">
          <span className={styles.selectCount}>{selection.size} selected</span>
          <span className={styles.divider} />
          <button
            type="button"
            className={styles.btn}
            disabled={busy}
            onClick={() => void library.analyse(category, images.filter((image) => selection.has(image.filename)).map((image) => image.filename))}
          >
            Describe with AI
          </button>
          <button
            type="button"
            className={styles.btnDanger}
            disabled={busy}
            onClick={async () => {
              const names = images.filter((image) => selection.has(image.filename)).map((image) => image.filename);
              const removed = await library.remove(category, names);
              if (removed && active && names.includes(active)) setActive(null);
            }}
          >
            Remove
          </button>
          <span className={styles.spacer} />
          <button type="button" className={styles.quietButton} onClick={() => library.selectAll(category)}>
            Select all
          </button>
          <button type="button" className={styles.quietButton} onClick={() => library.clearSelection(category)}>
            Clear selection
          </button>
        </div>
      ) : (
        <div className={styles.actions}>
          <button type="button" className={styles.btn} disabled={busy || !images.length} onClick={() => library.selectAll(category)}>
            Select all
          </button>
          {pendingCount ? (
            <button type="button" className={styles.btn} disabled={busy} onClick={() => void library.analyseNew(category)}>
              {library.analysis?.category === category
                ? `Describing ${library.analysis.current} of ${library.analysis.total}…`
                : `Describe new photos with AI (${pendingCount})`}
            </button>
          ) : null}
          <span className={styles.spacer} />
          <span className={styles.hint}>
            Shown in page order. Drag to reorder, tick to select several, click to see details.
          </span>
        </div>
      )}

      {library.busy ? <p className={styles.status}>{library.busy}</p> : null}
      {!library.busy && library.message ? <p className={styles.status} role="status">{library.message}</p> : null}
      {library.error ? <p className={styles.errorText} role="alert">{library.error}</p> : null}

      <div className={styles.workspace}>
        {images.length === 0 ? (
          <p className={styles.empty}>No photographs here yet. Drop some into the box above.</p>
        ) : (
          <div className={styles.libGrid} data-testid={`grid-${category}`}>
            {images.map((image, index) => {
              const checked = selection.has(image.filename);
              const isNew = library.recent.has(image.filename);
              const classes = [
                styles.libTile,
                checked || active === image.filename ? styles.tileChecked : "",
                dragFrom === index ? styles.tileDragging : "",
                dragOver === index && dragFrom !== null && dragFrom !== index && dragFrom !== index - 1 ? styles.dropBefore : "",
              ].join(" ");

              return (
                <figure
                  key={image.filename}
                  className={classes}
                  draggable={!busy}
                  tabIndex={0}
                  aria-label={`Photo ${index + 1}: ${image.alt || image.filename}`}
                  data-testid="library-tile"
                  onClick={() => setActive(image.filename)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setActive(image.filename);
                    }
                  }}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(TILE_TYPE, image.filename);
                    event.dataTransfer.effectAllowed = "move";
                    setDragFrom(index);
                  }}
                  onDragOver={(event) => {
                    if (dragFrom === null) return;
                    event.preventDefault();
                    setDragOver(index);
                  }}
                  onDrop={(event) => {
                    if (dragFrom === null) return;
                    event.preventDefault();
                    drop(index);
                  }}
                  onDragEnd={finishDrag}
                >
                  <img
                    src={libraryPreviewUrl(category, image.filename)}
                    alt={image.alt}
                    loading="lazy"
                    onError={fallbackToFull(category, image.filename)}
                  />
                  <span className={styles.num}>{index + 1}</span>
                  <button
                    type="button"
                    className={checked ? `${styles.tickBox} ${styles.tickBoxOn}` : styles.tickBox}
                    aria-label={checked ? "Unselect photo" : "Select photo"}
                    aria-pressed={checked}
                    onClick={(event) => {
                      event.stopPropagation();
                      library.toggleSelected(category, image.filename);
                    }}
                  >
                    {checked ? "✓" : ""}
                  </button>
                  <figcaption
                    className={
                      isNew || image.analysisStatus === "pending" ? `${styles.libCaption} ${styles.libCaptionNew}` : styles.libCaption
                    }
                  >
                    {image.analysisStatus === "pending"
                      ? isNew
                        ? "New · waiting for a description"
                        : "Needs a description"
                      : isNew
                        ? "New · described by AI"
                        : image.alt || image.filename}
                  </figcaption>
                </figure>
              );
            })}
            {dragFrom !== null ? (
              <div
                className={dragOver === images.length ? `${styles.dropEnd} ${styles.dropEndActive}` : styles.dropEnd}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(images.length);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  drop(images.length);
                }}
              >
                Drop here to move to the end
              </div>
            ) : null}
          </div>
        )}

        {activeImage ? (
          <aside className={styles.panel} aria-label="Photo details" data-testid="library-panel">
            <div className={styles.panelHead}>
              <span className={styles.kicker}>
                Photo {activeIndex + 1} of {images.length}
                {library.recent.has(activeImage.filename) ? " · just uploaded" : ""}
              </span>
              <button type="button" className={styles.close} aria-label="Close details" onClick={() => setActive(null)}>
                ×
              </button>
            </div>
            <img
              className={`${styles.preview} ${styles.previewContain}`}
              src={libraryDisplayUrl(category, activeImage.filename)}
              alt={activeImage.alt}
              onError={fallbackToFull(category, activeImage.filename)}
            />
            <label className={styles.field}>
              Description for Google and screen readers
              <textarea
                className={styles.textarea}
                rows={4}
                value={activeImage.alt}
                onChange={(event) => onField(activeImage.filename, "alt", event.target.value)}
              />
            </label>
            <div className={styles.aiRow}>
              {activeImage.analysisStatus === "complete" ? (
                <span className={styles.aiOk}>✓ Described{activeImage.analysedAt ? " by Vision AI" : ""}</span>
              ) : (
                <span className={styles.aiPending}>Waiting for a description</span>
              )}
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSmall}`}
                disabled={busy}
                onClick={() => void library.analyse(category, [activeImage.filename])}
              >
                {activeImage.analysisStatus === "complete" ? "Rewrite with AI" : "Describe with AI"}
              </button>
            </div>
            <div className={styles.buttons2}>
              <button
                type="button"
                className={styles.btn}
                disabled={busy}
                onClick={() => library.openEditor(category, activeImage.filename)}
              >
                Edit / crop
              </button>
              <button
                type="button"
                className={styles.btnDanger}
                disabled={busy}
                onClick={async () => {
                  if (await library.remove(category, [activeImage.filename])) setActive(null);
                }}
              >
                Remove
              </button>
            </div>
            <div className={styles.buttons2}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSmall}`}
                disabled={busy || activeIndex === 0}
                onClick={() => onReorder(activeIndex, activeIndex - 1)}
              >
                ← Move earlier
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSmall}`}
                disabled={busy || activeIndex === images.length - 1}
                onClick={() => onReorder(activeIndex, activeIndex + 1)}
              >
                Move later →
              </button>
            </div>
            {usedOnPage?.(activeImage.filename) ? (
              <p className={styles.sizeNote}>This photo is on the Production page.</p>
            ) : null}
            <details className={styles.details}>
              <summary>File details</summary>
              <div className={styles.detailsBody}>
                <span>
                  Filename: <strong>{activeImage.filename}</strong>
                </span>
                <label className={styles.field}>
                  New filename (applied when you press Save &amp; publish)
                  <input
                    className={styles.input}
                    value={activeImage.suggestedFilename ?? ""}
                    placeholder="Leave empty to keep the current name"
                    onChange={(event) => onField(activeImage.filename, "suggestedFilename", event.target.value)}
                  />
                </label>
                {activeImage.width && activeImage.height ? (
                  <span>
                    {activeImage.width} × {activeImage.height} pixels
                  </span>
                ) : null}
                {activeImage.uploadedAt ? <span>Uploaded {formatDate(activeImage.uploadedAt)}</span> : null}
                {activeImage.originalFilename && activeImage.originalFilename !== activeImage.filename ? (
                  <span>
                    Edited from <strong>{activeImage.originalFilename}</strong>
                  </span>
                ) : null}
              </div>
            </details>
          </aside>
        ) : images.length ? (
          <aside className={styles.panel}>
            <p className={styles.panelEmpty}>
              Click a photo to see its description, rewrite it with AI, edit or crop it, or remove it.
            </p>
            <p className={styles.sizeNote}>
              Uploads, removals, AI descriptions and edits happen straight away. Changes to the order, descriptions
              and filenames go live when you press Save &amp; publish.
            </p>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
