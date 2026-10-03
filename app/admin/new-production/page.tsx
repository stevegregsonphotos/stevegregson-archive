import type { Metadata } from "next";
import ProductionUpload from "./ProductionUpload";
import styles from "../curated-archive-import/curated-import.module.css";
import np from "./new-production.module.css";

export const metadata: Metadata = {
  title: "New Production | Steve Gregson Archive",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NewProductionPage() {

  return (
    <main className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <p className={styles.eyebrow}>
            Private archive tool
          </p>

          <h1 className={styles.title}>
            New production
          </h1>

          <p className={styles.lead}>
            Choose a production folder of photographs with its details file,
            check the details, pick the hero and publish the production to the
            archive.
          </p>
        </div>

        <aside className={styles.note}>
          <p className={styles.eyebrow}>
            Browser → Cloudflare R2
          </p>

          <p className={np.webpLine}>
            Photos are converted to WebP in your browser before they&apos;re
            uploaded.
          </p>
        </aside>
      </header>

      <ProductionUpload />
    </main>
  );
}
