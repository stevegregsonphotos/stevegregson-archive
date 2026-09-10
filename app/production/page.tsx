import type { Metadata } from "next";
import Link from "next/link";

import SelectedProductionGallery from "../../components/SelectedProductionGallery";
import selectedWorkData from "../../content/selected-work.json";

import styles from "../selected-work/selected-work.module.css";

export const metadata: Metadata = {
  title: "London Theatre & Production Photographer",
  alternates: {
    canonical: "/production",
  },
  openGraph: {
    type: "website",
    url: "/production",
    title: "London Theatre & Production Photographer | Steve Gregson",
    description: "London theatre photographer Steve Gregson creates production photography for theatres, producers and performing arts organisations across the UK and internationally.",
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
    title: "London Theatre & Production Photographer | Steve Gregson",
    description: "London theatre photographer Steve Gregson creates production photography for theatres, producers and performing arts organisations across the UK and internationally.",
    images: ["/images/homepage-hero.jpg"],
  },
  description:
    "London theatre photographer Steve Gregson creates production photography for theatres, producers and performing arts organisations across the UK and internationally.",
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
          Production photography by London theatre
          photographer Steve Gregson, capturing the energy,
          atmosphere and artistry of live performance for
          theatres, producers and performing arts
          organisations across the UK and internationally.
        </p>
      </section>

      <section
        className={`${styles.collection} ${styles.primaryCollection} ${styles.rehearsalsCollection} ${styles.editorialCollection}`}
        id="production"
      >
        <SelectedProductionGallery
          images={productionImages}
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


      </section>

      <section
        className={`${styles.archiveCta} ${styles.compactArchiveCta}`}
      >
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