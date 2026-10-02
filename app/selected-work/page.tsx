import type { Metadata } from "next";
import Link from "next/link";

import SelectedWorkShowcase from "../../components/SelectedWorkShowcase";
import {
  showcaseHero,
  showcaseInterlude,
  showcaseSections,
} from "../../content/selected-work-showcase";

import styles from "./selected-work-preview.module.css";

const DESCRIPTION =
  "Selected theatre photography by London photographer Steve Gregson, including production, dress rehearsal, marketing, rehearsal and backstage photography.";

export const metadata: Metadata = {
  title: "Selected Work",
  description: DESCRIPTION,
  alternates: {
    canonical: "/selected-work",
  },
  openGraph: {
    type: "website",
    url: "/selected-work",
    title: "Selected Work | Steve Gregson",
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
    title: "Selected Work | Steve Gregson",
    description: DESCRIPTION,
    images: ["/images/homepage-hero.webp"],
  },
};

export default function SelectedWorkPage() {
  return (
    <main className={styles.page}>
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

      <SelectedWorkShowcase
        hero={showcaseHero}
        interlude={showcaseInterlude}
        interludeAfter="faces"
        sections={showcaseSections}
      />

      <section className={styles.nextStep}>
        <div className={styles.nextStepHeading}>
          <p className={styles.eyebrow}>Explore Further</p>

          <h2>Looking for a particular production?</h2>
        </div>

        <div className={styles.nextStepLinks}>
          <Link href="/production">
            <span>More production photography</span>
            <span aria-hidden="true">→</span>
          </Link>

          <Link href="/archive">
            <span>Search the archive</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
