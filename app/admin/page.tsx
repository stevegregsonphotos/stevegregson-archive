import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Admin | Steve Gregson Archive",
  robots: {
    index: false,
    follow: false,
  },
};

const adminSections = [
  {
    number: "01",
    title: "New production",
    description:
      "Upload a ZIP of photographs and production details, then create a preview before publishing.",
    href: "/admin/new-production",
    status: "Available",
  },
  {
    number: "02",
    title: "Selected Work",
    description:
      "Upload, arrange and remove the photographs used in the curated public portfolio.",
    href: "/admin/selected-work",
    status: "Available",
  },
  {
    number: "03",
    title: "Productions",
    description:
      "Review, edit and manage the productions already included in the archive.",
    href: "/admin/productions",
    status: "Coming next",
  },
  {
    number: "04",
    title: "People",
    description:
      "Manage directors, designers, choreographers and their professional links.",
    href: "/admin/people",
    status: "Planned",
  },
  {
    number: "05",
    title: "Venues",
    description:
      "Manage theatre information and explore every production photographed at each venue.",
    href: "/admin/venues",
    status: "Planned",
  },
];

export default function AdminPage() {
  return (
    <main className="admin-dashboard">
      <section className="admin-dashboard-intro">
        <p className="admin-dashboard-eyebrow">Steve Gregson Archive</p>

        <h1>Admin</h1>

        <p className="admin-dashboard-lead">
          Private tools for publishing and managing the theatre and
          performance photography archive.
        </p>
      </section>

      <section
        className="admin-dashboard-sections"
        aria-label="Archive administration"
      >
        {adminSections.map((section) => {
          const isAvailable = section.status === "Available";

          return isAvailable ? (
            <Link
              href={section.href}
              className="admin-dashboard-card"
              key={section.title}
            >
              <span className="admin-dashboard-number">{section.number}</span>

              <div className="admin-dashboard-card-copy">
                <h2>{section.title}</h2>
                <p>{section.description}</p>
              </div>

              <div className="admin-dashboard-card-meta">
                <span>{section.status}</span>
                <b aria-hidden="true">→</b>
              </div>
            </Link>
          ) : (
            <article
              className="admin-dashboard-card admin-dashboard-card-disabled"
              key={section.title}
            >
              <span className="admin-dashboard-number">{section.number}</span>

              <div className="admin-dashboard-card-copy">
                <h2>{section.title}</h2>
                <p>{section.description}</p>
              </div>

              <div className="admin-dashboard-card-meta">
                <span>{section.status}</span>
              </div>
            </article>
          );
        })}
      </section>

      <style>{`
        .admin-dashboard {
          min-height: 100vh;
          padding: 11rem 6vw 7rem;
          background: #11100f;
          color: #f2eee6;
        }

        .admin-dashboard-intro {
          width: min(100%, 88rem);
          margin: 0 auto 7rem;
        }

        .admin-dashboard-eyebrow {
          margin: 0;
          color: #c7a369;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        .admin-dashboard h1 {
          margin: 1.4rem 0 0;
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: clamp(5rem, 11vw, 11rem);
          font-weight: 400;
          letter-spacing: -0.065em;
          line-height: 0.85;
        }

        .admin-dashboard-lead {
          max-width: 42rem;
          margin: 3rem 0 0;
          color: rgba(242, 238, 230, 0.67);
          font-size: 1rem;
          line-height: 1.75;
        }

        .admin-dashboard-sections {
          width: min(100%, 88rem);
          margin: 0 auto;
          border-top: 1px solid rgba(242, 238, 230, 0.2);
        }

        .admin-dashboard-card {
          display: grid;
          grid-template-columns: 4rem minmax(0, 1fr) 10rem;
          gap: 2.5rem;
          align-items: center;
          min-height: 11rem;
          padding: 2rem 0;
          border-bottom: 1px solid rgba(242, 238, 230, 0.16);
          transition:
            padding 180ms ease,
            background-color 180ms ease;
        }

        a.admin-dashboard-card:hover {
          padding-inline: 1.2rem;
          background: rgba(255, 255, 255, 0.035);
        }

        .admin-dashboard-number,
        .admin-dashboard-card-meta {
          color: rgba(242, 238, 230, 0.5);
          font-size: 0.53rem;
          font-weight: 700;
          letter-spacing: 0.17em;
          text-transform: uppercase;
        }

        .admin-dashboard-card-copy h2 {
          margin: 0;
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: clamp(2rem, 4vw, 4.5rem);
          font-weight: 400;
          letter-spacing: -0.045em;
          line-height: 1;
        }

        .admin-dashboard-card-copy p {
          max-width: 42rem;
          margin: 1rem 0 0;
          color: rgba(242, 238, 230, 0.62);
          font-size: 0.85rem;
          line-height: 1.65;
        }

        .admin-dashboard-card-meta {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          text-align: right;
        }

        .admin-dashboard-card-meta b {
          color: #c7a369;
          font-size: 1rem;
          transition: transform 180ms ease;
        }

        a.admin-dashboard-card:hover .admin-dashboard-card-meta b {
          transform: translateX(0.3rem);
        }

        .admin-dashboard-card-disabled {
          opacity: 0.42;
        }

        @media (max-width: 760px) {
          .admin-dashboard {
            padding: 9rem 1.4rem 5rem;
          }

          .admin-dashboard-intro {
            margin-bottom: 5rem;
          }

          .admin-dashboard h1 {
            font-size: clamp(4.5rem, 25vw, 8rem);
          }

          .admin-dashboard-card {
            grid-template-columns: 2rem 1fr;
            gap: 1.5rem;
            min-height: auto;
            padding: 2.5rem 0;
          }

          .admin-dashboard-card-meta {
            grid-column: 2;
            justify-content: flex-start;
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}
