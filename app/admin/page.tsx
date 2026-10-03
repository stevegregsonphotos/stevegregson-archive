import type { Metadata } from "next";
import Link from "next/link";

import styles from "./backstage-dashboard.module.css";

export const metadata: Metadata = {
  title: "Backstage | Steve Gregson Archive",
  robots: {
    index: false,
    follow: false,
  },
};

const secondaryActions = [
  {
    title: "Client Proofing",
    description:
      "Create and manage private client galleries, image selections and favourites.",
    href: "/admin/proofing",
    label: "Manage galleries",
  },
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
    <main className={styles.page}>
      <div className={styles.head}>
        <div>
          <p className={styles.eyebrow}>
            Private archive tools
          </p>

          <h1 className={styles.title}>Backstage</h1>

          <p className={styles.lead}>
            Upload, prepare and publish new work to the Steve
            Gregson Archive.
          </p>
        </div>

        <nav
          className={styles.headLinks}
          aria-label="Backstage utilities"
        >
          <Link href="/productions">
            View archive <span aria-hidden="true">↗</span>
          </Link>

          <Link href="/">
            View website <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </div>

      <section
        className={styles.primary}
        aria-labelledby="publish-heading"
      >
        <div className={styles.primaryCopy}>
          <div className={styles.primaryTop}>
            <span className={styles.num}>01</span>
            <span className={styles.label}>
              Primary workflow
            </span>
          </div>

          <h2
            id="publish-heading"
            className={styles.primaryTitle}
          >
            Upload &amp; publish
          </h2>

          <p className={styles.primaryDescription}>
            Add a production ZIP, review the photographs,
            complete the production details and publish the
            finished page to the archive.
          </p>
        </div>

        <Link
          href="/admin/new-production"
          className={styles.primaryLink}
        >
          <span>Start a new production</span>
          <span className={styles.arrow} aria-hidden="true">
            →
          </span>
        </Link>
      </section>

      <div className={styles.sectionHead}>
        <span className={styles.label}>
          Additional Backstage tools
        </span>
      </div>

      <section
        className={styles.tools}
        aria-label="Additional Backstage tools"
      >
        {secondaryActions.map((action, index) => (
          <Link
            href={action.href}
            className={styles.tool}
            key={action.href}
          >
            <span className={styles.num}>
              {String(index + 2).padStart(2, "0")}
            </span>

            <h2 className={styles.toolTitle}>
              {action.title}
            </h2>
            <p className={styles.toolDescription}>
              {action.description}
            </p>

            <span className={styles.toolLink}>
              <span>{action.label}</span>
              <span className={styles.arrow} aria-hidden="true">
                →
              </span>
            </span>
          </Link>
        ))}
      </section>

      <footer className={styles.footer}>
        <p>You only need to remember:</p>

        <code>/admin</code>
      </footer>
    </main>
  );
}
