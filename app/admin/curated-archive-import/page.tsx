import type { Metadata } from "next";

import {
  getProductionIndex,
} from "../../../lib/productions-repository";

import CuratedArchiveImportClient from "./CuratedArchiveImportClient";
import styles from "./curated-import.module.css";

export const metadata: Metadata = {
  title: "Curated Archive Import | Steve Gregson Archive",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CuratedArchiveImportPage() {
  const productions =
    await getProductionIndex();

  return (
    <main className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <p className={styles.eyebrow}>
            Private archive tool
          </p>

          <h1 className={styles.title}>
            Curated archive import
          </h1>

          <p className={styles.lead}>
            Import productions that have already been curated and researched.
            Final image selections, hero choices, sequencing and production
            metadata are treated as authoritative. This workflow does not run
            the OpenAI vision review or metadata-analysis pipeline.
          </p>
        </div>

        <aside className={styles.note}>
          <p className={styles.eyebrow}>
            Zero-AI import path
          </p>

          <p>
            Curated Archive Import does not
            call the vision review or
            image-analysis endpoints used
            by general Bulk Import.
          </p>
        </aside>
      </header>

      <CuratedArchiveImportClient
        existingProductions={productions.map(
          (production) => ({
            slug: production.slug,
            title: production.title,
            month: production.month ?? null,
            year: production.year,
          }),
        )}
      />
    </main>
  );
}
