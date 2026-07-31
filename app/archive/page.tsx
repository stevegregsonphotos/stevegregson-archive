import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { productions } from "../../lib/productions";

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
    <>
      <main className="archive-page">
        <section className="archive-intro">
          <p className="archive-eyebrow">The archive</p>

          <h1>A living record of performance.</h1>

          <p className="archive-lead">
            Theatre productions, creative teams and moments preserved beyond
            the final curtain.
          </p>
        </section>

        <section className="archive-grid" aria-label="Production archive">
          {sortedProductions.map((production, index) => (
            <Link
              href={`/productions/${production.slug}`}
              className="archive-card"
              key={production.slug}
            >
              <div className="archive-card-image">
                <Image
                  src={`/images/productions/${production.slug}/${production.hero}`}
                  alt={production.heroAlt}
                  fill
                  sizes="(max-width: 800px) 100vw, 50vw"
                />

                <span className="archive-card-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>

              <div className="archive-card-copy">
                <div>
                  <h2>{production.title}</h2>
                  <p>
                    {production.venue}
                    <span aria-hidden="true"> · </span>
                    {production.year}
                  </p>
                </div>

                <span className="archive-card-arrow" aria-hidden="true">
                  →
                </span>
              </div>
            </Link>
          ))}
        </section>
      </main>

      <style>{`
        .archive-page {
          min-height: 100vh;
          background: #11100f;
          color: #f2eee6;
          padding: 10rem 6vw 8rem;
        }

        .archive-intro {
          max-width: 78rem;
          margin-bottom: 7rem;
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
          max-width: 68rem;
          margin: 1.8rem 0 0;
          font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
          font-size: clamp(4rem, 8vw, 8.5rem);
          font-weight: 400;
          letter-spacing: -0.058em;
          line-height: 0.92;
        }

        .archive-lead {
          max-width: 42rem;
          margin: 2.5rem 0 0;
          color: rgba(242, 238, 230, 0.66);
          font-size: 1.05rem;
          line-height: 1.75;
        }

        .archive-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6rem 2rem;
        }

        .archive-card {
          display: block;
        }

        .archive-card-image {
          position: relative;
          aspect-ratio: 4 / 5;
          overflow: hidden;
          background: #191817;
        }

        .archive-card-image img {
          object-fit: cover;
          transition: transform 700ms cubic-bezier(0.2, 0.7, 0.2, 1);
        }

        .archive-card:hover .archive-card-image img {
          transform: scale(1.025);
        }

        .archive-card-number {
          position: absolute;
          top: 1rem;
          left: 1rem;
          z-index: 2;
          font-size: 0.5rem;
          font-weight: 700;
          letter-spacing: 0.16em;
        }

        .archive-card-copy {
          display: flex;
          gap: 2rem;
          align-items: flex-start;
          justify-content: space-between;
          border-top: 1px solid rgba(242, 238, 230, 0.2);
          padding-top: 1.3rem;
          margin-top: 1rem;
        }

        .archive-card-copy h2 {
          margin: 0;
          font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
          font-size: clamp(2rem, 3.5vw, 4rem);
          font-weight: 400;
          letter-spacing: -0.045em;
          line-height: 1;
        }

        .archive-card-copy p {
          margin: 0.8rem 0 0;
          color: rgba(242, 238, 230, 0.58);
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .archive-card-arrow {
          padding-top: 0.4rem;
          font-size: 1.3rem;
          transition: transform 200ms ease;
        }

        .archive-card:hover .archive-card-arrow {
          transform: translateX(0.35rem);
        }

        @media (max-width: 800px) {
          .archive-page {
            padding: 9rem 1.4rem 6rem;
          }

          .archive-intro {
            margin-bottom: 4.5rem;
          }

          .archive-intro h1 {
            font-size: clamp(3.6rem, 14vw, 5.8rem);
          }

          .archive-grid {
            grid-template-columns: 1fr;
            gap: 4.5rem;
          }

          .archive-card-image {
            aspect-ratio: 4 / 5;
          }
        }
      `}</style>
    </>
  );
}