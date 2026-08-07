import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import selectedWorkData from "../../../content/selected-work.json";

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

type GalleryLayout =
  | "hero"
  | "wide-left"
  | "wide-right"
  | "half-left"
  | "half-right"
  | "feature"
  | "small-left"
  | "small-right";

type GallerySlot = {
  imageIndex: number;
  layout: GalleryLayout;
};

const portfolio =
  selectedWorkData as SelectedWorkData;

/*
 * This controls the rhythm of the gallery.
 *
 * imageIndex refers to the position of the photograph
 * in selected-work.json.
 *
 * To change the order later, simply change these numbers.
 *
 * The layout affects WIDTH and POSITION only.
 * It never changes the photograph's aspect ratio.
 */
const gallerySlots: GallerySlot[] = [
  {
    imageIndex: 0,
    layout: "hero",
  },
  {
    imageIndex: 1,
    layout: "wide-left",
  },
  {
    imageIndex: 2,
    layout: "wide-right",
  },
  {
    imageIndex: 3,
    layout: "feature",
  },
  {
    imageIndex: 4,
    layout: "half-left",
  },
  {
    imageIndex: 5,
    layout: "half-right",
  },
  {
    imageIndex: 6,
    layout: "hero",
  },
  {
    imageIndex: 7,
    layout: "wide-left",
  },
  {
    imageIndex: 8,
    layout: "small-right",
  },
  {
    imageIndex: 9,
    layout: "feature",
  },
  {
    imageIndex: 10,
    layout: "small-left",
  },
  {
    imageIndex: 11,
    layout: "wide-right",
  },
  {
    imageIndex: 12,
    layout: "hero",
  },
  {
    imageIndex: 13,
    layout: "half-left",
  },
  {
    imageIndex: 14,
    layout: "half-right",
  },
];

function getGalleryImages() {
  const productionImages = portfolio.production ?? [];

  return gallerySlots
    .map((slot) => {
      const image = productionImages[slot.imageIndex];

      if (!image) {
        return null;
      }

      return {
        ...slot,
        image,
      };
    })
    .filter(
      (
        item,
      ): item is GallerySlot & {
        image: SelectedWorkImage;
      } => item !== null,
    );
}

export default function SelectedWorkPreviewPage() {
  const galleryImages = getGalleryImages();

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

      <section
        className={styles.gallery}
        id="production-gallery"
        aria-label="Selected production photography"
      >
        {galleryImages.map(
          ({ image, imageIndex, layout }) => (
            <figure
              className={`${styles.galleryItem} ${styles[layout]}`}
              key={`${image.filename}-${imageIndex}`}
            >
              <Image
                src={`/images/selected-work/production/${image.filename}`}
                alt={image.alt}
                width={image.width}
                height={image.height}
                sizes={
                  layout === "hero" ||
                  layout === "feature"
                    ? "94vw"
                    : "(max-width: 760px) 94vw, 62vw"
                }
                className={styles.galleryImage}
                priority={imageIndex === 0}
              />
            </figure>
          ),
        )}
      </section>

      <section className={styles.productionStatement}>
        <p className={styles.eyebrow}>
          Production Photography
        </p>

        <p>
          Performance happens once.
          <br />
          Photography gives it another life.
        </p>
      </section>

      <section className={styles.nextStep}>
        <div>
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