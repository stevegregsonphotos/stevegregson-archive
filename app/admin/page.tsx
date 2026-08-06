import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Backstage | Steve Gregson Archive",
  robots: {
    index: false,
    follow: false,
  },
};

const secondaryActions = [
  {
    title: "Selected Work",
    description:
      "Upload, arrange and remove photographs from the curated public portfolio.",
    href: "/admin/selected-work",
    label: "Manage portfolio",
  },
  {
    title: "Settings",
    description:
      "Review publishing, storage and Vision AI configuration.",
    href: "/admin/settings",
    label: "View settings",
  },
];

export default function AdminPage() {
  return (
    <main className="backstage-dashboard">
      <header className="backstage-header">
        <Link
          href="/"
          className="backstage-brand"
          aria-label="Return to the Steve Gregson Archive"
        >
          <span>Steve Gregson</span>
          <span>Archive</span>
        </Link>

        <nav
          className="backstage-utilities"
          aria-label="Backstage utilities"
        >
          <Link href="/productions">
            View archive
          </Link>

          <Link href="/">
            View website
          </Link>
        </nav>
      </header>

      <div className="backstage-shell">
        <section className="backstage-intro">
          <p className="backstage-eyebrow">
            Private archive tools
          </p>

          <h1>Backstage</h1>

          <p className="backstage-lead">
            Upload, prepare and publish new work to the Steve
            Gregson Archive.
          </p>
        </section>

        <section
          className="backstage-primary"
          aria-labelledby="publish-heading"
        >
          <div className="backstage-primary-number">
            01
          </div>

          <div className="backstage-primary-copy">
            <p>Primary workflow</p>

            <h2 id="publish-heading">
              Upload &amp;
              <br />
              publish
            </h2>

            <p className="backstage-primary-description">
              Add a production ZIP, review the photographs,
              complete the production details and publish the
              finished page to the archive.
            </p>
          </div>

          <Link
            href="/admin/new-production"
            className="backstage-primary-link"
          >
            <span>Start a new production</span>
            <span aria-hidden="true">→</span>
          </Link>
        </section>

        <section
          className="backstage-secondary"
          aria-label="Additional Backstage tools"
        >
          {secondaryActions.map((action, index) => (
            <Link
              href={action.href}
              className="backstage-secondary-card"
              key={action.href}
            >
              <span className="backstage-secondary-number">
                {String(index + 2).padStart(2, "0")}
              </span>

              <div className="backstage-secondary-copy">
                <h2>{action.title}</h2>
                <p>{action.description}</p>
              </div>

              <div className="backstage-secondary-link">
                <span>{action.label}</span>
                <span aria-hidden="true">→</span>
              </div>
            </Link>
          ))}
        </section>

        <footer className="backstage-footer">
          <p>
            You only need to remember:
          </p>

          <code>/admin</code>
        </footer>
      </div>

      <style>{`
        .backstage-dashboard {
          min-height: 100vh;
          background: #11100f;
          color: #f2eee6;
        }

        .backstage-header {
          position: relative;
          z-index: 2;
          display: flex;
          justify-content: space-between;
          align-items: center;
          min-height: 7rem;
          padding: 0 4vw;
          border-bottom: 1px solid rgba(242, 238, 230, 0.14);
        }

        .backstage-brand {
          display: flex;
          flex-direction: column;
          gap: 0.12rem;
          font-size: 0.58rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          line-height: 1.25;
          text-transform: uppercase;
        }

        .backstage-brand span:last-child {
          color: rgba(242, 238, 230, 0.48);
        }

        .backstage-utilities {
          display: flex;
          align-items: center;
          gap: 2rem;
          color: rgba(242, 238, 230, 0.62);
          font-size: 0.54rem;
          font-weight: 700;
          letter-spacing: 0.17em;
          text-transform: uppercase;
        }

        .backstage-utilities a {
          transition: color 180ms ease;
        }

        .backstage-utilities a:hover {
          color: #c7a369;
        }

        .backstage-shell {
          width: min(100% - 8vw, 88rem);
          margin: 0 auto;
          padding: 8rem 0 5rem;
        }

        .backstage-intro {
          display: grid;
          grid-template-columns:
            minmax(0, 1.2fr)
            minmax(18rem, 0.8fr);
          column-gap: 5rem;
          align-items: end;
          margin-bottom: 7rem;
        }

        .backstage-eyebrow {
          grid-column: 1 / -1;
          margin: 0 0 1.5rem;
          color: #c7a369;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        .backstage-intro h1 {
          margin: 0;
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: clamp(5rem, 11vw, 11rem);
          font-weight: 400;
          letter-spacing: -0.07em;
          line-height: 0.8;
        }

        .backstage-lead {
          max-width: 34rem;
          margin: 0 0 0.5rem;
          color: rgba(242, 238, 230, 0.64);
          font-size: 1rem;
          line-height: 1.75;
        }

        .backstage-primary {
          display: grid;
          grid-template-columns:
            5rem
            minmax(0, 1fr)
            minmax(16rem, 22rem);
          gap: 2.5rem;
          align-items: stretch;
          min-height: 32rem;
          border-top: 1px solid rgba(242, 238, 230, 0.22);
          border-bottom: 1px solid rgba(242, 238, 230, 0.22);
          padding: 3rem 0;
        }

        .backstage-primary-number,
        .backstage-secondary-number {
          color: rgba(242, 238, 230, 0.4);
          font-size: 0.53rem;
          font-weight: 700;
          letter-spacing: 0.17em;
        }

        .backstage-primary-copy {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .backstage-primary-copy > p:first-child {
          margin: 0;
          color: #c7a369;
          font-size: 0.53rem;
          font-weight: 700;
          letter-spacing: 0.17em;
          text-transform: uppercase;
        }

        .backstage-primary-copy h2 {
          margin: 2.5rem 0;
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: clamp(4rem, 7.5vw, 8rem);
          font-weight: 400;
          letter-spacing: -0.06em;
          line-height: 0.85;
        }

        .backstage-primary-description {
          max-width: 39rem;
          margin: 0;
          color: rgba(242, 238, 230, 0.62);
          font-size: 0.9rem;
          line-height: 1.75;
        }

        .backstage-primary-link {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 100%;
          border: 1px solid rgba(199, 163, 105, 0.65);
          padding: 2rem;
          background: #c7a369;
          color: #11100f;
          font-size: 0.57rem;
          font-weight: 700;
          letter-spacing: 0.17em;
          text-transform: uppercase;
          transition:
            background-color 180ms ease,
            color 180ms ease,
            transform 180ms ease;
        }

        .backstage-primary-link span:last-child {
          align-self: flex-end;
          font-size: 2.2rem;
          font-weight: 400;
          line-height: 1;
          transition: transform 180ms ease;
        }

        .backstage-primary-link:hover {
          background: #f2eee6;
          transform: translateY(-0.25rem);
        }

        .backstage-primary-link:hover span:last-child {
          transform: translateX(0.35rem);
        }

        .backstage-secondary {
          margin-top: 6rem;
          border-top: 1px solid rgba(242, 238, 230, 0.18);
        }

        .backstage-secondary-card {
          display: grid;
          grid-template-columns:
            5rem
            minmax(0, 1fr)
            minmax(11rem, 15rem);
          gap: 2.5rem;
          align-items: center;
          min-height: 11rem;
          border-bottom: 1px solid rgba(242, 238, 230, 0.14);
          padding: 2rem 0;
          transition:
            padding 180ms ease,
            background-color 180ms ease;
        }

        .backstage-secondary-card:hover {
          padding-inline: 1.2rem;
          background: rgba(255, 255, 255, 0.03);
        }

        .backstage-secondary-copy h2 {
          margin: 0;
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: clamp(2.2rem, 4vw, 4.2rem);
          font-weight: 400;
          letter-spacing: -0.045em;
          line-height: 1;
        }

        .backstage-secondary-copy p {
          max-width: 42rem;
          margin: 1rem 0 0;
          color: rgba(242, 238, 230, 0.58);
          font-size: 0.84rem;
          line-height: 1.65;
        }

        .backstage-secondary-link {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          color: #c7a369;
          font-size: 0.53rem;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .backstage-secondary-link span:last-child {
          font-size: 1rem;
          transition: transform 180ms ease;
        }

        .backstage-secondary-card:hover
          .backstage-secondary-link
          span:last-child {
          transform: translateX(0.3rem);
        }

        .backstage-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 7rem;
          border-top: 1px solid rgba(242, 238, 230, 0.14);
          padding-top: 2rem;
          color: rgba(242, 238, 230, 0.42);
          font-size: 0.7rem;
        }

        .backstage-footer p {
          margin: 0;
        }

        .backstage-footer code {
          color: #c7a369;
          font-family: inherit;
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        @media (max-width: 900px) {
          .backstage-intro {
            grid-template-columns: 1fr;
            gap: 2.5rem;
          }

          .backstage-lead {
            margin: 0;
          }

          .backstage-primary {
            grid-template-columns: 3rem 1fr;
          }

          .backstage-primary-link {
            grid-column: 2;
            min-height: 13rem;
          }

          .backstage-secondary-card {
            grid-template-columns: 3rem 1fr;
          }

          .backstage-secondary-link {
            grid-column: 2;
            justify-content: flex-start;
          }
        }

        @media (max-width: 640px) {
          .backstage-header {
            min-height: 6rem;
            padding-inline: 1.4rem;
          }

          .backstage-utilities {
            gap: 1rem;
          }

          .backstage-utilities a:first-child {
            display: none;
          }

          .backstage-shell {
            width: calc(100% - 2.8rem);
            padding-top: 6rem;
          }

          .backstage-intro {
            margin-bottom: 5rem;
          }

          .backstage-intro h1 {
            font-size: clamp(4.5rem, 24vw, 7rem);
          }

          .backstage-primary {
            grid-template-columns: 1fr;
            gap: 2rem;
            min-height: auto;
          }

          .backstage-primary-number {
            display: none;
          }

          .backstage-primary-copy h2 {
            margin: 2rem 0;
          }

          .backstage-primary-link {
            grid-column: 1;
          }

          .backstage-secondary-card {
            grid-template-columns: 2rem 1fr;
            gap: 1.25rem;
            padding: 2.5rem 0;
          }

          .backstage-secondary-link {
            grid-column: 2;
          }

          .backstage-footer {
            align-items: flex-start;
            gap: 1rem;
          }
        }
      `}</style>
    </main>
  );
}