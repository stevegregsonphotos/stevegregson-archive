import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import selectedWorkData from "../../content/selected-work.json";

import styles from "../selected-work/selected-work.module.css";

export const metadata: Metadata = {
  title:
    "Production Photography | Steve Gregson Theatre Photographer",
  description:
    "A curated selection of production photography by London theatre photographer Steve Gregson, celebrating the energy, atmosphere and artistry of live performance.",
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
  current?: boolean;
};

const workNavigation: WorkNavigationItem[] = [
  {
    href: "/production",
    label: "Production",
    current: true,
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

const portfolio =
  selectedWorkData as SelectedWorkData;

const productionImages =
  portfolio.production ?? [];

const openingImage =
  productionImages[0];

const galleryImages =
  productionImages.slice(1);

function imageFrameStyle(
  image: SelectedWorkImage,
): CSSProperties {
  return {
    aspectRatio: `${image.width} / ${image.height}`,
  };
}

export default function ProductionPage() {
  return (
    <main className={styles.page}>
      <nav
        className={`${styles.sectionNavigation} ${styles.secondarySectionNavigation}`}
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
              aria-current={
                item.current ? "page" : undefined
              }
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <section
        className={`${styles.intro} ${styles.rehearsalsIntro}`}
      >
        <p className={styles.eyebrow}>
          Production
        </p>

        <h1>
          The Life of a Production.
        </h1>

        <p className={styles.introText}>
          A curated selection of production photography
          celebrating the energy, atmosphere and artistry
          of live performance.
        </p>
      </section>

      <section
        className={`${styles.collection} ${styles.primaryCollection} ${styles.rehearsalsCollection}`}
        id="production"
      >
        {openingImage ? (
          <article
            className={
              styles.rehearsalOpeningFeature
            }
          >
            <div
              className={
                styles.productionImageFrame
              }
              style={imageFrameStyle(
                openingImage,
              )}
            >
              <Image
                src={`/images/selected-work/production/${openingImage.filename}`}
                alt={openingImage.alt}
                fill
                sizes="(max-width: 900px) calc(100vw - 2.8rem), 88vw"
                className={
                  styles.productionImage
                }
                priority
              />
            </div>
          </article>
        ) : null}

        <header
          className={`${styles.collectionHeader} ${styles.rehearsalEditorialHeader}`}
        >
          <p
            className={
              styles.collectionNumber
            }
          >
            01
          </p>

          <div
            className={
              styles.collectionHeadingCopy
            }
          >
            <h2>
              Performance, preserved.
            </h2>

            <p>
              The scale, atmosphere and emotion of live
              performance, captured with precision and
              preserved beyond the final curtain.
            </p>
          </div>
        </header>

        {productionImages.length === 0 ? (
          <p>
            No photographs have been added to this
            collection yet.
          </p>
        ) : galleryImages.length === 0 ? null : (
          <div
            className={styles.productionList}
          >
            {galleryImages.map((image) => (
              <article
                className={
                  styles.productionFeature
                }
                key={`production-${image.filename}`}
              >
                <div
                  className={
                    styles.productionImageFrame
                  }
                  style={imageFrameStyle(
                    image,
                  )}
                >
                  <Image
                    src={`/images/selected-work/production/${image.filename}`}
                    alt={image.alt}
                    fill
                    sizes="(max-width: 900px) calc(100vw - 2.8rem), 88vw"
                    className={
                      styles.productionImage
                    }
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

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