"use client";

import Image from "next/image";
import { useState } from "react";

import {
  getProductionCardImageUrl,
  getProductionImageUrl,
} from "../lib/production-image-url";
import type { ProductionGalleryLayout } from "../lib/production-gallery-layouts";
import type { ProductionImage } from "../lib/productions";

import ImageViewer from "./ImageViewer";

type ProductionGalleryProps = {
  title: string;
  productionSlug: string;
  hero: {
    src: string;
    alt: string;
  };
  images: ProductionImage[];
  /** Gallery layout preset; missing or "per-photo" renders each photo's own layout. */
  layout?: ProductionGalleryLayout;
};

/* Image `sizes` for each preset, matching the column widths in globals.css. */
const PRESET_SIZES = {
  grid3: "(max-width: 760px) calc(100vw - 1.5rem), (max-width: 1100px) 46vw, 31vw",
  grid2: "(max-width: 760px) calc(100vw - 1.5rem), 46vw",
  full: "(max-width: 760px) calc(100vw - 1.5rem), 94vw",
} as const;

function presetSizes(
  layout: Exclude<ProductionGalleryLayout, "per-photo">,
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
  images,
  layout,
}: ProductionGalleryProps) {
  const [viewerIndex, setViewerIndex] = useState<
    number | null
  >(null);

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

  if (layout && layout !== "per-photo") {
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
                <Image
                  src={getProductionCardImageUrl(
                    productionSlug,
                    image.src,
                  )}
                  alt={image.alt}
                  width={2000}
                  height={1333}
                  sizes={presetSizes(layout, index)}
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

  return (
    <>
      <section
        className="curated-production-gallery"
        aria-label={`${title} photography`}
      >
        {images.map((image, index) => (
          <figure
            className={`curated-production-shot curated-production-shot-${image.layout}`}
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
                <Image
                  src={getProductionCardImageUrl(
                    productionSlug,
                    image.src,
                  )}
                  alt={image.alt}
                  width={2000}
                  height={1333}
                  sizes="(max-width: 768px) calc(100vw - 2.8rem), 90vw"
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