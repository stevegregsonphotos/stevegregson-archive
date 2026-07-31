import Link from "next/link";

const productions = [
  {
    title: "The Lonely Londoners",
    venue: "Jermyn Street Theatre",
    year: "2025",
    href: "/productions/lonely-londoners",
  },
  {
    title: "Alice in Wonderland",
    venue: "Theatre Production",
    year: "2025",
    href: "/productions/alice-in-wonderland",
  },
  {
    title: "Girl in the Machine",
    venue: "Theatre Production",
    year: "2024",
    href: "/productions/girl-in-the-machine",
  },
  {
    title: "Extraordinary Women",
    venue: "Theatre Production",
    year: "2024",
    href: "/productions/extraordinary-women",
  },
];

export default function ProductionsPage() {
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
        {productions.map((production, index) => (
          <Link
            href={production.href}
            className="production-row"
            key={production.href}
          >
            <span className="production-number">
              {String(index + 1).padStart(2, "0")}
            </span>

            <span className="production-title">{production.title}</span>

            <span className="production-meta">
              {production.venue}
              <span aria-hidden="true"> · </span>
              {production.year}
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