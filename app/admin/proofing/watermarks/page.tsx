import type { Metadata } from "next";

import {
  getProofingWatermarks,
} from "../../../../lib/proofing/watermarks";

import WatermarkLibraryClient from "./WatermarkLibraryClient";

export const metadata: Metadata = {
  title:
    "Watermarks | Backstage | Steve Gregson",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default function WatermarksPage() {
  const watermarks =
    getProofingWatermarks();

  return (
    <main className="proofing-admin watermark-admin-page">
      <header className="watermark-admin-header">
        <p className="proofing-section-label">
          Client Proofing
        </p>

        <h1>Watermarks</h1>

        <p>
          Manage reusable watermark designs for your
          private client proofing galleries.
        </p>
      </header>

      <WatermarkLibraryClient
        initialWatermarks={watermarks}
      />
    </main>
  );
}
