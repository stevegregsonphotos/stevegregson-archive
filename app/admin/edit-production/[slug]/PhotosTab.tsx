"use client";

/* eslint-disable @next/next/no-img-element -- photos come from our own image host at fixed sizes */

import { useEffect, useRef, useState, type DragEvent, type SyntheticEvent } from "react";

import {
  DEFAULT_PRODUCTION_GALLERY_LAYOUT,
  PRODUCTION_GALLERY_LAYOUT_OPTIONS,
  type ProductionGalleryLayout,
} from "../../../../lib/production-gallery-layouts";
import { getProductionCardImageUrl, getProductionImageUrl } from "../../../../lib/production-image-url";

import GalleryLayoutPicker from "./GalleryLayoutPicker";
import {
  LAYOUT_OPTIONS,
  layoutLabel,
  needsDescription,
  type Doc,
  type GalleryLayout,
  type ProductionImage,
} from "./editor-state";

import sw from "../../selected-work/backstage-selected-work.module.css";
import styles from "./production-edit.module.css";

type Change = (label: string, key: string | undefined, mutate: (doc: Doc) => Doc) => void;

type VisionResult = {
  ok: boolean;
  metadata?: { alt: string; filename: string; layout: GalleryLayout };
  message?: string;
};

export const HERO_TILE = "__hero__";
const TILE_TYPE = "application/x-production-photo";

function fallbackToFull(slug: string, src: string) {
  return (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.dataset.fallback) return;
    image.dataset.fallback = "1";
    image.src = getProductionImageUrl(slug, src);
  };
}

export type UploadProgress = { completed: number; total: number } | null;

export default function PhotosTab({
  slug,
  doc,
  publishedHero,
  publishedHeroAlt,
  publishedGalleryLayout,
  change,
  active,
  setActive,
  selection,
  setSelection,
  recent,
  uploadProgress,
  busy,
  onUpload,
  onEditImage,
}: {
  slug: string;
  doc: Doc;
  publishedHero: string;
  publishedHeroAlt: string;
  publishedGalleryLayout: ProductionGalleryLayout;
  change: Change;
  active: string | null;
  setActive: (src: string | null) => void;
  selection: Set<string>;
  setSelection: (next: Set<string>) => void;
  recent: Set<string>;
  uploadProgress: UploadProgress;
  busy: boolean;
  onUpload: (files: File[]) => void;
  onEditImage: (image: ProductionImage) => void;
}) {
  const images = doc.images;
  const [analysis, setAnalysis] = useState<{ current: number; total: number; src: string } | null>(null);
  const [aiError, setAiError] = useState<{ src: string | null; message: string } | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const heroChanged = doc.hero !== publishedHero;
  const presetActive = doc.galleryLayout !== DEFAULT_PRODUCTION_GALLERY_LAYOUT;
  const presetName = PRODUCTION_GALLERY_LAYOUT_OPTIONS.find((option) => option.value === doc.galleryLayout)?.name;
  const selected = images.filter((image) => selection.has(image.src));
  const remaining = images.filter(needsDescription);
  const describedCount = images.length - remaining.length;
  const working = busy || analysis !== null;
  const activeIndex = active && active !== HERO_TILE ? images.findIndex((image) => image.src === active) : -1;
  const activeImage = activeIndex >= 0 ? images[activeIndex] : null;

  // Keyboard shortcuts: Ctrl/Cmd+A selects every photo, Escape clears the selection.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;
      if (typing) return;
      if (event.key === "Escape") {
        setSelection(new Set());
      } else if (event.key.toLowerCase() === "a" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSelection(new Set(images.map((image) => image.src)));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images, setSelection]);

  function open(src: string) {
    setActive(src);
    // On narrow screens the details panel sits below the photographs.
    if (window.matchMedia("(max-width: 1100px)").matches) {
      window.setTimeout(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }

  function updateImage(src: string, label: string, key: string | undefined, changes: Partial<ProductionImage>) {
    change(label, key, (current) => ({
      ...current,
      images: current.images.map((image) => (image.src === src ? { ...image, ...changes } : image)),
    }));
  }

  function setLayouts(srcs: string[], layout: GalleryLayout) {
    const set = new Set(srcs);
    change(srcs.length === 1 ? "Layout changed" : `Layout set on ${srcs.length} photos`, undefined, (current) => ({
      ...current,
      images: current.images.map((image) => (set.has(image.src) ? { ...image, layout } : image)),
    }));
  }

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= images.length) return;
    change("Photos reordered", undefined, (current) => {
      const next = [...current.images];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...current, images: next };
    });
  }

  function remove(srcs: string[]) {
    const removable = srcs.filter((src) => src !== doc.hero);
    if (!removable.length) return;
    const set = new Set(removable);
    change(removable.length === 1 ? "Photo removed" : `${removable.length} photos removed`, undefined, (current) => ({
      ...current,
      images: current.images.filter((image) => !set.has(image.src)),
    }));
    const nextSelection = new Set(selection);
    removable.forEach((src) => nextSelection.delete(src));
    setSelection(nextSelection);
    if (active && set.has(active)) setActive(null);
  }

  /** Describe photos with Vision AI one at a time; one Undo step for the batch. */
  async function analyse(srcs: string[]) {
    if (working || !srcs.length) return;
    const batchKey = `ai:${Date.now()}`;
    setAiError(null);
    for (let index = 0; index < srcs.length; index += 1) {
      const src = srcs[index];
      setAnalysis({ current: index + 1, total: srcs.length, src });
      try {
        const response = await fetch("/api/admin/vision/analyse-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, image: src }),
        });
        let result: VisionResult | null = null;
        try {
          result = (await response.json()) as VisionResult;
        } catch {
          result = null;
        }
        if (!response.ok || !result?.ok || !result.metadata) {
          throw new Error(result?.message ?? `Vision AI could not analyse ${src}.`);
        }
        const metadata = result.metadata;
        updateImage(src, srcs.length === 1 ? "Described with AI" : `Described ${srcs.length} photos with AI`, batchKey, {
          alt: metadata.alt,
          suggestedFilename: metadata.filename,
          layout: metadata.layout,
          analysisStatus: "complete",
          analysedAt: new Date().toISOString(),
        });
      } catch (caught) {
        setAiError({
          src: srcs.length === 1 ? src : null,
          message: caught instanceof Error ? caught.message : "Vision AI analysis failed.",
        });
        break;
      }
    }
    setAnalysis(null);
  }

  function isFileDrag(event: DragEvent) {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  function finishDrag() {
    setDragFrom(null);
    setDragOver(null);
  }

  function drop(target: number) {
    if (dragFrom === null) return;
    const to = target > dragFrom ? target - 1 : target;
    if (to !== dragFrom) move(dragFrom, to);
    finishDrag();
  }

  const layoutControls = (image: ProductionImage) => (
    <div className={styles.panelSection}>
      <span className={styles.panelLabel}>Layout on the page</span>
      {presetActive ? (
        <p className={styles.overrideNote} data-testid="preset-override-note">
          The gallery layout “{presetName}” is in use, so this setting is not shown on the site at the moment. It is
          kept for if you switch back to “As set per photo”.
        </p>
      ) : null}
      <div className={presetActive ? `${styles.layoutButtons} ${styles.layoutMuted}` : styles.layoutButtons}>
        {LAYOUT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={image.layout === option.value ? `${styles.layoutButton} ${styles.layoutButtonOn}` : styles.layoutButton}
            aria-pressed={image.layout === option.value}
            onClick={() => setLayouts([image.src], option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <GalleryLayoutPicker
        value={doc.galleryLayout}
        published={publishedGalleryLayout}
        images={images}
        slug={slug}
        onChange={(layout) => {
          if (layout === doc.galleryLayout) return;
          change("Gallery layout changed", "gallery-layout", (current) => ({ ...current, galleryLayout: layout }));
        }}
      />

      <div
        className={over ? `${sw.dropzone} ${sw.dropzoneOver}` : sw.dropzone}
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
          if (!busy) onUpload(Array.from(event.dataTransfer.files));
        }}
        data-testid="dropzone"
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#c7a369" strokeWidth="1.5" aria-hidden="true">
          <path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" />
        </svg>
        <div className={sw.dropzoneText}>
          <p className={sw.dropzoneTitle}>Drop photographs here to add them to {doc.title || "this production"}</p>
          <p className={sw.dropzoneSub}>
            Or{" "}
            <button type="button" className={sw.linkButton} disabled={busy} onClick={() => inputRef.current?.click()}>
              choose files
            </button>{" "}
            (JPEG, PNG or WebP). Add as many as you like at once. They upload straight away and join the gallery when
            you press Save &amp; publish.
          </p>
          <input
            ref={inputRef}
            className={sw.hiddenInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy}
            data-testid="file-input"
            onChange={(event) => {
              const files = event.target.files ? Array.from(event.target.files) : [];
              event.target.value = "";
              if (files.length) onUpload(files);
            }}
          />
        </div>
        {uploadProgress ? (
          <div className={sw.progress} aria-live="polite">
            <div className={sw.progressHead}>
              <span>
                Uploading {uploadProgress.completed} of {uploadProgress.total} photographs…
              </span>
            </div>
            <div className={sw.progressTrack}>
              <div
                className={sw.progressFill}
                style={{
                  width: `${uploadProgress.total ? Math.round((uploadProgress.completed / uploadProgress.total) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {selection.size > 0 ? (
        <div className={sw.selectBar} role="toolbar" aria-label="Selected photos" data-testid="select-bar">
          <span className={sw.selectCount}>{selected.length} selected</span>
          <span className={sw.divider} />
          <button type="button" className={sw.btn} disabled={working} onClick={() => void analyse(selected.map((image) => image.src))}>
            Describe with AI
          </button>
          <select
            className={styles.bulkLayout}
            aria-label="Set layout for the selected photos"
            value=""
            disabled={working}
            onChange={(event) => {
              const layout = event.target.value as GalleryLayout;
              if (layout) setLayouts(selected.map((image) => image.src), layout);
            }}
            data-testid="bulk-layout"
          >
            <option value="">Set layout ▾</option>
            {LAYOUT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={sw.btnDanger}
            disabled={working}
            onClick={() => {
              const srcs = selected.map((image) => image.src);
              const includesHero = srcs.includes(doc.hero);
              const count = srcs.filter((src) => src !== doc.hero).length;
              if (!count) {
                window.alert("The hero photograph can’t be removed. Choose a different hero first.");
                return;
              }
              const message =
                `Remove ${count} ${count === 1 ? "photograph" : "photographs"} from the gallery?` +
                (includesHero ? "\n\nThe hero photograph is selected too; it will be kept." : "") +
                "\n\nThey come off the site when you press Save & publish. You can Undo before then.";
              if (window.confirm(message)) remove(srcs);
            }}
            data-testid="bulk-remove"
          >
            Remove
          </button>
          <span className={sw.spacer} />
          <button type="button" className={sw.quietButton} onClick={() => setSelection(new Set(images.map((image) => image.src)))}>
            Select all
          </button>
          <button type="button" className={sw.quietButton} onClick={() => setSelection(new Set())}>
            Clear selection
          </button>
        </div>
      ) : (
        <div className={sw.actions}>
          <button
            type="button"
            className={sw.btn}
            disabled={!images.length}
            onClick={() => setSelection(new Set(images.map((image) => image.src)))}
          >
            Select all
          </button>
          <span className={sw.spacer} />
          <span className={sw.hint}>
            {describedCount} of {images.length} described by AI
          </span>
          <button
            type="button"
            className={sw.btn}
            disabled={working || remaining.length === 0}
            onClick={() => void analyse(remaining.map((image) => image.src))}
            data-testid="analyse-all"
          >
            {analysis && analysis.total > 1
              ? `Describing ${analysis.current} of ${analysis.total}…`
              : remaining.length === 0
                ? "All photos described"
                : `Describe ${remaining.length} with AI`}
          </button>
        </div>
      )}

      {analysis ? (
        <p className={sw.status} role="status">
          Describing {analysis.current} of {analysis.total} with AI…
        </p>
      ) : null}
      {aiError && aiError.src === null ? (
        <p className={sw.errorText} role="alert">
          {aiError.message}
        </p>
      ) : null}
      <p className={sw.hint} style={{ margin: "12px 0 0" }}>
        Drag photographs to change their order on the page · click a photo to edit it · tick the box to select several
      </p>

      <div className={sw.workspace}>
        <div className={styles.photoGrid} data-testid="photo-grid">
          <figure
            className={active === HERO_TILE ? `${styles.photoTile} ${styles.photoTileActive}` : styles.photoTile}
            tabIndex={0}
            aria-label={`Hero image: ${publishedHeroAlt || publishedHero}`}
            onClick={() => open(HERO_TILE)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open(HERO_TILE);
              }
            }}
            data-testid="hero-tile"
          >
            <div className={styles.photoFrame}>
              <img
                src={getProductionCardImageUrl(slug, publishedHero)}
                alt={publishedHeroAlt}
                loading="lazy"
                onError={fallbackToFull(slug, publishedHero)}
              />
              <span className={`${styles.heroBadge} ${styles.heroBadgeSolo}`}>{heroChanged ? "HERO NOW" : "HERO"}</span>
            </div>
            <figcaption className={styles.photoCaption}>
              <span className={styles.photoName} title={publishedHero}>
                {publishedHero}
              </span>
              <span className={styles.photoChip}>{heroChanged ? "Moves to gallery" : "Top of page"}</span>
            </figcaption>
          </figure>

          {images.map((image, index) => {
            const checked = selection.has(image.src);
            const isHero = image.src === doc.hero;
            const isNew = recent.has(image.src);
            const classes = [
              styles.photoTile,
              active === image.src ? styles.photoTileActive : "",
              checked ? styles.photoTileChecked : "",
              dragFrom === index ? styles.photoTileDragging : "",
              dragOver === index && dragFrom !== null && dragFrom !== index && dragFrom !== index - 1
                ? styles.photoTileDropBefore
                : "",
            ].join(" ");
            return (
              <figure
                key={image.src}
                className={classes}
                draggable={!working}
                tabIndex={0}
                aria-label={`Photo ${index + 1}: ${image.alt || image.src}`}
                data-testid="photo-tile"
                onClick={() => open(image.src)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    open(image.src);
                  }
                }}
                onDragStart={(event) => {
                  event.dataTransfer.setData(TILE_TYPE, image.src);
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
                <div className={styles.photoFrame}>
                  <img
                    src={getProductionCardImageUrl(slug, image.src)}
                    alt={image.alt}
                    loading="lazy"
                    onError={fallbackToFull(slug, image.src)}
                  />
                  <span className={sw.num}>{index + 1}</span>
                  {isHero ? (
                    <span className={`${styles.heroBadge} ${styles.heroBadgePending}`}>NEW HERO · NOT SAVED</span>
                  ) : null}
                  <button
                    type="button"
                    className={checked ? `${sw.tickBox} ${sw.tickBoxOn}` : sw.tickBox}
                    aria-label={checked ? `Unselect photo ${index + 1}` : `Select photo ${index + 1}`}
                    aria-pressed={checked}
                    onClick={(event) => {
                      event.stopPropagation();
                      const next = new Set(selection);
                      if (next.has(image.src)) next.delete(image.src);
                      else next.add(image.src);
                      setSelection(next);
                    }}
                  >
                    {checked ? "✓" : ""}
                  </button>
                </div>
                <figcaption className={styles.photoCaption}>
                  <span className={styles.photoName} title={image.src}>
                    {image.src}
                  </span>
                  <span className={isNew ? `${styles.photoChip} ${styles.photoChipNew}` : styles.photoChip}>
                    {[isNew ? "New" : "", presetActive ? "" : layoutLabel(image.layout)].filter(Boolean).join(" · ")}
                  </span>
                </figcaption>
              </figure>
            );
          })}
          {dragFrom !== null ? (
            <div
              className={dragOver === images.length ? `${sw.dropEnd} ${sw.dropEndActive}` : sw.dropEnd}
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

        {active === HERO_TILE ? (
          <aside ref={panelRef} className={sw.panel} aria-label="Hero details" data-testid="photo-panel">
            <div className={sw.panelHead}>
              <span className={sw.kicker}>Hero image</span>
              <button type="button" className={sw.close} aria-label="Close details" onClick={() => setActive(null)}>
                ×
              </button>
            </div>
            <img
              className={`${sw.preview} ${sw.previewContain}`}
              src={getProductionImageUrl(slug, publishedHero)}
              alt={publishedHeroAlt}
            />
            <p className={sw.sizeNote}>
              The large picture at the top of the production page. To change it, click a photograph in the gallery
              and choose “Set as hero”. The hero can’t be removed.
            </p>
            <label className={sw.field}>
              Description for Google and screen readers
              <textarea className={sw.textarea} rows={3} value={publishedHeroAlt} readOnly />
            </label>
            {heroChanged ? (
              <div className={styles.panelSection}>
                <span className={styles.panelLabel}>Hero</span>
                <p className={sw.sizeNote}>
                  {doc.hero} will become the hero when you save; this photograph will move to the start of the gallery.
                </p>
                <button
                  type="button"
                  className={styles.heroButton}
                  onClick={() => change("Hero changed", undefined, (current) => ({ ...current, hero: publishedHero }))}
                >
                  Keep this as the hero
                </button>
              </div>
            ) : null}
            <details className={sw.details}>
              <summary>File details</summary>
              <div className={sw.detailsBody}>
                <span>
                  Filename: <strong>{publishedHero}</strong>
                </span>
              </div>
            </details>
          </aside>
        ) : activeImage ? (
          <aside ref={panelRef} className={sw.panel} aria-label="Photo details" data-testid="photo-panel">
            <div className={sw.panelHead}>
              <span className={sw.kicker}>
                Photo {activeIndex + 1} of {images.length}
                {recent.has(activeImage.src) ? " · just uploaded" : ""}
              </span>
              <button type="button" className={sw.close} aria-label="Close details" onClick={() => setActive(null)}>
                ×
              </button>
            </div>
            <img
              className={`${sw.preview} ${sw.previewContain}`}
              src={getProductionImageUrl(slug, activeImage.src)}
              alt={activeImage.alt}
            />
            <label className={sw.field}>
              Description for Google and screen readers
              <textarea
                className={sw.textarea}
                rows={4}
                value={activeImage.alt}
                placeholder="Describe what is visually important"
                onChange={(event) =>
                  updateImage(activeImage.src, "Photo description edited", `alt:${activeImage.src}`, { alt: event.target.value })
                }
                data-testid="panel-alt"
              />
            </label>
            <div className={sw.aiRow}>
              {needsDescription(activeImage) ? (
                <span className={sw.aiPending}>Placeholder · not yet described</span>
              ) : (
                <span className={sw.aiOk}>✓ Described{activeImage.analysedAt ? " by Vision AI" : ""}</span>
              )}
              <button
                type="button"
                className={`${sw.btn} ${sw.btnSmall}`}
                disabled={working}
                onClick={() => void analyse([activeImage.src])}
                data-testid="panel-analyse"
              >
                {analysis?.src === activeImage.src
                  ? "Analysing…"
                  : needsDescription(activeImage)
                    ? "Describe with AI"
                    : "Rewrite with AI"}
              </button>
            </div>
            {aiError?.src === activeImage.src ? (
              <p className={styles.aiError} role="alert">
                {aiError.message}
              </p>
            ) : null}

            {layoutControls(activeImage)}

            <div className={styles.panelSection}>
              <span className={styles.panelLabel}>Hero</span>
              {activeImage.src === doc.hero ? (
                <>
                  <button type="button" className={`${styles.heroButton} ${styles.heroButtonOn}`} disabled>
                    ★ Hero image (changed, not saved)
                  </button>
                  <p className={sw.sizeNote}>
                    Was {publishedHero}. The hero photo can’t be removed from the gallery.
                  </p>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.heroButton}
                  onClick={() => change("Hero changed", undefined, (current) => ({ ...current, hero: activeImage.src }))}
                  data-testid="set-hero"
                >
                  Set as hero
                </button>
              )}
            </div>

            <div className={styles.panelSection}>
              <span className={styles.panelLabel}>Order</span>
              <div className={sw.buttons2}>
                <button
                  type="button"
                  className={`${sw.btn} ${sw.btnSmall}`}
                  disabled={activeIndex === 0}
                  onClick={() => move(activeIndex, activeIndex - 1)}
                  data-testid="move-earlier"
                >
                  ← Move earlier
                </button>
                <button
                  type="button"
                  className={`${sw.btn} ${sw.btnSmall}`}
                  disabled={activeIndex === images.length - 1}
                  onClick={() => move(activeIndex, activeIndex + 1)}
                  data-testid="move-later"
                >
                  Move later →
                </button>
              </div>
            </div>

            <div className={sw.buttons2}>
              <button
                type="button"
                className={sw.btn}
                disabled={busy}
                onClick={() => onEditImage(activeImage)}
                data-testid="edit-image"
              >
                Edit / crop
              </button>
              <button
                type="button"
                className={sw.btnDanger}
                disabled={activeImage.src === doc.hero}
                title={activeImage.src === doc.hero ? "The hero can’t be removed" : undefined}
                onClick={() => remove([activeImage.src])}
                data-testid="remove-image"
              >
                Remove
              </button>
            </div>
            <p className={sw.sizeNote}>
              Edit / crop changes the shape, zoom and brightness. The edited copy uploads straight away and replaces
              this photo when you press Save &amp; publish.
            </p>

            <details className={sw.details}>
              <summary>File details</summary>
              <div className={sw.detailsBody}>
                <span>
                  Current filename: <strong>{activeImage.src}</strong>
                </span>
                <label className={sw.field}>
                  Suggested filename (applied when you press Save &amp; publish)
                  <input
                    className={sw.input}
                    value={activeImage.suggestedFilename ?? ""}
                    placeholder="AI suggestion appears here"
                    onChange={(event) =>
                      updateImage(activeImage.src, "New filename set", `filename:${activeImage.src}`, {
                        suggestedFilename: event.target.value,
                      })
                    }
                  />
                </label>
                {activeImage.originalSrc && activeImage.originalSrc !== activeImage.src ? (
                  <span>
                    Edited from <strong>{activeImage.originalSrc}</strong>
                  </span>
                ) : null}
              </div>
            </details>
          </aside>
        ) : (
          <aside ref={panelRef} className={sw.panel}>
            <p className={sw.panelEmpty}>
              Click a photo to see its description, describe it with AI, choose its layout, make it the hero, edit or
              crop it, or remove it.
            </p>
            <p className={sw.sizeNote}>
              Uploads, crops and AI descriptions are added here straight away. Everything on this screen goes live when
              you press Save &amp; publish.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}
