"use client";

/* eslint-disable @next/next/no-img-element -- photos come from our own image host at fixed sizes */

import { useEffect, useState } from "react";

import PasteCreditsPanel, { creditKey } from "../../../../components/admin/editor/PasteCreditsPanel";
import { getDirectoryUrlFromData, type DirectoryData } from "../../../../lib/directory-data";
import type { PastedCredit } from "../../../../lib/parse-pasted-credits";
import { getProductionCardImageUrl, getProductionImageUrl } from "../../../../lib/production-image-url";

import { MONTHS, type Doc, type ProductionCredit } from "./editor-state";

import sw from "../../selected-work/backstage-selected-work.module.css";
import styles from "./production-edit.module.css";

type Change = (label: string, key: string | undefined, mutate: (doc: Doc) => Doc) => void;

export default function DetailsTab({
  doc,
  savedSlug,
  publishedHero,
  publishedAccess,
  heroChanged,
  hasUnsavedChanges,
  change,
  onChooseHero,
}: {
  doc: Doc;
  savedSlug: string;
  publishedHero: string;
  publishedAccess: "public" | "password";
  heroChanged: boolean;
  hasUnsavedChanges: boolean;
  change: Change;
  onChooseHero: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const monthMissing = doc.month === "";

  function field<K extends "title" | "venue" | "month" | "year" | "description">(key: K, label: string) {
    return (value: string) => change(label, `field:${key}`, (current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <div className={styles.detailsGrid}>
        <div className={styles.column}>
          <section className={styles.card} aria-labelledby="details-heading">
            <div className={styles.cardHead}>
              <h2 id="details-heading" className={styles.cardTitle}>
                Production details
              </h2>
              <span className={styles.cardMeta}>Shown on the production page</span>
            </div>

            <label className={styles.label}>
              Title
              <input
                className={`${sw.input} ${doc.title.trim() ? "" : styles.inputMissing}`}
                value={doc.title}
                onChange={(event) => field("title", "Title changed")(event.target.value)}
                data-testid="field-title"
              />
            </label>

            <div className={styles.row3}>
              <label className={styles.label}>
                Venue
                <input
                  className={`${sw.input} ${doc.venue.trim() ? "" : styles.inputMissing}`}
                  value={doc.venue}
                  onChange={(event) => field("venue", "Venue changed")(event.target.value)}
                  data-testid="field-venue"
                />
              </label>
              <label className={`${styles.label} ${monthMissing ? styles.labelMissing : ""}`}>
                {monthMissing ? "Month · missing" : "Month"}
                <select
                  className={`${sw.select} ${monthMissing ? styles.inputMissing : ""}`}
                  value={doc.month}
                  onChange={(event) => field("month", "Month changed")(event.target.value)}
                  data-testid="field-month"
                >
                  <option value="">Unknown</option>
                  {MONTHS.map((name, index) => (
                    <option key={name} value={String(index + 1)}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.label}>
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

            <label className={styles.label}>
              Description
              <textarea
                className={sw.textarea}
                rows={4}
                value={doc.description}
                onChange={(event) => field("description", "Description changed")(event.target.value)}
                data-testid="field-description"
              />
            </label>

            <label className={styles.label}>
              Web address
              <span className={styles.slugBox}>
                <span className={styles.slugPrefix}>stevegregson.com/productions/</span>
                <input
                  className={styles.slugInput}
                  value={doc.slug}
                  onChange={(event) => {
                    const value = event.target.value.trimStart().toLowerCase();
                    change("Web address changed", "field:slug", (current) => ({ ...current, slug: value }));
                  }}
                  spellCheck={false}
                  autoCapitalize="none"
                  autoCorrect="off"
                  data-testid="field-slug"
                />
              </span>
              <span className={styles.help}>
                Made automatically from the title. Only change it if the web address needs correcting.
                {doc.slug.trim() !== savedSlug ? " The old address will keep working and send visitors here." : ""}
              </span>
            </label>
          </section>

          <section className={styles.card} aria-labelledby="access-heading">
            <div className={styles.cardHead}>
              <h2 id="access-heading" className={styles.cardTitle}>
                Who can see it
              </h2>
              <span className={styles.cardMeta}>{doc.access === "password" ? "Password protected" : "Public"}</span>
            </div>
            <div className={styles.radios} role="radiogroup" aria-label="Access">
              <label className={styles.radio}>
                <input
                  type="radio"
                  name="production-access"
                  value="public"
                  checked={doc.access === "public"}
                  onChange={() =>
                    change("Access changed", undefined, (current) => ({ ...current, access: "public", accessPassword: "" }))
                  }
                />
                Public
              </label>
              <label className={styles.radio}>
                <input
                  type="radio"
                  name="production-access"
                  value="password"
                  checked={doc.access === "password"}
                  onChange={() => change("Access changed", undefined, (current) => ({ ...current, access: "password" }))}
                  data-testid="access-password"
                />
                Password protected
              </label>
            </div>
            <div className={doc.access === "password" ? styles.subCard : `${styles.subCard} ${styles.subCardOff}`}>
              <label className={styles.label}>
                Password
                <span className={styles.passwordRow}>
                  <input
                    id="production-access-password"
                    className={sw.input}
                    type={showPassword ? "text" : "password"}
                    value={doc.accessPassword}
                    disabled={doc.access !== "password"}
                    onChange={(event) => {
                      const value = event.target.value;
                      change("Password changed", "field:password", (current) => ({ ...current, accessPassword: value }));
                    }}
                    placeholder={
                      publishedAccess === "password" ? "Leave blank to keep existing password" : "Enter password"
                    }
                    autoComplete="new-password"
                    data-testid="field-password"
                  />
                  <button
                    type="button"
                    className={`${sw.btn} ${sw.btnSmall}`}
                    disabled={doc.access !== "password"}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? "Hide password" : "Show password"}
                  </button>
                </span>
              </label>
              <label className={sw.check}>
                <input
                  type="checkbox"
                  checked={doc.showHeroWhenLocked}
                  disabled={doc.access !== "password"}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    change("Hero-while-locked changed", undefined, (current) => ({ ...current, showHeroWhenLocked: checked }));
                  }}
                />
                Show hero image while locked
              </label>
              <p className={styles.help}>
                The production page stays visible; only the photographic gallery needs the password.
                {doc.access !== "password" ? " These options switch on when “Password protected” is chosen." : ""}
              </p>
            </div>
          </section>
        </div>

        <div className={styles.column}>
          <section className={styles.card} aria-labelledby="hero-heading">
            <div className={styles.cardHead}>
              <h2 id="hero-heading" className={styles.cardTitle}>
                Hero image
              </h2>
              <span className={heroChanged ? `${styles.cardMeta} ${styles.cardMetaGold}` : styles.cardMeta}>
                {heroChanged ? "Changed · not saved" : "Published"}
              </span>
            </div>
            <div className={styles.heroRow}>
              <img
                className={styles.heroThumb}
                src={getProductionCardImageUrl(savedSlug, doc.hero)}
                alt=""
                onError={(event) => {
                  const image = event.currentTarget;
                  if (image.dataset.fallback) return;
                  image.dataset.fallback = "1";
                  image.src = getProductionImageUrl(savedSlug, doc.hero);
                }}
              />
              <div>
                <p className={styles.heroName} title={doc.hero}>
                  {doc.hero}
                </p>
                <p className={styles.heroText}>
                  The large picture at the top of the production page.
                  {heroChanged ? ` Replaces ${publishedHero}, which moves into the gallery when you save.` : ""}
                </p>
                <button type="button" className={styles.goldLink} onClick={onChooseHero} data-testid="choose-hero">
                  Choose a different hero →
                </button>
              </div>
            </div>
          </section>

          <CreditsCard credits={doc.credits} change={change} />
        </div>
      </div>

      <DangerZone slug={savedSlug} title={doc.title || savedSlug} hasUnsavedChanges={hasUnsavedChanges} />
    </>
  );
}

type CreditsChange<D extends { credits: ProductionCredit[] }> = (
  label: string,
  key: string | undefined,
  mutate: (doc: D) => D,
) => void;

/** The Credits panel, shared with Productions › Upcoming. */
export function CreditsCard<D extends { credits: ProductionCredit[] }>({
  credits,
  change,
  afterAddHint = "Press Save & publish to put them on the site.",
  showWebsites = true,
}: {
  credits: ProductionCredit[];
  change: CreditsChange<D>;
  afterAddHint?: string;
  showWebsites?: boolean;
}) {
  const [directory, setDirectory] = useState<DirectoryData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadDirectory() {
      try {
        const response = await fetch("/api/admin/directory", { cache: "no-store" });
        if (!response.ok) return;
        const result = (await response.json()) as { ok?: boolean; directory?: DirectoryData };
        if (!cancelled && result.ok && result.directory) setDirectory(result.directory);
      } catch {
        // Directory autofill is optional.
      }
    }
    void loadDirectory();
    return () => {
      cancelled = true;
    };
  }, []);

  function update(index: number, key: "role" | "name" | "website", value: string) {
    change("Credits edited", `credit:${index}:${key}`, (current) => ({
      ...current,
      credits: current.credits.map((credit, creditIndex) => {
        if (creditIndex !== index) return credit;
        const updated = { ...credit, [key]: value };
        // Fill in a known website when the name matches the directory.
        if (key === "name" && !credit.website?.trim()) {
          const known = directory ? getDirectoryUrlFromData(directory, value) : undefined;
          if (known) updated.website = known;
        }
        return updated;
      }),
    }));
  }

  function addPasted(pasted: PastedCredit[]) {
    change("Credits pasted", undefined, (current) => {
      const existingKeys = new Set(current.credits.map(creditKey));
      const additions = pasted
        .filter((credit) => !existingKeys.has(creditKey(credit)))
        .map((credit): ProductionCredit => {
          const known = directory ? getDirectoryUrlFromData(directory, credit.name) : undefined;
          return known ? { ...credit, website: known } : { ...credit };
        });
      // Drop completely empty rows (e.g. a blank one from "Add credit").
      const kept = current.credits.filter(
        (credit) => credit.role.trim() || credit.name.trim() || credit.website?.trim(),
      );
      return { ...current, credits: [...kept, ...additions] };
    });
  }

  return (
    <section className={styles.card} aria-labelledby="credits-heading">
      <div className={styles.cardHead}>
        <h2 id="credits-heading" className={styles.cardTitle}>
          Credits
        </h2>
        <span className={styles.cardMeta}>
          {credits.length} {credits.length === 1 ? "person" : "people"}
        </span>
      </div>

      <div data-testid="credits-table">
        <div
          className={showWebsites ? styles.creditsHead : `${styles.creditsHead} ${styles.creditsNoWebsite}`}
          aria-hidden="true"
        >
          <span>Role</span>
          <span>Name</span>
          {showWebsites ? <span>Website</span> : null}
          <span />
        </div>
        {credits.length === 0 ? (
          <p className={styles.help} style={{ padding: "12px 0" }}>
            No credits yet. Add them one at a time, or paste a whole list.
          </p>
        ) : null}
        {credits.map((credit, index) => (
          <div
            className={showWebsites ? styles.creditRow : `${styles.creditRow} ${styles.creditsNoWebsite}`}
            key={index}
            data-testid="credit-row"
          >
            <input
              className={styles.creditInput}
              aria-label={`Role ${index + 1}`}
              placeholder="Role"
              value={credit.role}
              onChange={(event) => update(index, "role", event.target.value)}
            />
            <input
              className={styles.creditInput}
              aria-label={`Name ${index + 1}`}
              placeholder="Name"
              value={credit.name}
              onChange={(event) => update(index, "name", event.target.value)}
            />
            {showWebsites ? (
              <input
                className={styles.creditInput}
                aria-label={`Website ${index + 1}`}
                placeholder="Website (optional)"
                value={credit.website ?? ""}
                onChange={(event) => update(index, "website", event.target.value)}
              />
            ) : null}
            <button
              type="button"
              className={styles.removeX}
              aria-label={`Remove ${credit.role || "credit"} ${credit.name}`.trim()}
              onClick={() =>
                change("Credit removed", undefined, (current) => ({
                  ...current,
                  credits: current.credits.filter((_, creditIndex) => creditIndex !== index),
                }))
              }
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {showWebsites ? (
        <p className={styles.help}>Websites fill in automatically when a name is already in your directory.</p>
      ) : null}

      <div className={styles.creditTools}>
        <button
          type="button"
          className={sw.btn}
          onClick={() =>
            change("Credit added", undefined, (current) => ({
              ...current,
              credits: [...current.credits, { role: "", name: "" }],
            }))
          }
          data-testid="add-credit"
        >
          + Add credit
        </button>
      </div>

      <div className={styles.pasteWrap}>
        <PasteCreditsPanel
          existingCredits={credits}
          onAdd={addPasted}
          afterAddHint={afterAddHint}
        />
      </div>
    </section>
  );
}

function DangerZone({ slug, title, hasUnsavedChanges }: { slug: string; title: string; hasUnsavedChanges: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteProduction() {
    if (confirmation !== "DELETE" || deleting || !slug) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/delete-production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, confirmation }),
      });
      const data = (await response.json()) as { ok: boolean; message?: string; redirectTo?: string };
      if (!response.ok || !data.ok) throw new Error(data.message ?? "The production could not be deleted.");
      window.location.assign(data.redirectTo ?? "/archive");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The production could not be deleted.");
      setDeleting(false);
    }
  }

  return (
    <section className={styles.danger} aria-label="Danger zone">
      <span className={styles.dangerTitle}>Danger zone</span>
      <p className={styles.dangerText}>
        Permanently delete {title}, its production file and every photograph in its image folder. This cannot be
        undone, and happens straight away. You’ll be asked to type DELETE to confirm.
        {hasUnsavedChanges ? " Unsaved editor changes will also be lost." : ""}
      </p>
      {!open ? (
        <button
          type="button"
          className={sw.btnDanger}
          onClick={() => {
            setOpen(true);
            setError(null);
          }}
        >
          Delete production…
        </button>
      ) : (
        <div className={styles.dangerConfirm}>
          <label className={styles.label}>
            Type DELETE to confirm
            <input
              className={sw.input}
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value);
                setError(null);
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button
            type="button"
            className={sw.btn}
            disabled={deleting}
            onClick={() => {
              setOpen(false);
              setConfirmation("");
              setError(null);
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className={sw.btnDanger}
            disabled={deleting || confirmation !== "DELETE"}
            onClick={() => void deleteProduction()}
          >
            {deleting ? "Deleting…" : "Delete production permanently"}
          </button>
          {error ? (
            <p className={styles.aiError} role="alert" style={{ flexBasis: "100%" }}>
              {error}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
