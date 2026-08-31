"use client";

import type { CSSProperties } from "react";
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
  openingFeatureClassName: string;
  productionListClassName: string;
  productionFeatureClassName: string;
  imageFrameClassName: string;
  imageClassName: string;
};

function imageFrameStyle(
  image: RehearsalImage,
): CSSProperties {
  return {
    aspectRatio: `${image.width} / ${image.height}`,
  };
}

export default function RehearsalGallery({
  images,
  openingFeatureClassName,
  productionListClassName,
  productionFeatureClassName,
  imageFrameClassName,
  imageClassName,
}: RehearsalGalleryProps) {
  const [viewerIndex, setViewerIndex] = useState<
    number | null
  >(null);

  const openingImage = images[0];
  const galleryImages = images.slice(1);

  const viewerImages = images.map((image) => ({
    src: `/images/selected-work/rehearsal/${image.filename}`,
    alt: image.alt,
  }));

  return (
    <>
      {openingImage ? (
        <article className={openingFeatureClassName}>
          <button
            type="button"
            className="selected-work-image-button"
            onClick={() => setViewerIndex(0)}
            aria-label="Open rehearsal photograph 1 fullscreen"
          >
            <div
              className={imageFrameClassName}
              style={imageFrameStyle(openingImage)}
            >
              <Image
                src={`/images/selected-work/rehearsal/${openingImage.filename}`}
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

      {images.length === 0 ? (
        <p>
          No photographs have been added to this collection
          yet.
        </p>
      ) : galleryImages.length === 0 ? null : (
        <div className={productionListClassName}>
          {galleryImages.map((image, index) => (
            <article
              className={productionFeatureClassName}
              key={`rehearsal-${image.filename}`}
            >
              <button
                type="button"
                className="selected-work-image-button"
                onClick={() => setViewerIndex(index + 1)}
                aria-label={`Open rehearsal photograph ${index + 2} fullscreen`}
              >
                <div
                  className={imageFrameClassName}
                  style={imageFrameStyle(image)}
                >
                  <Image
                    src={`/images/selected-work/rehearsal/${image.filename}`}
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
      )}

      <ImageViewer
        images={viewerImages}
        initialIndex={viewerIndex}
        onClose={() => setViewerIndex(null)}
      />
    </>
  );
}