import Link from "next/link";
import { productions } from "../../lib/productions";

export default function ProductionsPage() {
  const sortedProductions = [...productions].sort((a, b) => {
    return (b.year ?? 0) - (a.year ?? 0);
  });

  return (
    <main className="productions-page">
      <section className="productions-intro">
        <p className="productions-eyebrow">Selected work</p>

        <h1>Productions</h1>

        <p>
          A curated photographic record of theatre, performance and the
          creative teams behind each production.
        </p>
      </section>

      <section className="productions-list" aria-label="Productions">
        {sortedProductions.map((production, index) => (
          <Link
            href={`/productions/${production.slug}`}
            className="production-row"
            key={production.slug}
          >
            <span className="production-number">
              {String(index + 1).padStart(2, "0")}
            </span>

            <span className="production-title">
              {production.title}
            </span>

            <span className="production-meta">
              {production.venue}

              {production.year ? (
                <>
                  <span aria-hidden="true"> · </span>
                  {production.year}
                </>
              ) : null}
            </span>

            <span className="production-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}