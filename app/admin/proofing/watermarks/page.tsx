import type { Metadata } from "next";

import {
  getProofingWatermarks,
} from "../../../../lib/proofing/watermarks";

import Link from "next/link";

import WatermarkLibraryClient from "./WatermarkLibraryClient";
import styles from "./watermarks.module.css";

export const metadata: Metadata = {
  title:
    "Watermarks | Backstage | Steve Gregson",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function WatermarksPage() {
  const watermarks =
    await getProofingWatermarks();

  return (
    <main className={styles.page}>
      <Link href="/admin/proofing" className={styles.back}>
        ← Proofing galleries
      </Link>

      <header>
        <p className={styles.eyebrow}>Client proofing</p>

        <h1 className={styles.title}>Watermarks</h1>

        <p className={styles.lead}>
          Reusable watermarks for your private proofing galleries.
          Choose one in a gallery&apos;s settings.
        </p>
      </header>

      <WatermarkLibraryClient initialWatermarks={watermarks} />
    </main>
  );
}
