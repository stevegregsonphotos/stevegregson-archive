import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import selectedWorkData from "../../content/selected-work.json";

import styles from "../selected-work/selected-work.module.css";

export const metadata: Metadata = {
  title:
    "Marketing and PR Photography | Steve Gregson Theatre Photographer",
  description:
    "Marketing, campaign and publicity photography by London theatre photographer Steve Gregson, created for theatres, producers and audiences.",
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
  },
  {
    href: "/marketing-pr",
    label: "Marketing & PR",
    current: true,
  },
];

const portfolio =
  selectedWorkData as SelectedWorkData;

const campaignImages =
  portfolio.campaign ?? [];

const openingImage =
  campaignImages[0];

const galleryImages =
  campaignImages.slice(1);

function imageFrameStyle(
  image: SelectedWorkImage,
): CSSProperties {
  return {
    aspectRatio: `${image.width} / ${image.height}`,
  };
}

export default function MarketingPrPage() {
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
          Marketing & PR
        </p>

        <h1>
          The Image That Sells the Story.
        </h1>

        <p className={styles.introText}>
          Campaign and publicity photography created to
          introduce productions, build anticipation and
          connect theatres with their audiences.
        </p>
      </section>

      <section
        className={`${styles.collection} ${styles.primaryCollection} ${styles.rehearsalsCollection}`}
        id="marketing-pr"
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
                src={`/images/selected-work/campaign/${openingImage.filename}`}
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
            03
          </p>

          <div
            className={
              styles.collectionHeadingCopy
            }
          >
            <h2>
              Made for an audience.
            </h2>

            <p>
              Distinctive campaign, press and publicity
              imagery created to give productions a clear
              visual identity across print, press and
              digital media.
            </p>
          </div>
        </header>

        {campaignImages.length === 0 ? (
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
                  key={`campaign-${image.filename}`}
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
                      src={`/images/selected-work/campaign/${image.filename}`}
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
          Performance, preserved.
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