import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import selectedWorkData from "../../content/selected-work.json";

import styles from "./selected-work.module.css";

export const metadata: Metadata = {
  title: "Selected Work | Steve Gregson Theatre Photographer",
  description:
    "Explore selected production, rehearsal, marketing and PR photography by London theatre photographer Steve Gregson.",
};

type CategoryId =
  | "production"
  | "rehearsal"
  | "campaign";

type SelectedWorkImage = {
  filename: string;
  suggestedFilename?: string;
  alt: string;
  uploadedAt: string;
  width: number;
  height: number;
};

type SelectedWorkData = Record<
  CategoryId,
  SelectedWorkImage[]
>;

type WorkNavigationItem = {
  href: string;
  label: string;
};

type FeaturedCollection = {
  id: CategoryId;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  imagePath: string;
};

const workNavigation: WorkNavigationItem[] = [
  {
    href: "/production",
    label: "Production",
  },
  {
    href: "/rehearsals",
    label: "Rehearsals",
  },
  {
    href: "/marketing-pr",
    label: "Marketing & PR",
  },
];

const featuredCollections: FeaturedCollection[] = [
  {
    id: "production",
    eyebrow: "Production",
    title: "The Life of a Production.",
    description:
      "A curated selection of production photography celebrating the energy, atmosphere and artistry of live performance.",
    href: "/production",
    linkLabel: "Explore production",
    imagePath: "/images/selected-work/production",
  },
  {
    id: "rehearsal",
    eyebrow: "Rehearsals",
    title: "The Making of Theatre.",
    description:
      "Photographs from the rehearsal room, documenting the collaboration, experimentation and discovery through which productions take shape.",
    href: "/rehearsals",
    linkLabel: "Explore rehearsals",
    imagePath: "/images/selected-work/rehearsal",
  },
  {
    id: "campaign",
    eyebrow: "Marketing & PR",
    title: "The Image That Sells the Story.",
    description:
      "Campaign and publicity photography created to introduce productions, build anticipation and connect theatres with their audiences.",
    href: "/marketing-pr",
    linkLabel: "Explore marketing and PR",
    imagePath: "/images/selected-work/campaign",
  },
];

const portfolio =
  selectedWorkData as SelectedWorkData;

function imageFrameStyle(
  image: SelectedWorkImage,
): CSSProperties {
  return {
    aspectRatio: `${image.width} / ${image.height}`,
  };
}

export default function SelectedWorkPage() {
  return (
    <main className={styles.page}>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>
          Selected Work
        </p>

        <h1>
          Photography that stays with a production.
        </h1>

        <p className={styles.introText}>
          Created for the stage.
          <br />
          Living long after the applause.
        </p>
      </section>

      <nav
        className={styles.sectionNavigation}
        aria-label="Photography collections"
      >
        <div
          className={
            styles.sectionNavigationInner
          }
        >
          {workNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <section className={styles.selectedWorkIntroduction}>
        <p>
          A curated body of work spanning live
          performance, rehearsal rooms and the imagery
          that introduces theatre to its audience.
        </p>
      </section>

      <div className={styles.landingCollections}>
        {featuredCollections.map(
          (collection, index) => {
            const image =
              portfolio[collection.id]?.[0];

            return (
              <section
                className={`${styles.collection} ${styles.landingCollection}`}
                key={collection.id}
              >
                <header
                  className={
                    styles.landingCollectionHeader
                  }
                >
                  <div
                    className={
                      styles.collectionHeadingCopy
                    }
                  >
                    <div>
                      <p
                        className={`${styles.eyebrow} ${styles.landingCollectionEyebrow}`}
                      >
                        {collection.eyebrow}
                      </p>

                      <h2>
                        {collection.title}
                      </h2>
                    </div>

                    <div
                      className={
                        styles.landingCollectionSummary
                      }
                    >
                      <p>
                        {collection.description}
                      </p>

                      <Link
                        href={collection.href}
                        className={
                          styles.archiveLink
                        }
                      >
                        {collection.linkLabel}
                        <span aria-hidden="true">
                          →
                        </span>
                      </Link>
                    </div>
                  </div>
                </header>

                {image ? (
                  <Link
                    href={collection.href}
                    className={
                      styles.productionImageLink
                    }
                    aria-label={
                      collection.linkLabel
                    }
                  >
                    <div
                      className={`${styles.productionImageFrame} ${styles.landingImageFrame}`}
                      style={imageFrameStyle(
                        image,
                      )}
                    >
                      <Image
                        src={`${collection.imagePath}/${image.filename}`}
                        alt={image.alt}
                        fill
                        sizes="(max-width: 900px) calc(100vw - 2.8rem), 88vw"
                        className={
                          styles.productionImage
                        }
                        priority={index === 0}
                      />
                    </div>
                  </Link>
                ) : (
                  <p>
                    No photographs have been added to
                    this collection yet.
                  </p>
                )}
              </section>
            );
          },
        )}
      </div>

      <section className={styles.archiveCta}>
        <p className={styles.eyebrow}>
          Explore further
        </p>

        <h2>
          Every production. One living archive.
        </h2>

        <div
          className={styles.archiveCtaFooter}
        >
          <p>
            Search the complete body of work by
            production, year, venue and creative
            collaborator.
          </p>

          <Link
            href="/archive"
            className={styles.archiveLink}
          >
            Explore the archive
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}