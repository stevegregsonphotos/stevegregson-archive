import type { Metadata } from "next";
import Link from "next/link";

import MarketingPrGallery from "../../components/MarketingPrGallery";
import {
  getSelectedWork,
} from "../../lib/selected-work-repository";

import styles from "../selected-work/selected-work.module.css";

export const metadata: Metadata = {
  title: "Marketing & PR Photography",
  alternates: {
    canonical: "/marketing-pr",
  },
  openGraph: {
    type: "website",
    url: "/marketing-pr",
    title: "Marketing & PR Photography | Steve Gregson",
    description: "Marketing, campaign and publicity photography by London theatre photographer Steve Gregson, created for theatres, producers and audiences.",
    images: [
      {
        url: "/images/homepage-hero.jpg",
        width: 2048,
        height: 1365,
        alt: "Theatre production photography by Steve Gregson",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Marketing & PR Photography | Steve Gregson",
    description: "Marketing, campaign and publicity photography by London theatre photographer Steve Gregson, created for theatres, producers and audiences.",
    images: ["/images/homepage-hero.jpg"],
  },
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
    current: true,
  },
];

export default async function MarketingPrPage() {
  const portfolio =
    await getSelectedWork() as SelectedWorkData;

  const campaignImages =
    portfolio.campaign ?? [];
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
        className={`${styles.collection} ${styles.primaryCollection} ${styles.rehearsalsCollection} ${styles.editorialCollection}`}
        id="marketing-pr"
      >
        <MarketingPrGallery
          images={campaignImages}
          featuredIndices={[]}
          galleryClassName={
            styles.editorialGallery
          }
          galleryItemClassName={
            styles.editorialGalleryItem
          }
          featuredClassName={
            styles.editorialGalleryFeatured
          }
          imageClassName={
            styles.editorialGalleryImage
          }
        />

      </section>

      <section
        className={`${styles.archiveCta} ${styles.compactArchiveCta}`}
      >
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
            href="/production"
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