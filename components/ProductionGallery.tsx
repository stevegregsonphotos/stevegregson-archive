"use client";

import Image from "next/image";
import { useState } from "react";
import ImageViewer from "./ImageViewer";
import type { ProductionImage } from "../lib/productions";

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
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

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
              onClick={() => setViewerIndex(index + 1)}
              aria-label={`Open photograph ${index + 2} fullscreen`}
            >
              <Image
                src={`${imageDirectory}/${image.src}`}
                alt={image.alt}
                width={2000}
                height={1333}
                sizes="(max-width: 768px) 100vw, 90vw"
              />
            </button>

            <figcaption>
              {String(index + 2).padStart(2, "0")} /{" "}
              {String(images.length + 1).padStart(2, "0")}
            </figcaption>
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