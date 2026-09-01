import type { Metadata } from "next";

import { productions } from "../../lib/productions";

import ArchiveExplorer from "./ArchiveExplorer";

export const metadata: Metadata = {
  title: "Archive | Steve Gregson",
  description:
    "A curated archive of theatre productions photographed by Steve Gregson.",
};

export default function ArchivePage() {
  const sortedProductions = [...productions].sort(
    (a, b) => b.year - a.year,
  );

  return (
    <main className="archive-page">
      <section className="archive-search-position">
        <ArchiveExplorer
          productions={sortedProductions}
          mode="search"
        />
      </section>

      <section className="archive-intro">
        <p className="archive-eyebrow">
          The archive
        </p>

        <h1>A living record of theatre.</h1>

        <p className="archive-lead">
          Productions, performances and the people behind
          them — preserved through photography long after
          the curtain falls.
        </p>
      </section>

      <ArchiveExplorer
        productions={sortedProductions}
        mode="results"
      />

      <style>{`
        .archive-page {
          min-height: 100vh;
          background: #11100f;
          color: #f2eee6;
          padding: 6.2rem 4vw 8rem;
        }

        .archive-search-position {
          display: flex;
          justify-content: flex-end;
          min-height: 3rem;
          margin-bottom: 2.5rem;
        }

        .archive-intro {
          padding: 2rem 0 5.5rem;
          border-bottom: 1px solid
            rgba(242, 238, 230, 0.06);
        }

        .archive-eyebrow {
          margin: 0;
          color: #c7a369;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.21em;
          text-transform: uppercase;
        }

        .archive-intro h1 {
          max-width: 12.5ch;
          margin: 2rem 0 0;
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: clamp(4rem, 6.7vw, 7.2rem);
          font-weight: 400;
          letter-spacing: -0.058em;
          line-height: 0.92;
          text-wrap: balance;
        }

        .archive-lead {
          max-width: 40rem;
          margin: 3rem 0 0;
          color: rgba(242, 238, 230, 0.62);
          font-size: 1rem;
          line-height: 1.8;
          text-wrap: pretty;
        }

        @media (max-width: 900px) {
  .archive-page {
  padding: 0 1.4rem 5rem;
}

  .archive-search-position {
    justify-content: stretch;
    min-height: auto;
    margin-bottom: 1.5rem;
  }

  .archive-intro {
  padding: 0 0 1.5rem;
}

  .archive-intro h1 {
    max-width: 21rem;
    margin-top: 1.25rem;
    font-size: clamp(2.8rem, 12vw, 4rem);
    line-height: 0.92;
  }

  .archive-lead {
    max-width: 21rem;
    margin-top: 1.5rem;
    font-size: 0.78rem;
    line-height: 1.65;
  }
}
      `}</style>
    </main>
  );
}