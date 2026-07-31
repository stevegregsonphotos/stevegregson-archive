"use client";

import Image from "next/image";
import {
  type TouchEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type ViewerImage = {
  src: string;
  alt: string;
};

type ImageViewerProps = {
  images: ViewerImage[];
  initialIndex: number | null;
  onClose: () => void;
};

export default function ImageViewer({
  images,
  initialIndex,
  onClose,
}: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const isOpen = initialIndex !== null && images.length > 0;

  useEffect(() => {
    if (initialIndex === null || images.length === 0) return;

    const safeIndex = Math.min(
      Math.max(initialIndex, 0),
      images.length - 1,
    );

    setCurrentIndex(safeIndex);
  }, [initialIndex, images.length]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }

      if (event.key === "ArrowRight") {
        setCurrentIndex(
          (index) => (index + 1) % images.length,
        );
      }

      if (event.key === "ArrowLeft") {
        setCurrentIndex(
          (index) =>
            (index - 1 + images.length) % images.length,
        );
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [images.length, isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const currentImage = images[currentIndex];

  if (!currentImage) {
    return null;
  }

  function showPrevious() {
    setCurrentIndex(
      (index) =>
        (index - 1 + images.length) % images.length,
    );
  }

  function showNext() {
    setCurrentIndex(
      (index) => (index + 1) % images.length,
    );
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null) return;

    const endX = event.changedTouches[0]?.clientX;

    if (endX === undefined) {
      touchStartX.current = null;
      return;
    }

    const distance = endX - touchStartX.current;

    if (distance > 60) {
      showPrevious();
    }

    if (distance < -60) {
      showNext();
    }

    touchStartX.current = null;
  }

  return (
    <div
      className="image-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen photography viewer"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        className="image-viewer-close"
        type="button"
        onClick={onClose}
        aria-label="Close image viewer"
      >
        Close ✕
      </button>

      <button
        className="image-viewer-previous"
        type="button"
        onClick={showPrevious}
        aria-label="Previous image"
      >
        ←
      </button>

      <div className="image-viewer-stage">
        <Image
          src={currentImage.src}
          alt={currentImage.alt}
          fill
          priority
          sizes="100vw"
          className="image-viewer-image"
        />
      </div>

      <button
        className="image-viewer-next"
        type="button"
        onClick={showNext}
        aria-label="Next image"
      >
        →
      </button>

      <p className="image-viewer-counter">
        {String(currentIndex + 1).padStart(2, "0")} /{" "}
        {String(images.length).padStart(2, "0")}
      </p>
    </div>
  );
}