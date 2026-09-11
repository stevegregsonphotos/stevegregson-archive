"use client";

import { getSelectedWorkImageUrl } from "@/lib/selected-work-image-url";
import Image from "next/image";
import { useState } from "react";

import ImageViewer from "./ImageViewer";

type RehearsalImage = {
  filename: string;
  alt: string;
  width: number;
  height: number;
};

type RehearsalGalleryProps = {
  images: RehearsalImage[];
  featuredIndices: number[];
  galleryClassName: string;
  galleryItemClassName: string;
  featuredClassName: string;
  imageClassName: string;
};

export default function RehearsalGallery({
  images,
  featuredIndices,
  galleryClassName,
  galleryItemClassName,
  featuredClassName,
  imageClassName,
}: RehearsalGalleryProps) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const featured = new Set(featuredIndices);

  const viewerImages = images.map((image) => ({
    src: getSelectedWorkImageUrl("rehearsal", image.filename),
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
                aria-label={`Open rehearsal photograph ${index + 1} fullscreen`}
              >
                <Image
                  src={getSelectedWorkImageUrl("rehearsal", image.filename)}
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
