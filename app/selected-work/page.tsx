import type { Metadata } from "next";
import Link from "next/link";

import SelectedWorkShowcase from "../../components/SelectedWorkShowcase";
import PhotoLicenseJsonLd from "../../components/PhotoLicenseJsonLd";
import { getCachedSelectedWorkPage } from "../../lib/public-data-cache";

import styles from "./selected-work-preview.module.css";

const DESCRIPTION =
  "London theatre photographer Steve Gregson creates production photography for theatres, producers and performing arts organisations across the UK and internationally.";

export const metadata: Metadata = {
  title: "Theatre Production Photography",
  description: DESCRIPTION,
  alternates: {
    canonical: "/selected-work",
  },
  openGraph: {
    type: "website",
    url: "/selected-work",
    title: "Theatre Production Photography | Steve Gregson",
    description: DESCRIPTION,
    images: [
      {
        url: "/images/homepage-hero.webp",
        width: 2048,
        height: 1365,
        alt: "Theatre production photography by Steve Gregson",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Theatre Production Photography | Steve Gregson",
    description: DESCRIPTION,
    images: ["/images/homepage-hero.webp"],
  },
};

// Saving in Backstage refreshes this page straight away; this is a fallback.
export const revalidate = false; // Rebuilt only when Backstage changes something (on-demand revalidation).

export default async function SelectedWorkPage() {
  const { page } = await getCachedSelectedWorkPage();

  return (
    <main className={styles.page}>
      <PhotoLicenseJsonLd pagePath="/selected-work" photos={page.items.map((item) => ({ src: item.src, alt: item.alt }))} />
      <section className={styles.introduction}>
        <p className={styles.eyebrow}>Selected Work</p>

        <h1>Production photography</h1>
      </section>

      <nav
        className={styles.sectionNavigation}
        aria-label="Photography collections"
      >
        <div className={styles.navigationInner}>
          <a
            href="#opening"
            className={styles.activeNavigationItem}
          >
            Production
          </a>

          <Link href="/rehearsals">Rehearsals</Link>

          <Link href="/marketing-pr">Marketing &amp; PR</Link>
        </div>
      </nav>

      <SelectedWorkShowcase items={page.items} />

      <p className={styles.workFor}>
        Production photography for producing theatres, commercial
        producers, opera companies, drama schools and family theatre.
      </p>

      <section className={styles.nextStep}>
        <div className={styles.nextStepHeading}>
          <p className={styles.eyebrow}>Explore Further</p>

          <h2>Looking for a particular production?</h2>
        </div>

        <div className={styles.nextStepLinks}>
          <Link href="/archive">
            <span>Search the archive</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
