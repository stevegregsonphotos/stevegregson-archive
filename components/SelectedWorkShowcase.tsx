"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";

import type { ShowcaseItem } from "../lib/selected-work-page";

import styles from "../app/selected-work/showcase.module.css";

type SelectedWorkShowcaseProps = {
  items: ShowcaseItem[];
  /** id for the first block of photographs, used by the "Production" tab. */
  anchorId?: string;
};

type Block =
  | { kind: "feature"; item: ShowcaseItem; first: boolean }
  | { kind: "grid"; items: ShowcaseItem[]; gap: boolean };

function Caption({ item }: { item: ShowcaseItem }) {
  if (!item.credit) {
    return null;
  }

  const content = (
    <>
      <span className={styles.captionTitle}>{item.credit.title}</span>
      {item.credit.venue ? (
        <span className={styles.captionMeta}>{item.credit.venue}</span>
      ) : null}
    </>
  );

  return (
    <figcaption className={styles.caption}>
      {item.credit.slug ? (
        <Link href={`/productions/${item.credit.slug}`}>{content}</Link>
      ) : (
        <span className={styles.captionPlain}>{content}</span>
      )}
    </figcaption>
  );
}

function ratioStyle(item: ShowcaseItem) {
  return { "--ratio": (item.width / item.height).toFixed(4) } as React.CSSProperties;
}

function buildBlocks(items: ShowcaseItem[]): Block[] {
  const blocks: Block[] = [];
  let grid: Extract<Block, { kind: "grid" }> | null = null;

  items.forEach((item, index) => {
    if (index === 0 || item.size === "feature") {
      grid = null;
      blocks.push({ kind: "feature", item, first: index === 0 });
      return;
    }

    if (!grid || item.gapBefore) {
      grid = { kind: "grid", items: [], gap: Boolean(item.gapBefore) };
      blocks.push(grid);
    }

    grid.items.push(item);
  });

  return blocks;
}

export default function SelectedWorkShowcase({
  items,
  anchorId = "opening",
}: SelectedWorkShowcaseProps) {
  const blocks = useMemo(() => buildBlocks(items), [items]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const open = useCallback(
    (item: ShowcaseItem) => {
      setViewerIndex(items.findIndex((candidate) => candidate.id === item.id));
    },
    [items],
  );

  const step = useCallback(
    (delta: number) => {
      setViewerIndex((current) =>
        current === null ? current : (current + delta + items.length) % items.length,
      );
    },
    [items.length],
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

  const current = viewerIndex === null ? null : items[viewerIndex];
  const firstGridIndex = blocks.findIndex((block) => block.kind === "grid");

  return (
    <>
      {blocks.map((block, blockIndex) => {
        if (block.kind === "feature") {
          const { item, first } = block;
          return (
            <figure key={item.id} className={styles.bleed} style={ratioStyle(item)}>
              <button
                type="button"
                className={styles.imageButton}
                onClick={() => open(item)}
                aria-label={`View ${item.credit?.title ?? "photograph"} full screen`}
              >
                <Image
                  src={item.src}
                  alt={item.alt}
                  width={item.width}
                  height={item.height}
                  sizes="100vw"
                  className={styles.image}
                  loading={first ? "eager" : "lazy"}
                  fetchPriority={first ? "high" : undefined}
                />
              </button>
              <Caption item={item} />
            </figure>
          );
        }

        const id = blockIndex === firstGridIndex ? anchorId : undefined;

        return (
          <section
            key={block.items[0].id}
            id={id}
            className={block.gap ? `${styles.section} ${styles.sectionGap}` : styles.section}
            aria-label="Production photographs"
          >
            <div className={styles.grid}>
              {block.items.map((item) => (
                <figure key={item.id} className={styles[item.size]} style={ratioStyle(item)}>
                  <button
                    type="button"
                    className={styles.imageButton}
                    onClick={() => open(item)}
                    aria-label={`View ${item.credit?.title ?? "photograph"} full screen`}
                  >
                    <Image
                      src={item.size !== "wide" && item.smallSrc ? item.smallSrc : item.src}
                      alt={item.alt}
                      width={item.width}
                      height={item.height}
                      sizes={
                        item.size === "wide"
                          ? "(max-width: 760px) 100vw, 94vw"
                          : "(max-width: 760px) 100vw, 47vw"
                      }
                      className={styles.image}
                    />
                  </button>
                  <Caption item={item} />
                </figure>
              ))}
            </div>
          </section>
        );
      })}

      {current ? (
        <div
          className={styles.viewer}
          role="dialog"
          aria-modal="true"
          aria-label="Photograph viewer"
          onClick={() => setViewerIndex(null)}
        >
          <div className={styles.viewerFrame} onClick={(event) => event.stopPropagation()}>
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
                    <span>{current.credit.venue}</span>
                  </>
                ) : null}
                <span className={styles.viewerCount}>
                  {viewerIndex! + 1} / {items.length}
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
