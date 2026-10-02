"use client";

/* eslint-disable @next/next/no-img-element -- photos come from our own image hosts at fixed sizes */

import { useState } from "react";

import {
  COMMISSIONS_SLOTS,
  type CommissionsImages,
  type CommissionsPicture,
  type CommissionsSlot,
  type ShowcaseItem,
} from "../../../lib/selected-work-page";

import type { Doc } from "./library/draft";
import PhotoSources, { type PickedImage, type ProductionOption } from "./PhotoSources";

import styles from "./backstage-selected-work.module.css";

type Change = (label: string, key: string | undefined, mutate: (doc: Doc) => Doc) => void;

export function slotName(slot: CommissionsSlot) {
  const label = COMMISSIONS_SLOTS.find((candidate) => candidate.id === slot)?.label ?? slot;
  return slot === "hero" ? "Top of the page" : label.replace(/^Box:\s*/, "");
}

export default function CommissionsTab({
  chosen,
  automatic,
  productions,
  pageItems,
  change,
}: {
  chosen: CommissionsImages;
  automatic: Partial<Record<CommissionsSlot, CommissionsPicture>>;
  productions: ProductionOption[];
  pageItems: ShowcaseItem[];
  change: Change;
}) {
  const [activeSlot, setActiveSlot] = useState<CommissionsSlot | null>(null);
  const [pending, setPending] = useState<PickedImage | null>(null);

  function open(slot: CommissionsSlot) {
    setActiveSlot(slot);
    setPending(null);
  }

  function badge(slot: CommissionsSlot, solid = false) {
    if (activeSlot === slot) return <span className={styles.badgeChanging}>Changing…</span>;
    return chosen[slot] ? (
      <span className={solid ? `${styles.badgeChosen} ${styles.badgeSolid}` : styles.badgeChosen}>Chosen by you</span>
    ) : (
      <span className={styles.badgeAuto}>Automatic</span>
    );
  }

  function picture(slot: CommissionsSlot) {
    const shown = chosen[slot] ?? automatic[slot];
    return shown ? <img src={shown.src} alt={shown.alt} loading="lazy" /> : <div className={styles.tilePlaceholder} />;
  }

  const boxes = COMMISSIONS_SLOTS.filter((slot) => slot.id !== "hero");

  return (
    <div>
      <p className={styles.intro}>
        Laid out like the Commissions page. Click any box to choose its photo, or leave it on automatic: automatic boxes
        keep picking a photo for themselves.
      </p>

      <div className={styles.commWorkspace}>
        <div className={styles.commLayout} data-testid="commissions-layout">
          <figure
            className={activeSlot === "hero" ? `${styles.commHero} ${styles.tileActive}` : styles.commHero}
            tabIndex={0}
            role="button"
            aria-label="Top of the page: choose a photo"
            onClick={() => open("hero")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open("hero");
              }
            }}
          >
            {picture("hero")}
            <span className={styles.commHeroBar}>
              <span>Top of the page</span>
              {badge("hero", true)}
            </span>
          </figure>

          <div className={styles.commGrid}>
            {boxes.map((slot) => (
              <figure
                key={slot.id}
                className={activeSlot === slot.id ? `${styles.commBox} ${styles.tileActive}` : styles.commBox}
                tabIndex={0}
                role="button"
                data-testid={`box-${slot.id}`}
                aria-label={`${slotName(slot.id)}: choose a photo`}
                onClick={() => open(slot.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    open(slot.id);
                  }
                }}
              >
                {picture(slot.id)}
                <figcaption className={styles.commCaption}>
                  <span>{slotName(slot.id)}</span>
                  {badge(slot.id)}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        {activeSlot ? (
          <aside className={styles.chooser} aria-label={`Choose a photo: ${slotName(activeSlot)}`} data-testid="chooser">
            <div className={styles.panelHead}>
              <span className={styles.chooserTitle}>Choose a photo: {slotName(activeSlot)}</span>
              <button type="button" className={styles.close} aria-label="Close" onClick={() => setActiveSlot(null)}>
                ×
              </button>
            </div>
            <PhotoSources
              key={activeSlot}
              sources={["production", "page", "library"]}
              productions={productions}
              pageItems={pageItems}
              selectedSrc={pending?.src}
              onSelect={setPending}
            />
            <div className={styles.chooserFoot}>
              <button
                type="button"
                className={styles.btn}
                disabled={!chosen[activeSlot]}
                onClick={() => {
                  const slot = activeSlot;
                  change(`${slotName(slot)} box: back to automatic`, undefined, (doc) => {
                    const next = { ...doc.chosen };
                    delete next[slot];
                    return { ...doc, chosen: next };
                  });
                  setActiveSlot(null);
                }}
              >
                Back to automatic
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={!pending}
                onClick={() => {
                  if (!pending) return;
                  const slot = activeSlot;
                  const big = slot === "hero";
                  const src = big ? pending.src : pending.smallSrc || pending.src;
                  change(`${slotName(slot)} box: new photo`, undefined, (doc) => ({
                    ...doc,
                    chosen: { ...doc.chosen, [slot]: { src, alt: pending.alt } },
                  }));
                  setActiveSlot(null);
                  setPending(null);
                }}
              >
                Use this photo
              </button>
            </div>
          </aside>
        ) : (
          <aside className={styles.panel}>
            <p className={styles.panelEmpty}>
              Click the top picture or any box to choose its photo from a production, from the Selected Work page or
              from the photo library.
            </p>
            <p className={styles.sizeNote}>Nothing changes on the live Commissions page until you press Save &amp; publish.</p>
          </aside>
        )}
      </div>
    </div>
  );
}
