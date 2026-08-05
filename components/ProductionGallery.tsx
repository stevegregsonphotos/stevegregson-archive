"use client";

import Image from "next/image";
import { useState } from "react";

import type { ProductionImage } from "../lib/productions";

import ImageViewer from "./ImageViewer";

type ProductionGalleryProps = {
  title: string;
  imageDirectory: string;
  hero: {
    src: string;
    alt: string;
  };
  images: ProductionImage[];
};

export function ProductionGallery({
  title,
  imageDirectory,
  hero,
  images,
}: ProductionGalleryProps) {
  const [viewerIndex, setViewerIndex] = useState<
    number | null
  >(null);

  const viewerImages = [
    {
      src: `${imageDirectory}/${hero.src}`,
      alt: hero.alt,
    },
    ...images.map((image) => ({
      src: `${imageDirectory}/${image.src}`,
      alt: image.alt,
    })),
  ];

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
                src={`${imageDirectory}/${image.src}`}
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