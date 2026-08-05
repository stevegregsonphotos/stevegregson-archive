import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import selectedWorkData from "../../content/selected-work.json";

import styles from "../selected-work/selected-work.module.css";

export const metadata: Metadata = {
  title:
    "Rehearsal Photography | Steve Gregson Theatre Photographer",
  description:
    "Rehearsal and backstage photography by London theatre photographer Steve Gregson, documenting collaboration, experimentation and the making of theatre.",
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
    href: "/selected-work",
    label: "Production",
  },
  {
    href: "/rehearsals",
    label: "Rehearsals",
    current: true,
  },
  {
    href: "/marketing-pr",
    label: "Marketing & PR",
  },
];

const portfolio =
  selectedWorkData as SelectedWorkData;

const rehearsalImages =
  portfolio.rehearsal ?? [];

const openingImage =
  rehearsalImages[0];

const galleryImages =
  rehearsalImages.slice(1);

function imageFrameStyle(
  image: SelectedWorkImage,
): CSSProperties {
  return {
    aspectRatio: `${image.width} / ${image.height}`,
  };
}

export default function RehearsalsPage() {
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
          Rehearsals
        </p>

        <h1>
          The Making of Theatre.
        </h1>

        <p className={styles.introText}>
          Photographs from the rehearsal room,
          documenting the collaboration, experimentation
          and discovery through which productions take
          shape.
        </p>
      </section>

      <section
        className={`${styles.collection} ${styles.primaryCollection} ${styles.rehearsalsCollection}`}
        id="rehearsals"
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
                src={`/images/selected-work/rehearsal/${openingImage.filename}`}
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
            02
          </p>

          <div
            className={
              styles.collectionHeadingCopy
            }
          >
            <h2>
              Inside the rehearsal room.
            </h2>

            <p>
              Before an audience arrives, performers,
              directors and creative teams test ideas,
              discover relationships and shape the rhythm
              and character of a production.
            </p>
          </div>
        </header>

        {rehearsalImages.length === 0 ? (
          <p>
            No photographs have been added to this
            collection yet.
          </p>
        ) : galleryImages.length === 0 ? null : (
          <div
            className={styles.productionList}
          >
            {galleryImages.map(
              (image) => (
                <article
                  className={
                    styles.productionFeature
                  }
                  key={`rehearsal-${image.filename}`}
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
                      src={`/images/selected-work/rehearsal/${image.filename}`}
                      alt={image.alt}
                      fill
                      sizes="(max-width: 900px) calc(100vw - 2.8rem), 88vw"
                      className={
                        styles.productionImage
                      }
                    />
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </section>

      <section className={styles.archiveCta}>
        <p className={styles.eyebrow}>
          Explore further
        </p>

        <h2>
          The performance, preserved.
        </h2>

        <div
          className={styles.archiveCtaFooter}
        >
          <p>
            Explore selected production photography
            capturing the atmosphere, scale and emotion
            of live performance.
          </p>

          <Link
            href="/selected-work"
            className={styles.archiveLink}
          >
            View production photography
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}