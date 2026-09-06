"use client";

import Image from "next/image";
import { useState } from "react";

import ImageViewer from "./ImageViewer";

type MarketingPrImage = {
  filename: string;
  alt: string;
  width: number;
  height: number;
};

type MarketingPrGalleryProps = {
  images: MarketingPrImage[];
  featuredIndices: number[];
  galleryClassName: string;
  galleryItemClassName: string;
  featuredClassName: string;
  imageClassName: string;
};

export default function MarketingPrGallery({
  images,
  featuredIndices,
  galleryClassName,
  galleryItemClassName,
  featuredClassName,
  imageClassName,
}: MarketingPrGalleryProps) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const featured = new Set(featuredIndices);

  const viewerImages = images.map((image) => ({
    src: `/images/selected-work/campaign/${image.filename}`,
    alt: image.alt,
  }));

  if (images.length === 0) {
    return (
      <p>No photographs have been added to this collection yet.</p>
    );
  }

  return (
    <>
      <div className={galleryClassName}>
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
                aria-label={`Open marketing photograph ${index + 1} fullscreen`}
              >
                <Image
                  src={`/images/selected-work/campaign/${image.filename}`}
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
      </div>

      <ImageViewer
        images={viewerImages}
        initialIndex={viewerIndex}
        onClose={() => setViewerIndex(null)}
      />
    </>
  );
}
