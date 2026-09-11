import type { Metadata } from "next";
import Link from "next/link";

import RehearsalGallery from "../../components/RehearsalGallery";
import {
  getSelectedWork,
} from "../../lib/selected-work-repository";

import styles from "../selected-work/selected-work.module.css";

export const metadata: Metadata = {
  title: "Rehearsal & Backstage Photography",
  alternates: {
    canonical: "/rehearsals",
  },
  openGraph: {
    type: "website",
    url: "/rehearsals",
    title: "Rehearsal & Backstage Photography | Steve Gregson",
    description: "Rehearsal and backstage photography by London theatre photographer Steve Gregson, documenting collaboration, experimentation and the making of theatre.",
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
    title: "Rehearsal & Backstage Photography | Steve Gregson",
    description: "Rehearsal and backstage photography by London theatre photographer Steve Gregson, documenting collaboration, experimentation and the making of theatre.",
    images: ["/images/homepage-hero.jpg"],
  },
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
    href: "/production",
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

export default async function RehearsalsPage() {
  const portfolio =
    await getSelectedWork() as SelectedWorkData;

  const rehearsalImages =
    portfolio.rehearsal ?? [];
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
          Rehearsals
        </p>

        <h1>
          The Making of Theatre.
        </h1>

        <p className={styles.introText}>
          Photographs from the rehearsal room,
          documenting the collaboration,
          experimentation and discovery through which
          productions take shape.
        </p>
      </section>

      <section
        className={`${styles.collection} ${styles.primaryCollection} ${styles.rehearsalsCollection} ${styles.editorialCollection}`}
        id="rehearsals"
      >
        <RehearsalGallery
          images={rehearsalImages}
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
          The performance, preserved.
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