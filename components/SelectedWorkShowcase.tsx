"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  ShowcaseChapter,
  ShowcaseImage,
} from "../content/selected-work-showcase";

import styles from "../app/selected-work/showcase.module.css";

type SelectedWorkShowcaseProps = {
  hero: ShowcaseImage;
  interlude: ShowcaseImage;
  interludeAfter: string;
  chapters: ShowcaseChapter[];
};

function Caption({ image }: { image: ShowcaseImage }) {
  if (!image.credit) {
    return (
      <figcaption className={`${styles.caption} ${styles.captionPending}`}>
        Production to be named
      </figcaption>
    );
  }

  return (
    <figcaption className={styles.caption}>
      <Link href={`/productions/${image.credit.slug}`}>
        <span className={styles.captionTitle}>
          {image.credit.title}
        </span>
        <span className={styles.captionMeta}>
          {image.credit.venue} · {image.credit.year}
        </span>
      </Link>
    </figcaption>
  );
}

export default function SelectedWorkShowcase({
  hero,
  interlude,
  interludeAfter,
  chapters,
}: SelectedWorkShowcaseProps) {
  const sequence = useMemo(() => {
    const ordered: ShowcaseImage[] = [hero];

    for (const chapter of chapters) {
      ordered.push(...chapter.images);

      if (chapter.id === interludeAfter) {
        ordered.push(interlude);
      }
    }

    return ordered;
  }, [hero, interlude, interludeAfter, chapters]);

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const open = useCallback(
    (image: ShowcaseImage) => {
      setViewerIndex(sequence.findIndex((item) => item.id === image.id));
    },
    [sequence],
  );

  const step = useCallback(
    (delta: number) => {
      setViewerIndex((current) =>
        current === null
          ? current
          : (current + delta + sequence.length) % sequence.length,
      );
    },
    [sequence.length],
  );

  useEffect(() => {
    if (viewerIndex === null) {
      return;
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setViewerIndex(null);
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [viewerIndex, step]);

  function renderBleed(image: ShowcaseImage, first = false) {
    return (
      <figure className={styles.bleed}>
        <button
          type="button"
          className={styles.imageButton}
          onClick={() => open(image)}
          aria-label={`View ${image.credit?.title ?? "photograph"} full screen`}
        >
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            sizes="100vw"
            className={styles.image}
            loading={first ? "eager" : "lazy"}
            fetchPriority={first ? "high" : undefined}
          />
        </button>
        <Caption image={image} />
      </figure>
    );
  }

  const current = viewerIndex === null ? null : sequence[viewerIndex];

  return (
    <>
      {renderBleed(hero, true)}

      {chapters.map((chapter) => (
        <div key={chapter.id}>
          <section
            id={chapter.id}
            className={styles.chapter}
            aria-labelledby={`${chapter.id}-title`}
          >
            <header className={styles.chapterHeader}>
              <p className={styles.chapterNumber}>{chapter.number}</p>
              <h2 id={`${chapter.id}-title`}>{chapter.title}</h2>
              <p className={styles.chapterStatement}>{chapter.statement}</p>
            </header>

            <div className={styles.grid}>
              {chapter.images.map((image) => (
                <figure
                  key={image.id}
                  className={
                    image.size === "wide" ? styles.wide : styles.half
                  }
                >
                  <button
                    type="button"
                    className={styles.imageButton}
                    onClick={() => open(image)}
                    aria-label={`View ${image.credit?.title ?? "photograph"} full screen`}
                  >
                    <Image
                      src={
                        image.size === "half" && image.smallSrc
                          ? image.smallSrc
                          : image.src
                      }
                      alt={image.alt}
                      width={image.width}
                      height={image.height}
                      sizes={
                        image.size === "wide"
                          ? "(max-width: 760px) 100vw, 94vw"
                          : "(max-width: 760px) 100vw, 47vw"
                      }
                      className={styles.image}
                    />
                  </button>
                  <Caption image={image} />
                </figure>
              ))}
            </div>
          </section>

          {chapter.id === interludeAfter ? renderBleed(interlude) : null}
        </div>
      ))}

      {current ? (
        <div
          className={styles.viewer}
          role="dialog"
          aria-modal="true"
          aria-label="Photograph viewer"
          onClick={() => setViewerIndex(null)}
        >
          <div
            className={styles.viewerFrame}
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={current.src}
              alt={current.alt}
              width={current.width}
              height={current.height}
              sizes="100vw"
              className={styles.viewerImage}
            />

            <div className={styles.viewerBar}>
              <p>
                {current.credit ? (
                  <>
                    <strong>{current.credit.title}</strong>{" "}
                    <span>
                      {current.credit.venue} · {current.credit.year}
                    </span>
                  </>
                ) : (
                  <strong>Production to be named</strong>
                )}
                <span className={styles.viewerCount}>
                  {viewerIndex! + 1} / {sequence.length}
                </span>
              </p>

              <div className={styles.viewerControls}>
                <button type="button" onClick={() => step(-1)} aria-label="Previous photograph">
                  ←
                </button>
                <button type="button" onClick={() => step(1)} aria-label="Next photograph">
                  →
                </button>
                <button type="button" onClick={() => setViewerIndex(null)} aria-label="Close viewer">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
