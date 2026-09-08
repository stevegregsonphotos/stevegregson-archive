"use client";

import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";

const ImageViewer = dynamic(
  () => import("./ImageViewer"),
  {
    ssr: false,
  },
);

type SelectedProductionImage = {
  filename: string;
  alt: string;
  width: number;
  height: number;
};

type SelectedProductionGalleryProps = {
  images: SelectedProductionImage[];
  openingFeatureClassName: string;
  productionListClassName: string;
  productionFeatureClassName: string;
  imageFrameClassName: string;
  imageClassName: string;
};

function imageFrameStyle(
  image: SelectedProductionImage,
): CSSProperties {
  return {
    aspectRatio: `${image.width} / ${image.height}`,
  };
}

export default function SelectedProductionGallery({
  images,
  openingFeatureClassName,
  productionListClassName,
  productionFeatureClassName,
  imageFrameClassName,
  imageClassName,
}: SelectedProductionGalleryProps) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const openingImage = images[0];
  const galleryImages = images.slice(1);

  const viewerImages = images.map((image) => ({
    src: `/images/selected-work/production/${image.filename}`,
    alt: image.alt,
  }));

  if (images.length === 0) {
    return (
      <p>No photographs have been added to this collection yet.</p>
    );
  }

  return (
    <>
      {openingImage ? (
        <article className={openingFeatureClassName}>
          <button
            type="button"
            className="selected-work-image-button"
            onClick={() => setViewerIndex(0)}
            aria-label="Open production photograph 1 fullscreen"
          >
            <div
              className={imageFrameClassName}
              style={imageFrameStyle(openingImage)}
            >
              <Image
                src={`/images/selected-work/production/${openingImage.filename}`}
                alt={openingImage.alt}
                fill
                sizes="(max-width: 900px) calc(100vw - 2.8rem), 88vw"
                className={imageClassName}
                priority
              />
            </div>
          </button>
        </article>
      ) : null}

      {galleryImages.length > 0 ? (
        <div className={productionListClassName}>
          {galleryImages.map((image, index) => (
            <article
              className={productionFeatureClassName}
              key={`production-${image.filename}`}
            >
              <button
                type="button"
                className="selected-work-image-button"
                onClick={() => setViewerIndex(index + 1)}
                aria-label={`Open production photograph ${index + 2} fullscreen`}
              >
                <div
                  className={imageFrameClassName}
                  style={imageFrameStyle(image)}
                >
                  <Image
                    src={`/images/selected-work/production/${image.filename}`}
                    alt={image.alt}
                    fill
                    sizes="(max-width: 900px) calc(100vw - 2.8rem), 88vw"
                    className={imageClassName}
                  />
                </div>
              </button>
            </article>
          ))}
        </div>
      ) : null}

      {viewerIndex !== null ? (
        <ImageViewer
          images={viewerImages}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </>
  );
}
