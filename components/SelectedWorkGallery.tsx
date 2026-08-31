"use client";

import Image from "next/image";
import { useState } from "react";

import ImageViewer from "./ImageViewer";

type SelectedWorkGalleryImage = {
  filename: string;
  alt: string;
  width: number;
  height: number;
};

type SelectedWorkGalleryProps = {
  images: SelectedWorkGalleryImage[];
  featuredIndices: number[];
  galleryClassName: string;
  galleryItemClassName: string;
  featuredClassName: string;
  imageClassName: string;
};

export default function SelectedWorkGallery({
  images,
  featuredIndices,
  galleryClassName,
  galleryItemClassName,
  featuredClassName,
  imageClassName,
}: SelectedWorkGalleryProps) {
  const [viewerIndex, setViewerIndex] = useState<
    number | null
  >(null);

  const featured = new Set(featuredIndices);

  const viewerImages = images.map((image) => ({
    src: `/images/selected-work/production/${image.filename}`,
    alt: image.alt,
  }));

  return (
    <>
      <section
        className={galleryClassName}
        id="production-gallery"
        aria-label="Selected production photography"
      >
        {images.map((image, index) => {
          const isFeatured = featured.has(index);

          return (
            <figure
              className={
                isFeatured
                  ? `${galleryItemClassName} ${featuredClassName}`
                  : galleryItemClassName
              }
              key={image.filename}
            >
              <button
                type="button"
                className="selected-work-image-button"
                onClick={() => setViewerIndex(index)}
                aria-label={`Open photograph ${index + 1} fullscreen`}
              >
                <Image
                  src={`/images/selected-work/production/${image.filename}`}
                  alt={image.alt}
                  width={image.width}
                  height={image.height}
                  sizes={
                    isFeatured
                      ? "(max-width: 760px) 100vw, 94vw"
                      : "(max-width: 760px) 100vw, 46vw"
                  }
                  className={imageClassName}
                  priority={index === 0}
                />
              </button>
            </figure>
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