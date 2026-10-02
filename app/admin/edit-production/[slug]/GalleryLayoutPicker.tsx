"use client";

/* eslint-disable @next/next/no-img-element -- photos come from our own image host at fixed sizes */

import type { CSSProperties } from "react";

import {
  PRODUCTION_GALLERY_LAYOUT_OPTIONS,
  presetTile,
  type ProductionGalleryLayout,
} from "../../../../lib/production-gallery-layouts";
import { getProductionCardImageUrl } from "../../../../lib/production-image-url";

import type { GalleryLayout, ProductionImage } from "./editor-state";

import styles from "./production-edit.module.css";

/* Grid columns used by the public per-photo layout (12-column grid in globals.css). */
const PER_PHOTO_COLUMNS: Record<GalleryLayout, string> = {
  wide: "2 / 12",
  left: "1 / 8",
  right: "7 / 13",
  medium: "3 / 11",
  full: "1 / 13",
  "left-small": "2 / 7",
  "right-small": "7 / 12",
  "wide-left": "1 / 10",
  "wide-right": "4 / 13",
};

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

  if (layout === "per-photo") {
    return (
      <div className={`${styles.previewGrid} ${styles.previewGrid12}`}>
        {shown.map((image) => (
          <img
            key={image.src}
            src={url(image)}
            alt=""
            loading="lazy"
            style={{ gridColumn: PER_PHOTO_COLUMNS[image.layout] ?? PER_PHOTO_COLUMNS.wide }}
          />
        ))}
      </div>
    );
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
                {option.value === "per-photo" ? <span className={styles.presetDefault}>Default · current</span> : null}
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
