"use client";

import Link from "next/link";
import { useState } from "react";

import type { UpcomingSummary } from "../../../lib/upcoming-productions";

import styles from "./upcoming.module.css";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatEdited(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return "";
  const now = new Date();
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === now.toDateString()) return `today, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `yesterday, ${time}`;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

function Chips({ draft }: { draft: UpcomingSummary }) {
  const { completeness } = draft;
  if (draft.status === "published") {
    return (
      <span className={styles.chips}>
        <span className={`${styles.chip} ${styles.chipPublished}`}>Published</span>
      </span>
    );
  }
  return (
    <span className={styles.chips} aria-label="What's filled in">
      <span className={completeness.details ? `${styles.chip} ${styles.chipDone}` : styles.chip}>
        Details {completeness.details ? "✓" : "—"}
      </span>
      <span className={completeness.credits ? `${styles.chip} ${styles.chipDone}` : styles.chip}>
        {completeness.credits
          ? `Credits ✓ ${completeness.credits}`
          : "Credits —"}
      </span>
      <span className={completeness.description ? `${styles.chip} ${styles.chipDone}` : styles.chip}>
        Description {completeness.description ? "✓" : "—"}
      </span>
      {completeness.notes ? <span className={`${styles.chip} ${styles.chipDone}`}>Notes ✓</span> : null}
      <span className={styles.chip}>Photos: not yet</span>
    </span>
  );
}

function Item({ draft }: { draft: UpcomingSummary }) {
  const when = [draft.month ? MONTHS_SHORT[Number(draft.month) - 1] : "", draft.year].filter(Boolean).join(" ");
  const meta = [draft.venue.trim(), draft.company.trim(), when].filter(Boolean).join(" · ");
  const edited = formatEdited(draft.updatedAt);
  return (
    <li className={styles.item}>
      <Link
        className={styles.itemLink}
        href={`/admin/productions/upcoming/${draft.id}`}
        data-testid="upcoming-item"
      >
        <span>
          <span className={draft.title.trim() ? styles.itemTitle : `${styles.itemTitle} ${styles.itemUntitled}`}>
            {draft.title.trim() || "Untitled production"}
          </span>
          <span className={styles.itemMeta}>{meta || "Venue not added yet"}</span>
        </span>
        <span className={styles.itemShoot}>
          <span className={styles.itemShootLabel}>Shoot</span>
          {draft.shootDates.trim() || "Date not added yet"}
        </span>
        <span className={styles.itemEdited}>
          {draft.status === "published" ? "Published" : "Edited"} {edited}
        </span>
        <Chips draft={draft} />
      </Link>
    </li>
  );
}

export default function UpcomingSection({
  drafts,
  loadError = false,
}: {
  drafts: UpcomingSummary[];
  loadError?: boolean;
}) {
  const [showPublished, setShowPublished] = useState(false);
  const open = drafts.filter((draft) => draft.status === "draft");
  const published = drafts.filter((draft) => draft.status === "published");

  return (
    <section className={styles.section} aria-labelledby="upcoming-heading" data-testid="upcoming-section">
      <div className={styles.sectionHead}>
        <div className={styles.sectionTitleWrap}>
          <p className={styles.sectionEyebrow}>Not on the website yet</p>
          <h2 id="upcoming-heading" className={styles.sectionTitle}>
            Upcoming
          </h2>
          <span className={styles.count} data-testid="upcoming-count">
            {open.length}
          </span>
        </div>
        <Link className={styles.newButton} href="/admin/productions/upcoming/new" data-testid="new-upcoming">
          <span aria-hidden="true">+</span> New upcoming production
        </Link>
        <p className={styles.sectionNote}>
          Start a production before the shoot — paste in the credits and anything you’ve been sent. It stays hidden
          from the archive until you add the photos and publish.
        </p>
      </div>

      {loadError ? (
        <p className={styles.empty} role="alert">
          Upcoming productions couldn’t be loaded just now. Refresh the page to try again.
        </p>
      ) : open.length === 0 ? (
        <p className={styles.empty}>No upcoming productions. Use “New upcoming production” when documentation arrives.</p>
      ) : (
        <ul className={styles.list}>
          {open.map((draft) => (
            <Item key={draft.id} draft={draft} />
          ))}
        </ul>
      )}

      {published.length ? (
        <>
          <button
            type="button"
            className={styles.publishedToggle}
            aria-expanded={showPublished}
            onClick={() => setShowPublished((current) => !current)}
          >
            {showPublished ? "Hide" : "Show"} {published.length} already published
          </button>
          {showPublished ? (
            <ul className={styles.list}>
              {published.map((draft) => (
                <Item key={draft.id} draft={draft} />
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
