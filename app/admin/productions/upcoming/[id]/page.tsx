"use client";

/*
 * Backstage -> Productions -> Upcoming -> a draft. Credits, details and notes
 * for a production that hasn't been photographed (or published) yet. Saved
 * privately through /api/admin/upcoming-productions; never shown on the site.
 * "Add photos & publish" opens Upload & publish with these details filled in.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { CreditsCard } from "../../../edit-production/[slug]/DetailsTab";
import { MONTHS } from "../../../edit-production/[slug]/editor-state";
import {
  EMPTY_UPCOMING_INPUT,
  UPCOMING_LIMITS,
  missingForPublish,
  type UpcomingDraft,
  type UpcomingDraftInput,
} from "../../../../../lib/upcoming-productions";
import { formatEdited } from "../../UpcomingSection";

import pe from "../../../edit-production/[slug]/production-edit.module.css";
import sw from "../../../selected-work/backstage-selected-work.module.css";
import styles from "../../upcoming.module.css";

type Doc = UpcomingDraftInput;
type HistoryEntry = { label: string; key: string; doc: Doc };
type State = { doc: Doc | null; saved: Doc | null; history: HistoryEntry[] };
type Action =
  | { type: "load"; doc: Doc }
  | { type: "change"; label: string; key?: string; mutate: (doc: Doc) => Doc }
  | { type: "undo" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "load":
      return { doc: action.doc, saved: action.doc, history: [] };
    case "change": {
      if (!state.doc) return state;
      const next = action.mutate(state.doc);
      if (next === state.doc) return state;
      const last = state.history[state.history.length - 1];
      const merge = Boolean(action.key && last && last.key === action.key);
      return {
        ...state,
        doc: next,
        history: merge
          ? state.history
          : [
              ...state.history,
              { label: action.label, key: action.key ?? `auto-${state.history.length}`, doc: state.doc },
            ],
      };
    }
    case "undo": {
      const last = state.history[state.history.length - 1];
      if (!last) return state;
      return { ...state, doc: last.doc, history: state.history.slice(0, -1) };
    }
  }
}

function docFromDraft(draft: UpcomingDraft): Doc {
  return {
    title: draft.title,
    venue: draft.venue,
    month: draft.month,
    year: draft.year,
    description: draft.description,
    company: draft.company,
    shootDates: draft.shootDates,
    notes: draft.notes,
    credits: draft.credits,
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

type DraftResult = { ok: boolean; message?: string; draft?: UpcomingDraft };

export default function UpcomingDraftPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const routeId = typeof params.id === "string" ? params.id : "";
  const isNew = routeId === "new";

  const [state, dispatch] = useReducer(reducer, { doc: null, saved: null, history: [] });
  const [draft, setDraft] = useState<UpcomingDraft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  // Set just before we navigate away on purpose, so no "unsaved changes" prompt appears.
  const leavingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (isNew) {
      dispatch({ type: "load", doc: EMPTY_UPCOMING_INPUT });
      return;
    }
    async function load() {
      try {
        const response = await fetch(`/api/admin/upcoming-productions?id=${encodeURIComponent(routeId)}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as DraftResult;
        if (!response.ok || !result.ok || !result.draft) {
          throw new Error(result.message ?? "That upcoming production could not be loaded.");
        }
        if (cancelled) return;
        setDraft(result.draft);
        dispatch({ type: "load", doc: docFromDraft(result.draft) });
      } catch (caught) {
        if (!cancelled) {
          setLoadError(caught instanceof Error ? caught.message : "That upcoming production could not be loaded.");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isNew, routeId]);

  const { doc, saved } = state;
  const dirty = Boolean(doc && saved && !same(doc, saved));
  // A brand-new draft counts as unsaved once anything has been typed.
  const changeCount = dirty ? Math.max(1, state.history.length) : 0;
  const summary = Array.from(new Set(state.history.map((entry) => entry.label)))
    .slice(-4)
    .join(" · ");

  /* ---------- Warn before leaving ---------- */

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (leavingRef.current) return;
      if (!link || link.target === "_blank" || event.defaultPrevented || event.metaKey || event.ctrlKey) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (!window.confirm("You have unsaved changes to this upcoming production. Leave without saving them?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const change = useCallback((label: string, key: string | undefined, mutate: (current: Doc) => Doc) => {
    setSaveError(null);
    setSavedMessage(null);
    dispatch({ type: "change", label, key, mutate });
  }, []);

  function field<K extends "title" | "venue" | "month" | "year" | "description" | "company" | "shootDates" | "notes">(
    key: K,
    label: string,
  ) {
    return (value: string) => change(label, `field:${key}`, (current) => ({ ...current, [key]: value }));
  }

  /** Saves; returns the saved draft (or null on failure). */
  async function save(): Promise<UpcomingDraft | null> {
    if (!doc || saving) return null;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/admin/upcoming-productions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isNew || !draft ? { action: "create", draft: doc } : { action: "update", id: draft.id, draft: doc },
        ),
      });
      const result = (await response.json()) as DraftResult;
      if (!response.ok || !result.ok || !result.draft) {
        throw new Error(result.message ?? "This upcoming production could not be saved.");
      }
      setDraft(result.draft);
      dispatch({ type: "load", doc: docFromDraft(result.draft) });
      setSavedMessage("Saved privately. Nothing has been added to the website.");
      if (isNew) {
        router.replace(`/admin/productions/upcoming/${result.draft.id}`);
      }
      return result.draft;
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "This upcoming production could not be saved.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function addPhotosAndPublish(route: "upload" | "curated" = "upload") {
    let target = draft;
    if (dirty || !target) {
      target = await save();
      if (!target) return;
    }
    leavingRef.current = true;
    const page = route === "curated" ? "/admin/curated-archive-import" : "/admin/new-production";
    window.location.assign(`${page}?upcoming=${encodeURIComponent(target.id)}`);
  }

  /* ---------- Render ---------- */

  if (!doc || !saved) {
    return (
      <main className="backstage-page" style={{ paddingTop: "4rem" }}>
        <div className="backstage-shell">
          <div className={sw.screen}>
            {loadError ? (
              <>
                <p className={sw.errorText} role="alert">
                  {loadError}
                </p>
                <p>
                  <a className={pe.backLink} href="/admin/productions">
                    ← All productions
                  </a>
                </p>
              </>
            ) : (
              <p className={sw.intro}>Loading upcoming production…</p>
            )}
          </div>
        </div>
      </main>
    );
  }

  const missing = missingForPublish(doc);
  const published = draft?.status === "published";
  const headTitle = (saved.title || doc.title).trim() || (isNew ? "New upcoming production" : "Untitled production");
  const subline = [saved.venue.trim(), saved.shootDates.trim() ? `Shoot: ${saved.shootDates.trim()}` : ""]
    .filter(Boolean)
    .join(" · ");
  const checks: Array<[string, boolean]> = [
    ["Title, venue, month and year", Boolean(doc.title.trim() && doc.venue.trim() && doc.month && doc.year)],
    ["Description", Boolean(doc.description.trim())],
    [
      `Credits${doc.credits.length ? ` (${doc.credits.filter((c) => c.role.trim() && c.name.trim()).length})` : ""}`,
      doc.credits.some((credit) => credit.role.trim() && credit.name.trim()),
    ],
    ["Photographs — chosen in Upload & publish", false],
  ];

  return (
    <main className="backstage-page" style={{ paddingTop: "4rem" }}>
      <div className="backstage-shell">
        <div className={sw.screen} aria-busy={saving}>
          <header className={sw.head}>
            <div>
              <p className={sw.eyebrow}>PRODUCTIONS › UPCOMING</p>
              <h1 className={sw.title} data-testid="upcoming-title">
                {headTitle}
              </h1>
              {subline ? <p className={pe.subline}>{subline}</p> : null}
            </div>
            <div className={pe.headRight}>
              <a className={pe.backLink} href="/admin/productions">
                ← All productions
              </a>
              {draft && !published ? (
                <span className={pe.cardMeta}>Last edited {formatEdited(draft.updatedAt)}</span>
              ) : null}
            </div>
          </header>

          <p className={styles.hiddenNote} role="note" data-testid="hidden-note">
            <svg className={styles.hiddenIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7-0.4 1-1.3 2.4-2.6 3.7M6.2 6.2C4.2 7.6 2.7 9.6 2 12c1 2.5 5 7 10 7 1.6 0 3.1-0.4 4.4-1.1" />
            </svg>
            <span>
              {published ? (
                <>
                  <strong>Published.</strong> This production is now in the archive
                  {draft?.publishedUrl ? (
                    <>
                      {" "}
                      —{" "}
                      <a className={pe.goldLink} href={draft.publishedUrl} target="_blank" rel="noreferrer">
                        view it ↗
                      </a>
                    </>
                  ) : null}
                  . Make further changes in Productions › Edit; this draft is kept only for your notes.
                </>
              ) : (
                <>
                  <strong>Upcoming — hidden from the website.</strong> Nothing here appears in the archive until you
                  add the photos and publish.
                </>
              )}
            </span>
          </p>

          <div className={pe.detailsGrid} style={{ marginTop: 24 }}>
            <div className={pe.column}>
              <section className={pe.card} aria-labelledby="details-heading">
                <div className={pe.cardHead}>
                  <h2 id="details-heading" className={pe.cardTitle}>
                    Production details
                  </h2>
                  <span className={pe.cardMeta}>Fill in what you know — the rest can wait</span>
                </div>

                <label className={pe.label}>
                  Title
                  <input
                    className={sw.input}
                    value={doc.title}
                    maxLength={UPCOMING_LIMITS.title}
                    onChange={(event) => field("title", "Title changed")(event.target.value)}
                    data-testid="field-title"
                  />
                </label>

                <div className={pe.row3}>
                  <label className={pe.label}>
                    Venue
                    <input
                      className={sw.input}
                      value={doc.venue}
                      maxLength={UPCOMING_LIMITS.venue}
                      onChange={(event) => field("venue", "Venue changed")(event.target.value)}
                      data-testid="field-venue"
                    />
                  </label>
                  <label className={pe.label}>
                    Month
                    <select
                      className={sw.select}
                      value={doc.month}
                      onChange={(event) => field("month", "Month changed")(event.target.value)}
                      data-testid="field-month"
                    >
                      <option value="">Not sure yet</option>
                      {MONTHS.map((name, index) => (
                        <option key={name} value={String(index + 1)}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={pe.label}>
                    Year
                    <input
                      className={sw.input}
                      type="number"
                      inputMode="numeric"
                      min="1900"
                      max="2100"
                      value={doc.year}
                      onChange={(event) => field("year", "Year changed")(event.target.value)}
                      data-testid="field-year"
                    />
                  </label>
                </div>

                <label className={pe.label}>
                  Description
                  <textarea
                    className={sw.textarea}
                    rows={4}
                    value={doc.description}
                    maxLength={UPCOMING_LIMITS.description}
                    onChange={(event) => field("description", "Description changed")(event.target.value)}
                    data-testid="field-description"
                  />
                  <span className={pe.help}>Shown on the production page once it’s published.</span>
                </label>
              </section>

              <section className={pe.card} aria-labelledby="shoot-heading">
                <div className={pe.cardHead}>
                  <h2 id="shoot-heading" className={pe.cardTitle}>
                    Shoot &amp; client
                  </h2>
                  <span className={pe.cardMeta}>For you only</span>
                </div>
                <label className={pe.label}>
                    Shoot date(s)
                    <input
                      className={sw.input}
                      value={doc.shootDates}
                      maxLength={UPCOMING_LIMITS.shootDates}
                      placeholder="e.g. Dress rehearsal Tue 14 Oct, 7pm"
                      onChange={(event) => field("shootDates", "Shoot date changed")(event.target.value)}
                      data-testid="field-shoot-dates"
                    />
                  </label>
                  <label className={pe.label}>
                    Company / client
                    <input
                      className={sw.input}
                      value={doc.company}
                      maxLength={UPCOMING_LIMITS.company}
                      onChange={(event) => field("company", "Company changed")(event.target.value)}
                      data-testid="field-company"
                    />
                  </label>
                <p className={pe.help}>These aren’t published — they’re here to help you keep track.</p>
              </section>

              <section className={pe.card} aria-labelledby="notes-heading">
                <div className={pe.cardHead}>
                  <h2 id="notes-heading" className={pe.cardTitle}>
                    Notes from documentation
                  </h2>
                  <span className={pe.cardMeta}>For you only</span>
                </div>
                <label className={pe.label}>
                  <span>
                    Notes{" "}
                    <span className={styles.charCount}>
                      · {doc.notes.length.toLocaleString()} / {UPCOMING_LIMITS.notes.toLocaleString()} characters
                    </span>
                  </span>
                  <textarea
                    className={`${sw.textarea} ${styles.notesArea}`}
                    rows={12}
                    value={doc.notes}
                    maxLength={UPCOMING_LIMITS.notes}
                    onChange={(event) => field("notes", "Notes changed")(event.target.value)}
                    data-testid="field-notes"
                  />
                </label>
                <p className={pe.help}>
                  Paste anything you’ve been sent — schedules, running times, contacts, cast lists. Tip: copy the credits out of these notes into “Paste a list of credits” to fill the Credits table.
                </p>
              </section>
            </div>

            <div className={pe.column}>
              <CreditsCard<Doc>
                credits={doc.credits}
                change={change}
                showWebsites={false}
                afterAddHint="Press Save to keep them."
              />

              {!published ? (
                <section className={pe.card} aria-labelledby="publish-heading">
                  <div className={pe.cardHead}>
                    <h2 id="publish-heading" className={pe.cardTitle}>
                      When the photos are ready
                    </h2>
                    <span className={pe.cardMeta}>Upload &amp; publish</span>
                  </div>
                  <ul className={styles.checklist} data-testid="publish-checklist">
                    {checks.map(([label, done]) => (
                      <li key={label} className={done ? `${styles.checkItem} ${styles.checkItemDone}` : styles.checkItem}>
                        <span className={styles.checkMark} aria-hidden="true">
                          {done ? "✓" : "○"}
                        </span>
                        {label}
                      </li>
                    ))}
                  </ul>
                  <p className={pe.help}>
                    Opens Upload &amp; publish with these details and credits already filled in — you just choose the
                    photo folder. If Claude has curated the photos, use Curated import instead: choose the main
                    curated folder and it keeps Claude&rsquo;s picks, hero and order while using these details.
                    {missing.length
                      ? ` Publishing will also need the ${missing.join(", ")}; you can add ${missing.length === 1 ? "it" : "them"} here or there.`
                      : ""}
                    {dirty ? " Your changes will be saved first." : ""}
                  </p>
                  <div className={styles.publishRow}>
                    <button
                      type="button"
                      className={sw.btnPrimary}
                      disabled={saving}
                      onClick={() => void addPhotosAndPublish()}
                      data-testid="add-photos-publish"
                    >
                      Add photos &amp; publish →
                    </button>
                    <button
                      type="button"
                      className={sw.btn}
                      disabled={saving}
                      onClick={() => void addPhotosAndPublish("curated")}
                      data-testid="add-curated-photos"
                    >
                      Use a curated folder →
                    </button>
                  </div>
                </section>
              ) : null}
            </div>
          </div>

          {draft ? <DeleteDraft id={draft.id} title={doc.title.trim() || "this draft"} onDeleted={() => {
                leavingRef.current = true;
              }} /> : null}

          <div className={dirty ? `${sw.saveBar} ${sw.saveBarDirty}` : sw.saveBar} data-testid="save-bar">
            <span className={dirty ? `${sw.dot} ${sw.dotDirty}` : sw.dot} aria-hidden="true" />
            <span className={sw.saveCount} role="status">
              {saving
                ? "Saving…"
                : dirty
                  ? `${changeCount} unsaved ${changeCount === 1 ? "change" : "changes"}`
                  : isNew
                    ? "Not saved yet"
                    : "All changes saved"}
            </span>
            {saveError ? (
              <span className={sw.saveError} role="alert">
                {saveError}
              </span>
            ) : (
              <span className={sw.saveSummary} title={dirty ? summary : undefined}>
                {dirty
                  ? summary
                  : savedMessage ?? "Saved privately in Backstage — nothing here is on the website."}
              </span>
            )}
            <span className={sw.spacer} />
            {dirty ? (
              <button
                type="button"
                className={sw.btn}
                disabled={saving || state.history.length === 0}
                onClick={() => {
                  setSaveError(null);
                  dispatch({ type: "undo" });
                }}
                data-testid="undo"
              >
                Undo
              </button>
            ) : null}
            <button
              type="button"
              className={sw.btnPrimary}
              disabled={!dirty || saving}
              onClick={() => void save()}
              data-testid="save"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function DeleteDraft({ id, title, onDeleted }: { id: string; title: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/upcoming-productions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id, confirmation: "DELETE" }),
      });
      const result = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !result.ok) throw new Error(result.message ?? "The draft could not be deleted.");
      onDeleted();
      window.location.assign("/admin/productions");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The draft could not be deleted.");
      setDeleting(false);
    }
  }

  return (
    <section className={pe.danger} aria-label="Delete draft">
      <span className={pe.dangerTitle}>Delete draft</span>
      <p className={pe.dangerText}>
        Removes this upcoming draft and its notes from Backstage. Nothing on the website is affected.
      </p>
      {!open ? (
        <button type="button" className={sw.btnDanger} onClick={() => setOpen(true)} data-testid="delete-draft">
          Delete draft…
        </button>
      ) : (
        <div className={pe.dangerConfirm}>
          <p className={pe.dangerText} style={{ margin: 0 }}>
            Delete {title}? This can’t be undone.
          </p>
          <button type="button" className={sw.btn} disabled={deleting} onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={sw.btnDanger}
            disabled={deleting}
            onClick={() => void remove()}
            data-testid="confirm-delete-draft"
          >
            {deleting ? "Deleting…" : "Yes, delete draft"}
          </button>
          {error ? (
            <p className={pe.aiError} role="alert" style={{ flexBasis: "100%" }}>
              {error}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
