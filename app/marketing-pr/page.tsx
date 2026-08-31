import type { Metadata } from "next";
import Link from "next/link";

import MarketingPrGallery from "../../components/MarketingPrGallery";
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
                item.current
                  ? "page"
                  : undefined
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
          Marketing &amp; PR
        </p>

        <h1>
          The Image That Sells the Story.
        </h1>

        <p className={styles.introText}>
          Campaign and publicity photography created
          to introduce productions, build anticipation
          and connect theatres with their audiences.
        </p>
      </section>

      <section
        className={`${styles.collection} ${styles.primaryCollection} ${styles.rehearsalsCollection}`}
        id="marketing-pr"
      >
        <MarketingPrGallery
          images={campaignImages}
          openingFeatureClassName={
            styles.rehearsalOpeningFeature
          }
          productionListClassName={
            styles.productionList
          }
          productionFeatureClassName={
            styles.productionFeature
          }
          imageFrameClassName={
            styles.productionImageFrame
          }
          imageClassName={
            styles.productionImage
          }
        />

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
              Distinctive campaign, press and
              publicity imagery created to give
              productions a clear visual identity
              across print, press and digital media.
            </p>
          </div>
        </header>
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
            capturing the atmosphere, scale and
            emotion of live performance.
          </p>

          <Link
            href="/selected-work"
            className={styles.archiveLink}
          >
            View production photography
            <span aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}