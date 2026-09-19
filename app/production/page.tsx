import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import SelectedProductionGallery from "../../components/SelectedProductionGallery";
import {
  getSelectedWork,
} from "../../lib/selected-work-repository";

import {
  getArchiveProductions,
  getProductionIndex,
} from "../../lib/productions-repository";

import {
  getProductionImageUrl,
} from "../../lib/production-image-url";

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

export default async function ProductionPage() {
  const [
    portfolio,
    productionIndex,
    archiveProductions,
  ] = await Promise.all([
    getSelectedWork() as Promise<SelectedWorkData>,
    getProductionIndex(),
    getArchiveProductions(),
  ]);

  const productionImages =
    portfolio.production ?? [];

  const archiveBySlug =
    new Map(
      archiveProductions.map(
        (production) => [
          production.slug,
          production,
        ],
      ),
    );

  const recentProductions =
    productionIndex
      .filter(
        (production) =>
          production.access !== "password",
      )
      .slice(0, 3)
      .map(
        (production) =>
          archiveBySlug.get(
            production.slug,
          ),
      )
      .filter(
        (
          production,
        ): production is NonNullable<
          typeof production
        > => Boolean(production),
      );
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

      {recentProductions.length > 0 ? (
        <section
          className={styles.recentProductions}
          aria-labelledby="recent-productions-title"
        >
          <div
            className={
              styles.recentProductionsHeader
            }
          >
            <div>
              <p className={styles.eyebrow}>
                Recent productions
              </p>

              <h2 id="recent-productions-title">
                From the archive.
              </h2>
            </div>

            <p>
              Explore recent theatre productions
              photographed in performance.
            </p>
          </div>

          <div
            className={
              styles.recentProductionsGrid
            }
          >
            {recentProductions.map(
              (production, index) => (
                <article
                  key={production.slug}
                  className={
                    styles.recentProductionCard
                  }
                >
                  <Link
                    href={`/productions/${production.slug}`}
                    className={
                      styles.recentProductionLink
                    }
                  >
                    <div
                      className={
                        styles.recentProductionImage
                      }
                    >
                      <Image
                        src={getProductionImageUrl(
                          production.slug,
                          production.hero,
                        )}
                        alt={production.heroAlt}
                        fill
                        sizes="(max-width: 760px) calc(100vw - 2.8rem), 30vw"
                        priority={index === 0}
                      />
                    </div>

                    <div
                      className={
                        styles.recentProductionCopy
                      }
                    >
                      <p>
                        {production.venue}
                        <span aria-hidden="true">
                          {" · "}
                        </span>
                        {production.year}
                      </p>

                      <h3>
                        {production.title}
                      </h3>

                      <span
                        className={
                          styles.recentProductionAction
                        }
                      >
                        View production
                        <span aria-hidden="true">
                          →
                        </span>
                      </span>
                    </div>
                  </Link>
                </article>
              ),
            )}
          </div>
        </section>
      ) : null}

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