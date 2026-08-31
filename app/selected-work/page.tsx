import type { Metadata } from "next";
import SelectedWorkGallery from "../../components/SelectedWorkGallery";
import Link from "next/link";

import selectedWorkData from "../../content/selected-work.json";

import styles from "./selected-work-preview.module.css";

export const metadata: Metadata = {
  title:
    "Selected Work Preview | Steve Gregson Theatre Photographer",
  description:
    "A preview of selected production photography by London theatre photographer Steve Gregson.",
};

type SelectedWorkImage = {
  filename: string;
  suggestedFilename?: string;
  alt: string;
  uploadedAt: string;
  width: number;
  height: number;
};

type SelectedWorkData = {
  production: SelectedWorkImage[];
  rehearsal: SelectedWorkImage[];
  campaign: SelectedWorkImage[];
};

const portfolio =
  selectedWorkData as SelectedWorkData;

/*
 * These positions become the large,
 * full-width photographs.
 *
 * The numbers refer to the displayed
 * position in the gallery:
 *
 * 0 = first image
 * 6 = seventh image
 * 12 = thirteenth image
 *
 * Change these numbers later to art-direct
 * which photographs get the biggest impact.
 */


export default function SelectedWorkPreviewPage() {
  /*
   * Start with 15 production photographs.
   *
   * We can increase or decrease this once
   * we've curated the actual gallery.
   */
  const productionImages =
    portfolio.production.slice(0, 15);

  return (
    <main className={styles.page}>
      <section className={styles.introduction}>
        <p className={styles.eyebrow}>
          Selected Work
        </p>

        <div className={styles.introductionLayout}>
          <h1>
            Production photography
            <br />
            built around the life
            <br />
            of a performance.
          </h1>

          <p className={styles.introductionCopy}>
            A curated selection of live performance
            photography capturing the energy,
            atmosphere and visual language of theatre.
          </p>
        </div>
      </section>

      <nav
        className={styles.sectionNavigation}
        aria-label="Photography collections"
      >
        <div className={styles.navigationInner}>
          <a
            href="#production-gallery"
            className={styles.activeNavigationItem}
          >
            Production
          </a>

          <Link href="/rehearsals">
            Rehearsals
          </Link>

          <Link href="/marketing-pr">
            Marketing &amp; PR
          </Link>
        </div>
      </nav>

              <SelectedWorkGallery
          images={productionImages}
          featuredIndices={[0, 7, 14]}
          galleryClassName={styles.gallery}
          galleryItemClassName={styles.galleryItem}
          featuredClassName={styles.featured}
          imageClassName={styles.galleryImage}
        />

      <section className={styles.nextStep}>
        <div className={styles.nextStepHeading}>
          <p className={styles.eyebrow}>
            Explore Further
          </p>

          <h2>
            Looking for a particular production?
          </h2>
        </div>

        <div className={styles.nextStepLinks}>
          <Link href="/production">
            <span>
              More production photography
            </span>

            <span aria-hidden="true">
              →
            </span>
          </Link>

          <Link href="/archive">
            <span>
              Search the archive
            </span>

            <span aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}