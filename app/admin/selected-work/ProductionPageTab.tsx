"use client";

/* eslint-disable @next/next/no-img-element -- photos come from our own image hosts at fixed sizes */

import { useRef, useState, type ReactNode } from "react";

import type { ShowcaseItem, ShowcaseSize } from "../../../lib/selected-work-page";

import type { Doc } from "./library/draft";
import {
  libraryDisplayUrl,
  libraryFullUrl,
  parseLibraryUrl,
  type SelectedWorkImage,
} from "./library/pipeline";
import type { LibraryApi } from "./library/useSelectedWorkLibrary";
import LibraryTab from "./LibraryTab";
import { PickerDialog, type PickedImage, type ProductionOption } from "./PhotoSources";

import styles from "./backstage-selected-work.module.css";

type Change = (label: string, key: string | undefined, mutate: (doc: Doc) => Doc) => void;

type SizeChoice = "feature" | "wide" | "half" | "upright";

const SIZE_CHIPS: Record<ShowcaseSize, string> = {
  feature: "Feature",
  wide: "Full width",
  half: "Half",
  portrait: "Upright pair",
  tall: "Upright",
};

const isUpright = (size?: ShowcaseSize) => size === "portrait" || size === "tall";

function sizeChoice(size: ShowcaseSize): SizeChoice {
  return isUpright(size) ? "upright" : (size as SizeChoice);
}

function newId(src: string) {
  const base = src.split("/").pop()?.replace(/\.[a-z0-9]+(\?.*)?$/i, "").slice(0, 60) || "photo";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

function measure(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.naturalWidth || 2048, height: image.naturalHeight || 1365 });
    image.onerror = () => resolve({ width: 2048, height: 1365 });
    image.src = src;
  });
}

function captionOf(item: ShowcaseItem) {
  return item.credit?.title?.trim() || "";
}

function fileNameOf(src: string) {
  try {
    return decodeURIComponent(src.split("?")[0].split("/").pop() || src);
  } catch {
    return src;
  }
}

/** Whether neighbour `index` is an upright that is free to pair. */
function freeUpright(items: ShowcaseItem[], index: number, partnerOf: number) {
  const item = items[index];
  if (!item || !isUpright(item.size)) return false;
  if (item.size === "tall") return true;
  // A portrait already paired with its other neighbour is not free.
  const other = index < partnerOf ? index - 1 : index + 1;
  return !(items[other]?.size === "portrait");
}

/**
 * Applies a size choice, keeping the data compatible with ShowcaseSize:
 * Upright becomes "portrait" (a side-by-side pair) when a neighbour is also
 * upright, otherwise "tall" (on its own, centred).
 */
export function applySize(items: ShowcaseItem[], index: number, choice: SizeChoice): ShowcaseItem[] {
  const next = items.map((item) => ({ ...item }));
  const current = next[index];
  const wasPortrait = current.size === "portrait";

  if (choice === "upright") {
    const before = index > 0 && !current.gapBefore && freeUpright(items, index - 1, index);
    const after = !before && !next[index + 1]?.gapBefore && freeUpright(items, index + 1, index);
    if (before || after) {
      current.size = "portrait";
      next[before ? index - 1 : index + 1].size = "portrait";
    } else {
      current.size = "tall";
    }
  } else {
    current.size = choice;
  }

  // A pair partner left on its own becomes an upright on its own.
  if (wasPortrait && current.size !== "portrait") {
    [index - 1, index + 1].forEach((neighbour) => {
      const item = next[neighbour];
      if (item?.size !== "portrait") return;
      const hasPartner = next[neighbour - 1]?.size === "portrait" || next[neighbour + 1]?.size === "portrait";
      if (!hasPartner) item.size = "tall";
    });
  }

  return next;
}

type Block =
  | { kind: "feature"; index: number }
  | { kind: "grid"; indexes: number[]; gap: boolean };

/** Same grouping as the public page (components/SelectedWorkShowcase.tsx). */
function buildBlocks(items: ShowcaseItem[]): Block[] {
  const blocks: Block[] = [];
  let grid: Extract<Block, { kind: "grid" }> | null = null;
  items.forEach((item, index) => {
    if (index === 0 || item.size === "feature") {
      grid = null;
      blocks.push({ kind: "feature", index });
      return;
    }
    if (!grid || item.gapBefore) {
      grid = { kind: "grid", indexes: [], gap: Boolean(item.gapBefore) };
      blocks.push(grid);
    }
    grid.indexes.push(index);
  });
  return blocks;
}

function SizeIcon({ choice }: { choice: SizeChoice }) {
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {choice === "feature" ? <rect x="1" y="1" width="20" height="12" /> : null}
      {choice === "wide" ? <rect x="3" y="2" width="16" height="10" /> : null}
      {choice === "half" ? (
        <>
          <rect x="1" y="3" width="9" height="8" />
          <rect x="12" y="3" width="9" height="8" />
        </>
      ) : null}
      {choice === "upright" ? <rect x="7" y="1" width="8" height="12" /> : null}
    </svg>
  );
}

export default function ProductionPageTab({
  items,
  productions,
  library,
  libraryImages,
  change,
  onLibraryField,
  onLibraryReorder,
}: {
  items: ShowcaseItem[];
  productions: ProductionOption[];
  library: LibraryApi;
  libraryImages: SelectedWorkImage[];
  change: Change;
  onLibraryField: (filename: string, field: "alt" | "suggestedFilename", value: string) => void;
  onLibraryReorder: (from: number, to: number) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [picker, setPicker] = useState<null | { mode: "add" } | { mode: "swap"; id: string }>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = Boolean(library.busy);

  const productionBySlug = new Map(productions.map((production) => [production.slug, production]));
  const activeIndex = activeId ? items.findIndex((item) => item.id === activeId) : -1;
  const active = activeIndex >= 0 ? items[activeIndex] : null;
  const activeLibrary = active ? parseLibraryUrl(active.src) : null;
  const activeLibraryImage = activeLibrary
    ? library.server[activeLibrary.category].find((image) => image.filename === activeLibrary.filename)
    : undefined;

  function updateItem(id: string, label: string, key: string | undefined, patch: (item: ShowcaseItem) => ShowcaseItem) {
    change(label, key, (doc) => ({ ...doc, items: doc.items.map((item) => (item.id === id ? patch(item) : item)) }));
  }

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= items.length) return;
    const name = captionOf(items[from]) || `photo ${from + 1}`;
    change(`Moved ${name}`, undefined, (doc) => {
      const next = [...doc.items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...doc, items: next };
    });
  }

  function removeFromPage(ids: string[]) {
    if (items.length - ids.length < 1) return;
    const label =
      ids.length === 1
        ? `Took ${captionOf(items.find((item) => item.id === ids[0])!) || "a photo"} off the page`
        : `Took ${ids.length} photos off the page`;
    change(label, undefined, (doc) => ({ ...doc, items: doc.items.filter((item) => !ids.includes(item.id)) }));
    if (activeId && ids.includes(activeId)) setActiveId(null);
    setSelected(new Set());
  }

  function appendItems(newItems: ShowcaseItem[], label: string) {
    if (!newItems.length) return;
    change(label, undefined, (doc) => ({ ...doc, items: [...doc.items, ...newItems] }));
    setActiveId(newItems[newItems.length - 1].id);
  }

  async function handlePick(image: PickedImage) {
    if (!picker) return;
    const size =
      image.width && image.height ? { width: image.width, height: image.height } : await measure(image.src);
    const credit = image.production
      ? { slug: image.production.slug, title: image.production.title, venue: image.production.venue }
      : null;

    if (picker.mode === "swap") {
      const target = items.find((item) => item.id === picker.id);
      updateItem(picker.id, `Swapped the photo for ${target ? captionOf(target) || "a photo" : "a photo"}`, undefined, (item) => ({
        ...item,
        src: image.src,
        ...(image.smallSrc ? { smallSrc: image.smallSrc } : { smallSrc: undefined }),
        width: size.width,
        height: size.height,
        alt: image.alt,
        ...(credit ? { credit } : {}),
      }));
    } else {
      appendItems(
        [
          {
            id: newId(image.src),
            src: image.src,
            ...(image.smallSrc ? { smallSrc: image.smallSrc } : {}),
            width: size.width,
            height: size.height,
            alt: image.alt,
            credit,
            size: size.height > size.width ? "tall" : "half",
          },
        ],
        `Added ${credit?.title || "a photo"}`,
      );
    }
    setPicker(null);
  }

  async function uploadToPage(files: File[]) {
    const uploaded = await library.uploadFiles("production", files);
    if (!uploaded.length) return;
    const server = library.serverRef.current.production;
    appendItems(
      uploaded.map((file) => {
        const src = libraryFullUrl("production", file.filename);
        const latest = server.find((image) => image.filename === file.filename);
        return {
          id: newId(src),
          src,
          smallSrc: libraryDisplayUrl("production", file.filename),
          width: file.width,
          height: file.height,
          alt: latest?.alt ?? "",
          credit: null,
          size: file.height > file.width ? "tall" : "half",
        } satisfies ShowcaseItem;
      }),
      uploaded.length === 1 ? "Uploaded a photo to the page" : `Uploaded ${uploaded.length} photos to the page`,
    );
  }

  async function rewriteWithAi() {
    if (!active || !activeLibrary) return;
    const id = active.id;
    const results = await library.analyse(activeLibrary.category, [activeLibrary.filename]);
    const alt = results[0]?.alt;
    if (alt) updateItem(id, "Rewrote a description with AI", undefined, (item) => ({ ...item, alt }));
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

  function tile(index: number): ReactNode {
    const item = items[index];
    const feature = index === 0 || item.size === "feature";
    const sizeClass = feature
      ? styles.tileFeature
      : item.size === "wide"
        ? styles.tileWide
        : item.size === "half"
          ? styles.tileHalf
          : item.size === "portrait"
            ? styles.tilePortrait
            : styles.tileTall;
    const checked = selected.has(item.id);
    const showDrop = dragOver === index && dragFrom !== null && dragFrom !== index && dragFrom !== index - 1;
    const classes = [
      styles.tile,
      sizeClass,
      activeId === item.id && !selecting ? styles.tileActive : "",
      selecting && checked ? styles.tileChecked : "",
      dragFrom === index ? styles.tileDragging : "",
      showDrop ? styles.dropBefore : "",
    ].join(" ");
    const caption = captionOf(item);

    return (
      <figure
        key={item.id}
        className={classes}
        draggable={!busy}
        tabIndex={0}
        data-testid="page-tile"
        aria-label={`Photo ${index + 1}${caption ? `: ${caption}` : ""}`}
        onClick={() => {
          if (selecting) {
            setSelected((current) => {
              const next = new Set(current);
              if (next.has(item.id)) next.delete(item.id);
              else next.add(item.id);
              return next;
            });
          } else {
            setActiveId(item.id);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setActiveId(item.id);
          }
        }}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", item.id);
          event.dataTransfer.effectAllowed = "move";
          setDragFrom(index);
        }}
        onDragOver={(event) => {
          if (dragFrom === null) return;
          event.preventDefault();
          setDragOver(index);
        }}
        onDrop={(event) => {
          event.preventDefault();
          drop(index);
        }}
        onDragEnd={finishDrag}
      >
        {showDrop ? (
          <span className={styles.dropLabel}>
            Drop here · moving “{captionOf(items[dragFrom!]) || `photo ${dragFrom! + 1}`}”
          </span>
        ) : null}
        <img src={item.smallSrc || item.src} alt={item.alt} loading="lazy" />
        <span className={styles.num}>{index + 1}</span>
        {selecting ? (
          <span className={checked ? `${styles.tickBox} ${styles.tickBoxOn}` : styles.tickBox} aria-hidden="true">
            {checked ? "✓" : ""}
          </span>
        ) : (
          <span className={activeId === item.id ? `${styles.chip} ${styles.chipEditing}` : styles.chip}>
            {activeId === item.id ? "Editing" : feature ? "Feature" : SIZE_CHIPS[item.size]}
          </span>
        )}
        {!caption ? <span className={styles.warnChip}>No caption yet</span> : null}
        <figcaption className={caption ? styles.caption : `${styles.caption} ${styles.captionMuted}`}>
          {caption || item.alt || "Untitled photo"}
          {caption && item.credit?.venue ? <span className={styles.venue}>{item.credit.venue}</span> : null}
        </figcaption>
      </figure>
    );
  }

  const blocks = buildBlocks(items);

  return (
    <div>
      <div className={styles.actions}>
        <button type="button" className={styles.btnPrimary} disabled={busy} onClick={() => fileInput.current?.click()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Upload photographs
        </button>
        <input
          ref={fileInput}
          className={styles.hiddenInput}
          type="file"
          accept="image/jpeg,.jpg,.jpeg"
          multiple
          data-testid="page-upload-input"
          onChange={(event) => {
            const files = event.target.files ? Array.from(event.target.files) : [];
            event.target.value = "";
            void uploadToPage(files);
          }}
        />
        <button type="button" className={styles.btn} disabled={busy} onClick={() => setPicker({ mode: "add" })}>
          Add from a production
        </button>
        <button
          type="button"
          className={selecting ? `${styles.btn} ${styles.btnOn}` : styles.btn}
          aria-pressed={selecting}
          onClick={() => {
            setSelecting((current) => !current);
            setSelected(new Set());
          }}
        >
          {selecting ? "Done selecting" : "Select several"}
        </button>
        <span className={styles.spacer} />
        <span className={styles.hint}>Shown as visitors see the page. Drag to reorder, click to edit.</span>
      </div>

      {selecting ? (
        <div className={styles.selectBar} role="toolbar" aria-label="Selected photos">
          <span className={styles.selectCount}>{selected.size} selected</span>
          <span className={styles.divider} />
          <button
            type="button"
            className={styles.btnDanger}
            disabled={!selected.size || selected.size >= items.length}
            onClick={() => removeFromPage([...selected])}
          >
            Take off the page
          </button>
          <span className={styles.hint}>The photos stay in the photo library and the archive.</span>
          <span className={styles.spacer} />
          <button type="button" className={styles.quietButton} onClick={() => setSelected(new Set(items.map((item) => item.id)))}>
            Select all
          </button>
          <button type="button" className={styles.quietButton} onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      ) : null}

      {library.upload?.category === "production" || library.busy ? (
        <p className={styles.status} aria-live="polite">
          {library.upload?.category === "production"
            ? `${library.upload.files.filter((file) => file.state === "done").length} of ${library.upload.files.length} uploaded. `
            : ""}
          {library.busy ?? ""}
        </p>
      ) : null}
      {!library.busy && library.message ? <p className={styles.status}>{library.message}</p> : null}
      {library.error ? <p className={styles.errorText} role="alert">{library.error}</p> : null}

      <div className={styles.workspace}>
        <div className={styles.layout} data-testid="page-layout">
          {blocks.map((block) =>
            block.kind === "feature" ? (
              <div key={items[block.index].id} style={{ display: "contents" }}>
                {block.index > 0 && items[block.index].gapBefore ? <div className={styles.gapDivider}>EXTRA SPACE</div> : null}
                {tile(block.index)}
              </div>
            ) : (
              <div key={`grid-${items[block.indexes[0]].id}`} style={{ display: "contents" }}>
                {block.gap ? <div className={styles.gapDivider}>EXTRA SPACE</div> : null}
                <div className={styles.pageGrid}>{block.indexes.map((index) => tile(index))}</div>
              </div>
            ),
          )}
          {dragFrom !== null ? (
            <div
              className={dragOver === items.length ? `${styles.dropEnd} ${styles.dropEndActive}` : styles.dropEnd}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(items.length);
              }}
              onDrop={(event) => {
                event.preventDefault();
                drop(items.length);
              }}
            >
              Drop here to move to the end of the page
            </div>
          ) : null}
        </div>

        {active && !selecting ? (
          <aside className={styles.panel} aria-label="Photo details" data-testid="page-panel">
            <div className={styles.panelHead}>
              <span className={styles.kicker}>
                Photo {activeIndex + 1} of {items.length}
              </span>
              <button type="button" className={styles.close} aria-label="Close details" onClick={() => setActiveId(null)}>
                ×
              </button>
            </div>
            <img className={styles.preview} src={active.smallSrc || active.src} alt={active.alt} />

            <label className={styles.field}>
              Production (sets the caption and link)
              <select
                className={styles.select}
                value={active.credit?.slug ?? ""}
                data-testid="production-select"
                onChange={(event) => {
                  const production = productionBySlug.get(event.target.value);
                  updateItem(
                    active.id,
                    production ? `Set ${production.title} as the production` : "Removed the production link",
                    undefined,
                    (item) => ({
                      ...item,
                      credit: production
                        ? { slug: production.slug, title: production.title, venue: production.venue }
                        : null,
                    }),
                  );
                }}
              >
                <option value="">No production (no caption or link)</option>
                {active.credit?.slug && !productionBySlug.has(active.credit.slug) ? (
                  <option value={active.credit.slug}>{active.credit.title}</option>
                ) : null}
                {productions.map((production) => (
                  <option key={production.slug} value={production.slug}>
                    {production.title} — {production.venue} ({production.year})
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.pairFields}>
              <label className={styles.field}>
                Caption
                <input
                  className={styles.input}
                  value={active.credit?.title ?? ""}
                  data-testid="caption-input"
                  onChange={(event) => {
                    const title = event.target.value;
                    updateItem(active.id, `Changed the ${captionOf(active) || "photo"} caption`, `caption:${active.id}`, (item) => ({
                      ...item,
                      credit: { slug: item.credit?.slug ?? "", venue: item.credit?.venue ?? "", title },
                    }));
                  }}
                />
              </label>
              <label className={styles.field}>
                Venue
                <input
                  className={styles.input}
                  value={active.credit?.venue ?? ""}
                  onChange={(event) => {
                    const venue = event.target.value;
                    updateItem(active.id, `Changed the ${captionOf(active) || "photo"} venue`, `venue:${active.id}`, (item) => ({
                      ...item,
                      credit: { slug: item.credit?.slug ?? "", title: item.credit?.title ?? "", venue },
                    }));
                  }}
                />
              </label>
            </div>

            <div className={styles.field}>
              Size on the page
              <div className={styles.sizeGroup} role="group" aria-label="Size on the page">
                {(["feature", "wide", "half", "upright"] as SizeChoice[]).map((choice) => {
                  const on = sizeChoice(active.size) === choice;
                  return (
                    <button
                      key={choice}
                      type="button"
                      aria-pressed={on}
                      className={on ? `${styles.sizeButton} ${styles.sizeButtonOn}` : styles.sizeButton}
                      onClick={() =>
                        change(`Changed the size of ${captionOf(active) || "a photo"}`, undefined, (doc) => {
                          const index = doc.items.findIndex((item) => item.id === active.id);
                          return index < 0 ? doc : { ...doc, items: applySize(doc.items, index, choice) };
                        })
                      }
                    >
                      <SizeIcon choice={choice} />
                      {choice === "feature" ? "Feature" : choice === "wide" ? "Full width" : choice === "half" ? "Half" : "Upright"}
                    </button>
                  );
                })}
              </div>
              <p className={styles.sizeNote}>
                {activeIndex === 0
                  ? "The first photo is always shown large at the top."
                  : active.size === "half"
                    ? "Halves sit side by side with the next half."
                    : active.size === "portrait"
                      ? "Paired side by side with the upright photo next to it."
                      : active.size === "tall"
                        ? "An upright photo on its own, centred. Put another upright next to it to make a pair."
                        : active.size === "feature"
                          ? "Big, across the whole page."
                          : "Across the full width of the column."}
              </p>
            </div>

            <label className={styles.check}>
              <input
                type="checkbox"
                checked={Boolean(active.gapBefore)}
                disabled={activeIndex === 0}
                onChange={(event) => {
                  const on = event.target.checked;
                  updateItem(active.id, on ? "Added extra space" : "Removed extra space", undefined, (item) => {
                    const next = { ...item };
                    if (on) next.gapBefore = true;
                    else delete next.gapBefore;
                    return next;
                  });
                }}
              />
              Extra space above this photo
            </label>

            <label className={styles.field}>
              Description for Google and screen readers
              <textarea
                className={styles.textarea}
                rows={3}
                value={active.alt}
                onChange={(event) => {
                  const alt = event.target.value;
                  updateItem(active.id, `Changed the ${captionOf(active) || "photo"} description`, `alt:${active.id}`, (item) => ({
                    ...item,
                    alt,
                  }));
                }}
              />
            </label>

            {activeLibrary ? (
              <div className={styles.aiRow}>
                {activeLibraryImage?.analysisStatus === "complete" ? (
                  <span className={styles.aiOk}>✓ Vision AI has described this photo</span>
                ) : (
                  <span className={styles.aiPending}>Not described by AI yet</span>
                )}
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSmall}`}
                  disabled={busy || !activeLibraryImage}
                  onClick={() => void rewriteWithAi()}
                >
                  Rewrite with AI
                </button>
              </div>
            ) : null}

            <div className={activeLibraryImage ? styles.buttons3 : styles.buttons2}>
              {activeLibraryImage && activeLibrary ? (
                <button
                  type="button"
                  className={styles.btn}
                  disabled={busy}
                  onClick={() => library.openEditor(activeLibrary.category, activeLibrary.filename)}
                >
                  Edit / crop
                </button>
              ) : null}
              <button type="button" className={styles.btn} disabled={busy} onClick={() => setPicker({ mode: "swap", id: active.id })}>
                Swap photo
              </button>
              <button
                type="button"
                className={styles.btnDanger}
                disabled={items.length <= 1}
                onClick={() => removeFromPage([active.id])}
              >
                Remove
              </button>
            </div>
            <div className={styles.buttons2}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSmall}`}
                disabled={activeIndex === 0}
                onClick={() => move(activeIndex, activeIndex - 1)}
              >
                ↑ Move earlier
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSmall}`}
                disabled={activeIndex === items.length - 1}
                onClick={() => move(activeIndex, activeIndex + 1)}
              >
                ↓ Move later
              </button>
            </div>
            <details className={styles.details}>
              <summary>File details</summary>
              <div className={styles.detailsBody}>
                <span>
                  Filename: <strong>{activeLibrary?.filename ?? fileNameOf(active.src)}</strong>
                </span>
                <span>
                  {active.width} × {active.height} pixels
                </span>
                <span>
                  From:{" "}
                  <strong>{activeLibrary ? "the photo library (can be edited and cropped)" : "the production archive"}</strong>
                </span>
                <span>Remove only takes the photo off this page; the photo itself is kept.</span>
              </div>
            </details>
          </aside>
        ) : !selecting ? (
          <aside className={styles.panel}>
            <p className={styles.panelEmpty}>
              Click a photo to change its caption, size and description, swap it or take it off the page.
            </p>
            <p className={styles.sizeNote}>Nothing changes on the live page until you press Save &amp; publish.</p>
          </aside>
        ) : null}
      </div>

      <div className={styles.subToggle}>
        <button
          type="button"
          className={styles.subToggleButton}
          aria-expanded={showLibrary}
          onClick={() => setShowLibrary((current) => !current)}
        >
          {showLibrary ? "▾" : "▸"} Photo library (uploads for this page and Commissions) · {libraryImages.length}
        </button>
        {showLibrary ? (
          <>
            <p className={styles.intro}>
              Photographs uploaded for the Production page. They also feed the automatic pictures on the Commissions
              page. Adding a photo here does not put it on the page: use “Add from a production” → “From the photo
              library”, or “Upload photographs” above.
            </p>
            <LibraryTab
              category="production"
              images={libraryImages}
              library={library}
              uploadTitle="Drop photographs here to add them to the photo library"
              onField={onLibraryField}
              onReorder={onLibraryReorder}
              usedOnPage={(filename) =>
                items.some((item) => {
                  const parsed = parseLibraryUrl(item.src);
                  return parsed?.category === "production" && parsed.filename === filename;
                })
              }
            />
          </>
        ) : null}
      </div>

      {picker ? (
        <PickerDialog
          title={picker.mode === "swap" ? "Swap this photo" : "Add a photo to the page"}
          productions={productions}
          onPick={(image) => void handlePick(image)}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </div>
  );
}
