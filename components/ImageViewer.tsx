"use client";

import Image from "next/image";
import {
  type MouseEvent,
  type TouchEvent,
  useCallback,
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
  const [controlsVisible, setControlsVisible] = useState(true);
  const [imageVisible, setImageVisible] = useState(true);

  const touchStartX = useRef<number | null>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOpen = initialIndex !== null && images.length > 0;

  const showControls = useCallback(() => {
    setControlsVisible(true);

    if (controlsTimer.current) {
      clearTimeout(controlsTimer.current);
    }

    controlsTimer.current = setTimeout(() => {
      setControlsVisible(false);
    }, 2500);
  }, []);

  const changeImage = useCallback(
    (nextIndex: number) => {
      setImageVisible(false);

      window.setTimeout(() => {
        setCurrentIndex(nextIndex);
        setImageVisible(true);
      }, 160);

      showControls();
    },
    [showControls],
  );

  const showPrevious = useCallback(() => {
    const nextIndex =
      (currentIndex - 1 + images.length) % images.length;

    changeImage(nextIndex);
  }, [changeImage, currentIndex, images.length]);

  const showNext = useCallback(() => {
    const nextIndex = (currentIndex + 1) % images.length;

    changeImage(nextIndex);
  }, [changeImage, currentIndex, images.length]);

  useEffect(() => {
    if (initialIndex === null || images.length === 0) return;

    const safeIndex = Math.min(
      Math.max(initialIndex, 0),
      images.length - 1,
    );

    setCurrentIndex(safeIndex);
    setImageVisible(true);
    showControls();
  }, [initialIndex, images.length, showControls]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }

      if (event.key === "ArrowRight") {
        showNext();
      }

      if (event.key === "ArrowLeft") {
        showPrevious();
      }

      showControls();
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousemove", showControls);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousemove", showControls);

      if (controlsTimer.current) {
        clearTimeout(controlsTimer.current);
      }
    };
  }, [
    isOpen,
    onClose,
    showControls,
    showNext,
    showPrevious,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    const previousIndex =
      (currentIndex - 1 + images.length) % images.length;
    const nextIndex = (currentIndex + 1) % images.length;

    [previousIndex, nextIndex].forEach((index) => {
      const preloadImage = new window.Image();
      preloadImage.src = images[index].src;
    });
  }, [currentIndex, images, isOpen]);

  if (!isOpen) {
    return null;
  }

  const currentImage = images[currentIndex];

  if (!currentImage) {
    return null;
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null) return;

    const endX = event.changedTouches[0]?.clientX;

    if (endX === undefined) return;

    const distance = endX - touchStartX.current;

    if (distance > 60) {
      showPrevious();
    }

    if (distance < -60) {
      showNext();
    }

    touchStartX.current = null;
  }

  function handleBackdropClick(
    event: MouseEvent<HTMLDivElement>,
  ) {
    if (event.target === event.currentTarget) {
      showControls();
    }
  }

  return (
    <div
      className="image-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen photography viewer"
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className={`image-viewer-interface ${
          controlsVisible
            ? "image-viewer-interface-visible"
            : ""
        }`}
      >
        <button
          className="image-viewer-close"
          type="button"
          onClick={onClose}
          aria-label="Close image viewer"
        >
          <span>Close</span>
          <span aria-hidden="true">×</span>
        </button>

        <p className="image-viewer-counter">
          {String(currentIndex + 1).padStart(2, "0")}
          <span aria-hidden="true"> / </span>
          {String(images.length).padStart(2, "0")}
        </p>

        <p className="image-viewer-hint">
          Arrow keys to navigate · Esc to close
        </p>
      </div>

      <button
        className={`image-viewer-previous ${
          controlsVisible ? "image-viewer-control-visible" : ""
        }`}
        type="button"
        onClick={showPrevious}
        aria-label="Previous image"
      >
        ←
      </button>

      <div className="image-viewer-stage">
        <Image
          key={currentImage.src}
          src={currentImage.src}
          alt={currentImage.alt}
          fill
          priority
          sizes="100vw"
          className={`image-viewer-image ${
            imageVisible ? "image-viewer-image-visible" : ""
          }`}
        />
      </div>

      <button
        className={`image-viewer-next ${
          controlsVisible ? "image-viewer-control-visible" : ""
        }`}
        type="button"
        onClick={showNext}
        aria-label="Next image"
      >
        →
      </button>
    </div>
  );
}