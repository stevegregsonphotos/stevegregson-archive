"use client";

/* eslint-disable @next/next/no-img-element -- photos come from our own image host at fixed sizes */

import { useState, type CSSProperties } from "react";

import {
  DEFAULT_PRODUCTION_GALLERY_LAYOUT,
  PRODUCTION_GALLERY_LAYOUT_OPTIONS,
  balancedRows,
  landscapeEndingOrder,
  presetTile,
  type ProductionGalleryLayout,
} from "../../../../lib/production-gallery-layouts";
import { getProductionCardImageUrl } from "../../../../lib/production-image-url";

import type { ProductionImage } from "./editor-state";

import styles from "./production-edit.module.css";

const PREVIEW_COUNT = 9;

/** Small block diagram of a preset, for the choice tiles. */
function Diagram({ layout }: { layout: ProductionGalleryLayout }) {
  if (layout === "masonry") {
    const heights = [16, 24, 12, 22, 14, 20, 18, 12, 24];
    return (
      <span className={`${styles.diagram} ${styles.diagramMasonry}`} aria-hidden="true">
        {heights.map((height, index) => (
          <span key={index} style={{ height }} />
        ))}
      </span>
    );
  }
  if (layout === "balanced") {
    const rows: Array<[string, number]> = [
      ["1 / 7", 14],
      ["1 / 4", 10],
      ["4 / 7", 10],
      ["1 / 2", 10],
      ["2 / 5", 10],
      ["5 / 7", 10],
      ["2 / 6", 12],
    ];
    return (
      <span className={styles.diagram} aria-hidden="true">
        {rows.map(([column, height], index) => (
          <span key={index} style={{ gridColumn: column, height }} />
        ))}
      </span>
    );
  }
  if (layout === "per-photo") {
    const rows: Array<[string, number]> = [
      ["2 / 6", 14],
      ["1 / 4", 12],
      ["4 / 7", 12],
      ["2 / 6", 12],
    ];
    return (
      <span className={styles.diagram} aria-hidden="true">
        {rows.map(([column, height], index) => (
          <span key={index} style={{ gridColumn: column, height }} />
        ))}
      </span>
    );
  }
  const count = layout === "grid-2" ? 6 : layout === "editorial" ? 6 : 7;
  return (
    <span className={styles.diagram} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => {
        const tile = presetTile(layout, index);
        const style: CSSProperties = {
          gridColumn: `span ${tile.span}`,
          height: tile.span === 6 ? 16 : tile.span === 3 ? 12 : 9,
        };
        return <span key={index} style={style} />;
      })}
    </span>
  );
}

/** Balanced rows preview: the same rule as the public page, on the first photos. */
function BalancedPreview({ images, url }: { images: ProductionImage[]; url: (image: ProductionImage) => string }) {
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const shapes = images.map((image) => ratios[image.src] ?? 1.5);
  const order = landscapeEndingOrder(shapes);
  const ordered = order.map((index) => images[index]);
  const orderedShapes = order.map((index) => shapes[index]);

  return (
    <div className={styles.previewRows}>
      {balancedRows(orderedShapes).map((row) => (
        <div key={ordered[row[0]].src} className={styles.previewRow}>
          {row.map((index) => {
            const image = ordered[index];
            const ratio = orderedShapes[index];
            return (
              <img
                key={image.src}
                src={url(image)}
                alt=""
                loading="lazy"
                style={
                  row.length === 1
                    ? { aspectRatio: String(ratio), width: `${Math.min(100, ratio * 32)}%` }
                    : { aspectRatio: String(ratio), flexGrow: ratio, flexBasis: 0, minWidth: 0 }
                }
                onLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget;
                  if (naturalWidth && naturalHeight && ratios[image.src] === undefined) {
                    setRatios((current) => ({ ...current, [image.src]: naturalWidth / naturalHeight }));
                  }
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Preview({
  layout,
  images,
  slug,
}: {
  layout: ProductionGalleryLayout;
  images: ProductionImage[];
  slug: string;
}) {
  const shown = images.slice(0, PREVIEW_COUNT);
  if (!shown.length) {
    return <p className={styles.previewNote}>Add photographs to see a preview here.</p>;
  }
  const url = (image: ProductionImage) => getProductionCardImageUrl(slug, image.src);

  if (layout === "masonry") {
    return (
      <div className={styles.previewMasonry}>
        {shown.map((image) => (
          <img key={image.src} src={url(image)} alt="" loading="lazy" />
        ))}
      </div>
    );
  }

  if (layout === "balanced" || layout === "per-photo") {
    return <BalancedPreview images={shown} url={url} />;
  }

  return (
    <div className={`${styles.previewGrid} ${styles.previewGrid6}`}>
      {shown.map((image, index) => {
        const tile = presetTile(layout, index);
        return (
          <img
            key={image.src}
            src={url(image)}
            alt=""
            loading="lazy"
            className={tile.crop ? styles.previewCrop : undefined}
            style={{ gridColumn: tile.span === 6 ? "1 / -1" : `span ${tile.span}` }}
          />
        );
      })}
    </div>
  );
}

export default function GalleryLayoutPicker({
  value,
  published,
  images,
  slug,
  onChange,
}: {
  value: ProductionGalleryLayout;
  published: ProductionGalleryLayout;
  images: ProductionImage[];
  slug: string;
  onChange: (layout: ProductionGalleryLayout) => void;
}) {
  const current = PRODUCTION_GALLERY_LAYOUT_OPTIONS.find((option) => option.value === value);

  return (
    <section className={styles.layoutSection} aria-labelledby="gallery-layout-heading" data-testid="gallery-layout">
      <div>
        <div className={styles.cardHead}>
          <h2 id="gallery-layout-heading" className={styles.cardTitle}>
            Gallery layout
          </h2>
          <span className={value !== published ? `${styles.cardMeta} ${styles.cardMetaGold}` : styles.cardMeta}>
            {value !== published ? "Changed · not saved" : "Published"}
          </span>
        </div>
        <p className={styles.layoutIntro}>
          How the photographs below the hero are arranged on the production page. {current?.description}
        </p>
        <div className={styles.presetGrid} role="radiogroup" aria-label="Gallery layout">
          {PRODUCTION_GALLERY_LAYOUT_OPTIONS.map((option) => {
            const on = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={on}
                className={on ? `${styles.preset} ${styles.presetOn}` : styles.preset}
                onClick={() => onChange(option.value)}
                title={option.description}
                data-testid={`preset-${option.value}`}
              >
                <Diagram layout={option.value} />
                <span className={styles.presetName}>{option.name}</span>
                {option.value === DEFAULT_PRODUCTION_GALLERY_LAYOUT ? <span className={styles.presetDefault}>Default</span> : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className={styles.previewBox}>
        <p className={styles.previewLabel}>
          Preview{images.length > PREVIEW_COUNT ? ` · first ${PREVIEW_COUNT} of ${images.length}` : ""}
        </p>
        <div className={styles.preview} data-testid="gallery-preview">
          <Preview layout={value} images={images} slug={slug} />
        </div>
        <p className={styles.previewNote}>
          The hero stays full width at the top. Phones always show one photograph per row.
        </p>
      </div>
    </section>
  );
}
