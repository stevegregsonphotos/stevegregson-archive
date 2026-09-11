import type { Metadata } from "next";

import {
  getProductions,
} from "../../lib/productions-repository";

import ArchiveExplorer from "./ArchiveExplorer";

export const metadata: Metadata = {
  title: "Theatre Photography Archive",
  description:
    "Explore Steve Gregson's theatre photography archive, documenting productions, performances, venues and creative teams across London and the performing arts.",
  alternates: {
    canonical: "/archive",
  },
  openGraph: {
    type: "website",
    url: "/archive",
    title: "Theatre Photography Archive | Steve Gregson",
    description: "Explore Steve Gregson's theatre photography archive, documenting productions, performances, venues and creative teams across London and the performing arts.",
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
    title: "Theatre Photography Archive | Steve Gregson",
    description: "Explore Steve Gregson's theatre photography archive, documenting productions, performances, venues and creative teams across London and the performing arts.",
    images: ["/images/homepage-hero.jpg"],
  },
};

export default async function ArchivePage() {
  const productions =
    await getProductions();

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

        <div className="archive-progress-note">
          <p className="archive-progress-title">
            An archive in progress.
          </p>

          <p className="archive-progress-copy">
            Almost two decades of theatre and performance
            photography are currently being catalogued for
            this growing archive. New productions and
            previously unseen work will be added regularly.
          </p>
        </div>
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
          position: relative;
          top: -4rem;
          margin-bottom: -4rem;
          padding: 0 0 2.5rem;
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
          margin: 0.9rem 0 0;
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: clamp(2.8rem, 3.6vw, 4.3rem);
          font-weight: 400;
          letter-spacing: -0.058em;
          line-height: 0.92;
          text-wrap: balance;
        }

        .archive-lead {
          max-width: 40rem;
          margin: 0.9rem 0 0;
          color: rgba(242, 238, 230, 0.62);
          font-size: 0.82rem;
          line-height: 1.6;
          text-wrap: pretty;
        }

        .archive-progress-note {
          max-width: 40rem;
          margin: 1.7rem auto 0;
          padding-top: 1.2rem;
          border-top: 1px solid
            rgba(242, 238, 230, 0.08);
          text-align: center;
        }

        .archive-progress-title {
          margin: 0;
          color: #c7a369;
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .archive-progress-copy {
          max-width: 36rem;
          margin: 0.55rem auto 0;
          color: rgba(242, 238, 230, 0.55);
          font-size: 0.76rem;
          line-height: 1.65;
          text-wrap: pretty;
        }

        @media (max-width: 900px) {
  .archive-page {
    padding: 8.5rem 1.4rem 5rem;
  }

  .archive-search-position {
    justify-content: stretch;
    min-height: auto;
    margin-bottom: 1.5rem;
  }

  .archive-intro {
    top: 0;
    margin-bottom: 0;
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