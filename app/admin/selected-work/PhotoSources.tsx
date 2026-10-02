"use client";

/* eslint-disable @next/next/no-img-element -- thumbnails come from our own image hosts at fixed sizes */

import { useEffect, useMemo, useState } from "react";

import type { ShowcaseItem } from "../../../lib/selected-work-page";

import styles from "./backstage-selected-work.module.css";

export const PAGE_API = "/api/admin/selected-work-page";

export type ProductionOption = { slug: string; title: string; venue: string; year: number };

export type PickedImage = {
  src: string;
  smallSrc?: string;
  alt: string;
  width?: number;
  height?: number;
  production?: { slug: string; title: string; venue: string };
};

export type SourceId = "production" | "page" | "library";

const SOURCE_LABELS: Record<SourceId, string> = {
  production: "From a production",
  page: "From the Selected Work page",
  library: "From the photo library",
};

const LIBRARY_FILTERS = [
  { id: "", label: "All library photos" },
  { id: "production", label: "Production page uploads" },
  { id: "rehearsal", label: "Rehearsals" },
  { id: "campaign", label: "Marketing & PR" },
];

/**
 * Where a photograph can come from: a production in the archive, the
 * Selected Work page list, or the photo library. Clicking a photo calls
 * onSelect; `selectedSrc` is outlined.
 */
export default function PhotoSources({
  sources,
  productions,
  pageItems = [],
  selectedSrc,
  onSelect,
}: {
  sources: SourceId[];
  productions: ProductionOption[];
  pageItems?: ShowcaseItem[];
  selectedSrc?: string;
  onSelect: (image: PickedImage) => void;
}) {
  const [source, setSource] = useState<SourceId>(sources[0]);
  const [slug, setSlug] = useState("");
  const [filter, setFilter] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("");
  const [loaded, setLoaded] = useState<{ key: string; images: Array<PickedImage & { category?: string }> }>({
    key: "",
    images: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return term
      ? productions.filter((production) =>
          `${production.title} ${production.venue} ${production.year}`.toLowerCase().includes(term),
        )
      : productions;
  }, [filter, productions]);

  const wantedKey = source === "library" ? "library" : source === "production" && slug ? `production:${slug}` : "";

  useEffect(() => {
    if (!wantedKey) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const query = wantedKey === "library" ? "library=1" : `production=${encodeURIComponent(slug)}`;
        const response = await fetch(`${PAGE_API}?${query}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "Could not load photographs.");
        if (cancelled) return;
        setLoaded({
          key: wantedKey,
          images: (data.images as Array<PickedImage & { category?: string }>).map((image) => ({
            ...image,
            ...(data.production
              ? { production: { slug: data.production.slug, title: data.production.title, venue: data.production.venue } }
              : {}),
          })),
        });
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load photographs.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timer = window.setTimeout(load, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [wantedKey, slug]);

  let images: Array<PickedImage & { category?: string }> = [];
  if (source === "page") {
    images = pageItems.map((item) => ({
      src: item.src,
      smallSrc: item.smallSrc,
      alt: item.alt,
      width: item.width,
      height: item.height,
      ...(item.credit?.slug ? { production: { slug: item.credit.slug, title: item.credit.title, venue: item.credit.venue } } : {}),
    }));
  } else if (wantedKey && loaded.key === wantedKey) {
    images = loaded.images;
    if (source === "library" && libraryFilter) {
      images = images.filter((image) => image.category === libraryFilter);
    }
  }

  return (
    <>
      <div className={styles.chooserTabs} role="tablist" aria-label="Where the photo comes from">
        {sources.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={source === id}
            className={source === id ? `${styles.chooserTab} ${styles.chooserTabOn}` : styles.chooserTab}
            onClick={() => setSource(id)}
          >
            {SOURCE_LABELS[id]}
          </button>
        ))}
      </div>

      {source === "production" ? (
        <div className={styles.pairFields}>
          <label className={styles.field}>
            Search productions
            <input
              className={styles.input}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Title, venue or year"
            />
          </label>
          <label className={styles.field}>
            Production
            <select className={styles.select} value={slug} onChange={(event) => setSlug(event.target.value)}>
              <option value="">Choose a production…</option>
              {filtered.map((production) => (
                <option key={production.slug} value={production.slug}>
                  {production.title} — {production.venue} ({production.year})
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {source === "library" ? (
        <label className={styles.field}>
          Show
          <select className={styles.select} value={libraryFilter} onChange={(event) => setLibraryFilter(event.target.value)}>
            {LIBRARY_FILTERS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {loading && source !== "page" ? <p className={styles.hint}>Loading photographs…</p> : null}
      {error && source !== "page" ? <p className={styles.errorText}>{error}</p> : null}
      {source === "production" && !slug ? <p className={styles.hint}>Choose a production to see its photographs.</p> : null}

      {images.length ? (
        <div className={styles.chooserGrid}>
          {images.map((image) => (
            <button
              key={image.src}
              type="button"
              className={image.src === selectedSrc ? `${styles.chooserItem} ${styles.chooserItemOn}` : styles.chooserItem}
              onClick={() => onSelect(image)}
              title={image.alt}
              aria-pressed={image.src === selectedSrc}
            >
              <img src={image.smallSrc || image.src} alt={image.alt} loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}

      {images.length && source === "production" ? (
        <p className={styles.hint}>
          {images.length} {images.length === 1 ? "photo" : "photos"} from this production
        </p>
      ) : null}
    </>
  );
}

export function PickerDialog({
  title,
  productions,
  onPick,
  onClose,
}: {
  title: string;
  productions: ProductionOption[];
  onPick: (image: PickedImage) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className={`${styles.chooser} ${styles.dialog}`} onClick={(event) => event.stopPropagation()}>
        <div className={styles.panelHead}>
          <span className={styles.chooserTitle}>{title}</span>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <PhotoSources sources={["production", "library"]} productions={productions} onSelect={onPick} />
      </div>
    </div>
  );
}
