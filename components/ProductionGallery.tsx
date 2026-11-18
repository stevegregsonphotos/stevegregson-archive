"use client";

import { useState, type CSSProperties } from "react";

import {
  getProductionCardImageUrl,
  getProductionImageUrl,
} from "../lib/production-image-url";
import {
  balancedRows,
  landscapeEndingOrder,
  type ProductionGalleryLayout,
} from "../lib/production-gallery-layouts";
import type { ProductionImage } from "../lib/productions";
import { aspectFromBlurDataURL } from "../lib/blur-aspect";

import ImageViewer from "./ImageViewer";

type ProductionGalleryProps = {
  title: string;
  productionSlug: string;
  hero: {
    src: string;
    alt: string;
  };
  images: ProductionImage[];
  /** Gallery layout preset; missing (or the retired "per-photo") renders balanced rows. */
  layout?: ProductionGalleryLayout;
};

/* Image `sizes` for each preset, matching the column widths in globals.css. */
const PRESET_SIZES = {
  grid3: "(max-width: 760px) calc(100vw - 1.5rem), (max-width: 1100px) 46vw, 31vw",
  grid2: "(max-width: 760px) calc(100vw - 1.5rem), 46vw",
  full: "(max-width: 760px) calc(100vw - 1.5rem), 94vw",
} as const;

type RowItem = { image: ProductionImage; index: number; ratio: number };

function presetSizes(
  layout: Exclude<ProductionGalleryLayout, "per-photo" | "balanced">,
  index: number,
) {
  switch (layout) {
    case "grid-2":
      return PRESET_SIZES.grid2;
    case "feature":
      return index === 0 ? PRESET_SIZES.full : PRESET_SIZES.grid3;
    case "editorial": {
      const position = index % 6;
      if (position === 0) return PRESET_SIZES.full;
      if (position <= 2) return PRESET_SIZES.grid2;
      return PRESET_SIZES.grid3;
    }
    default:
      return PRESET_SIZES.grid3;
  }
}

export function ProductionGallery({
  title,
  productionSlug,
  hero,
  images: sourceImages,
  layout,
}: ProductionGalleryProps) {
  const [viewerIndex, setViewerIndex] = useState<
    number | null
  >(null);

  const ratioOf = (image: ProductionImage) =>
    aspectFromBlurDataURL(image.blurDataURL) ?? 1.5;

  const rowLayout =
    layout !== "grid-3" &&
    layout !== "grid-2" &&
    layout !== "feature" &&
    layout !== "masonry";

  /* Row layouts end on a centred landscape; the viewer follows the same order. */
  const images = rowLayout
    ? landscapeEndingOrder(sourceImages.map(ratioOf)).map(
        (index) => sourceImages[index],
      )
    : sourceImages;

  const viewerImages = [
    {
      src: getProductionImageUrl(
        productionSlug,
        hero.src,
      ),
      alt: hero.alt,
    },
    ...images.map((image) => ({
      src: getProductionImageUrl(
        productionSlug,
        image.src,
      ),
      alt: image.alt,
    })),
  ];

  /*
   * Editorial rhythm: rows of 1, 2, then 3 photos. Every photo keeps its
   * own shape (never cropped): photos in a row share one height and take
   * widths in proportion to their shape, so portraits sit narrower beside
   * landscapes. Shapes come from each photo's blur placeholder.
   */
  /*
   * Row layouts. Every photo keeps its own shape (never cropped): photos in
   * a row share one height and take widths in proportion to their shape,
   * so portraits sit narrower beside landscapes. Shapes come from each
   * photo's blur placeholder.
   *  - Balanced rows (default): see balancedRows() in production-gallery-layouts.
   *  - Editorial rhythm: rows of 1, 2, then 3 photos.
   */
  if (rowLayout) {
    const rows: RowItem[][] = [];

    if (layout === "editorial") {
      const pattern = [1, 2, 3];
      const end = images.length - 1;
      let cursor = 0;
      let step = 0;

      while (cursor < end) {
        const size = pattern[step % pattern.length];
        rows.push(
          images.slice(cursor, Math.min(cursor + size, end)).map((image, offset) => ({
            image,
            index: cursor + offset,
            ratio: ratioOf(image),
          })),
        );
        cursor += size;
        step += 1;
      }

      if (end >= 0) {
        rows.push([{ image: images[end], index: end, ratio: ratioOf(images[end]) }]);
      }
    } else {
      const ratios = images.map(ratioOf);
      for (const row of balancedRows(ratios)) {
        rows.push(
          row.map((index) => ({
            image: images[index],
            index,
            ratio: ratios[index],
          })),
        );
      }
    }

    const balanced = layout !== "editorial";

    return (
      <>
        <section
          className={`curated-production-gallery curated-production-gallery-rows${balanced ? " curated-production-gallery-balanced" : ""}`}
          aria-label={`${title} photography`}
        >
          {rows.map((row) => {
            const rowRatio = row.reduce((sum, item) => sum + item.ratio, 0);
            const single = row.length === 1;

            return (
              <div
                className={`curated-production-row${single ? " curated-production-row-single" : ""}`}
                key={row[0].image.src}
                style={
                  single
                    ? ({ "--row-ratio": rowRatio } as CSSProperties)
                    : undefined
                }
              >
                {row.map(({ image, index, ratio }) => (
                  <figure
                    className={`curated-production-shot curated-production-row-shot${ratio < 1 ? " curated-production-row-shot-portrait" : ""}`}
                    key={image.src}
                    style={
                      single
                        ? { aspectRatio: String(ratio) }
                        : { flexGrow: ratio, aspectRatio: String(ratio) }
                    }
                  >
                    <button
                      className="curated-production-image-button"
                      type="button"
                      onClick={() => setViewerIndex(index + 1)}
                      aria-label={`Open photograph ${index + 2} from ${title} fullscreen`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getProductionImageUrl(productionSlug, image.src)}
                        srcSet={`${getProductionCardImageUrl(productionSlug, image.src)} 1000w, ${getProductionImageUrl(productionSlug, image.src)} 2560w`}
                        sizes={
                          single
                            ? PRESET_SIZES.full
                            : `(max-width: 760px) calc(100vw - 1.5rem), ${Math.ceil((94 * ratio) / rowRatio)}vw`
                        }
                        alt={image.alt}
                        width={Math.round(1000 * ratio)}
                        height={1000}
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  </figure>
                ))}
              </div>
            );
          })}
        </section>

        <ImageViewer
          images={viewerImages}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      </>
    );
  }

  return (
      <>
        <section
          className={`curated-production-gallery curated-production-gallery-preset curated-production-gallery-${layout}`}
          aria-label={`${title} photography`}
        >
          {images.map((image, index) => (
            <figure
              className="curated-production-shot curated-production-preset-shot"
              key={image.src}
            >
              <button
                className="curated-production-image-button"
                type="button"
                onClick={() =>
                  setViewerIndex(index + 1)
                }
                aria-label={`Open photograph ${index + 2} from ${title} fullscreen`}
              >
                {/* srcSet: sharp full-size copy on large/retina screens, light card copy elsewhere. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getProductionImageUrl(productionSlug, image.src)}
                  srcSet={`${getProductionCardImageUrl(productionSlug, image.src)} 1000w, ${getProductionImageUrl(productionSlug, image.src)} 2560w`}
                  sizes={presetSizes(layout, index)}
                  alt={image.alt}
                  width={2000}
                  height={1333}
                  loading="lazy"
                  decoding="async"
                />
              </button>
            </figure>
          ))}
        </section>

        <ImageViewer
          images={viewerImages}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      </>
    );
}
