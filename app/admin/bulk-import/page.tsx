import type { Metadata } from "next";

import { productions } from "../../../content/productions";

import BulkImportClient from "./BulkImportClient";

export const metadata: Metadata = {
  title: "Bulk Import | Steve Gregson Archive",
  robots: {
    index: false,
    follow: false,
  },
};

export default function BulkImportPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "10rem 6vw 6rem",
        background: "#11100f",
        color: "#f2eee6",
      }}
    >
      <section
        style={{
          width: "min(100%, 72rem)",
          margin: "0 auto",
        }}
      >
        <p
          style={{
            margin: "0 0 1.25rem",
            color: "#c7a369",
            fontSize: "0.56rem",
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          Private archive tool
        </p>

        <h1
          style={{
            maxWidth: "60rem",
            margin: 0,
            fontFamily:
              '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
            fontSize: "clamp(4rem, 8vw, 8rem)",
            fontWeight: 400,
            letterSpacing: "-0.055em",
            lineHeight: 0.92,
          }}
        >
          Bulk import
        </h1>

        <p
          style={{
            maxWidth: "46rem",
            margin: "2rem 0 4rem",
            color: "rgba(242, 238, 230, 0.7)",
            lineHeight: 1.75,
          }}
        >
          Import multiple Archive productions in one batch. Production
          details, dates, access settings and photographic metadata will be
          prepared automatically before publishing.
        </p>

        <BulkImportClient
          existingProductions={productions.map(
            (production) => ({
              slug: production.slug,
              title: production.title,
              month: production.month ?? null,
              year: production.year,
            }),
          )}
        />
      </section>
    </main>
  );
}
