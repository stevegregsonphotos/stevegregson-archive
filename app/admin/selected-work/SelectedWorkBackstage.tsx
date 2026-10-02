"use client";

/*
 * Backstage -> Selected Work: one screen with four sections (Production
 * page, Rehearsals, Marketing & PR, Commissions boxes) and one Save &
 * publish bar. Replaces the old two-tab screen and the 3,800-line
 * SelectedWorkEditor; the library pipeline now lives in ./library.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import type {
  CommissionsImages,
  CommissionsPicture,
  CommissionsSlot,
  ShowcaseItem,
} from "../../../lib/selected-work-page";

import CommissionsTab from "./CommissionsTab";
import {
  draftReducer,
  INITIAL_DRAFT,
  libraryStatus,
  pageUsesLibraryImage,
  renameInDoc,
  type Doc,
} from "./library/draft";
import LibraryEditModal from "./library/LibraryEditModal";
import {
  CATEGORY_IDS,
  parseLibraryUrl,
  persistCategory,
  type CategoryId,
} from "./library/pipeline";
import { useSelectedWorkLibrary } from "./library/useSelectedWorkLibrary";
import LibraryTab from "./LibraryTab";
import { PAGE_API, type ProductionOption } from "./PhotoSources";
import ProductionPageTab from "./ProductionPageTab";

import styles from "./backstage-selected-work.module.css";

type TabId = "production" | "rehearsals" | "marketing" | "commissions";

const TABS: Array<{ id: TabId; number: string; name: string; live: string; liveLabel: string }> = [
  { id: "production", number: "01", name: "Production page", live: "/selected-work", liveLabel: "View live site ↗" },
  { id: "rehearsals", number: "02", name: "Rehearsals", live: "/rehearsals", liveLabel: "View Rehearsals page ↗" },
  { id: "marketing", number: "03", name: "Marketing & PR", live: "/marketing-pr", liveLabel: "View Marketing & PR page ↗" },
  { id: "commissions", number: "04", name: "Commissions boxes", live: "/commissions", liveLabel: "View Commissions page ↗" },
];

const SHORT_NAMES: Record<CategoryId, string> = {
  production: "Photo library",
  rehearsal: "Rehearsals",
  campaign: "Marketing & PR",
};

type PageData = {
  page: { items: ShowcaseItem[] };
  commissions: {
    automatic: Partial<Record<CommissionsSlot, CommissionsPicture>>;
    chosen: CommissionsImages;
  };
  productions: ProductionOption[];
};

function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The API needs a caption title for any caption; an empty caption means none. */
function itemsForSaving(items: ShowcaseItem[]): ShowcaseItem[] {
  return items.map((item) => {
    const title = item.credit?.title.trim() ?? "";
    return {
      ...item,
      credit: item.credit && title ? { title, venue: item.credit.venue.trim(), slug: item.credit.slug } : null,
    };
  });
}

export default function SelectedWorkBackstage() {
  const [state, dispatch] = useReducer(draftReducer, INITIAL_DRAFT);
  const { doc } = state;
  const docRef = useRef<Doc>(doc);
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("production");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  const describeUse = useCallback((category: CategoryId, filename: string) => {
    const current = docRef.current;
    const onPage = pageUsesLibraryImage(current.items, category, filename);
    const inBox = Object.values(current.chosen).some((picture) => {
      const parsed = picture ? parseLibraryUrl(picture.src) : null;
      return parsed?.category === category && parsed.filename === filename;
    });
    if (onPage && inBox) return "It is on the Production page and in a Commissions box; it will be taken off both.";
    if (onPage) return "It is on the Production page; it will be taken off the page too.";
    if (inBox) return "It is used in a Commissions box; that box will go back to automatic.";
    return null;
  }, []);

  const library = useSelectedWorkLibrary({ dispatch, describeUse });

  /* ---------- Load the page list, Commissions pictures and productions ---------- */

  const loadPage = useCallback(async () => {
    try {
      const response = await fetch(PAGE_API, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Could not load.");
      const data = json as PageData;
      setPageData(data);
      dispatch({ type: "load", items: data.page.items, chosen: data.commissions.chosen || {} });
      setPageError(null);
    } catch (caught) {
      setPageError(caught instanceof Error ? caught.message : "Could not load.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPage();
      const fromHash = window.location.hash.replace("#", "") as TabId;
      if (TABS.some((candidate) => candidate.id === fromHash)) setTab(fromHash);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPage]);

  function chooseTab(next: TabId) {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
  }

  /* ---------- What needs saving ---------- */

  const status = useMemo(
    () =>
      Object.fromEntries(
        CATEGORY_IDS.map((category) => [category, libraryStatus(library.server[category], doc.library[category])]),
      ) as Record<CategoryId, ReturnType<typeof libraryStatus>>,
    [library.server, doc.library],
  );

  const pageDirty = !same(doc.items, state.savedItems);
  const commissionsDirty = !same(doc.chosen, state.savedChosen);
  const libraryDirty = CATEGORY_IDS.filter((category) => status[category].dirty);
  const renameNotes = CATEGORY_IDS.filter((category) => status[category].pendingRenames > 0).map(
    (category) =>
      `${SHORT_NAMES[category]}: ${status[category].pendingRenames} new ${status[category].pendingRenames === 1 ? "filename" : "filenames"} to apply`,
  );
  const dirtyAreas = (pageDirty ? 1 : 0) + (commissionsDirty ? 1 : 0) + libraryDirty.length;
  const anyDirty = dirtyAreas > 0;
  const changeCount = anyDirty ? Math.max(state.history.length + state.notes.length + renameNotes.length, dirtyAreas) : 0;
  const summary = [
    ...Array.from(new Set(state.history.map((entry) => entry.label))).slice(-3),
    ...Array.from(new Set(state.notes)),
    ...renameNotes,
  ].join(" · ");

  /* ---------- Warn before leaving ---------- */

  useEffect(() => {
    if (!anyDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    // Links inside Backstage navigate without reloading, so ask for those too.
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || event.defaultPrevented || event.metaKey || event.ctrlKey) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (!window.confirm("You have unsaved changes on Selected Work. Leave without saving them?")) {
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
  }, [anyDirty]);

  /* ---------- Changes ---------- */

  const change = useCallback((label: string, key: string | undefined, mutate: (current: Doc) => Doc) => {
    setSavedMessage(null);
    dispatch({ type: "change", label, key, mutate });
  }, []);

  function setLibraryField(category: CategoryId, filename: string, field: "alt" | "suggestedFilename", value: string) {
    const label = field === "alt" ? `${SHORT_NAMES[category]}: changed a description` : `${SHORT_NAMES[category]}: changed a filename`;
    change(label, `${field}:${category}:${filename}`, (current) => {
      const draft = current.library[category];
      return {
        ...current,
        library: {
          ...current.library,
          [category]: { ...draft, fields: { ...draft.fields, [filename]: { ...draft.fields[filename], [field]: value } } },
        },
      };
    });
  }

  function reorderLibrary(category: CategoryId, from: number, to: number) {
    const view = status[category].view;
    if (from === to || to < 0 || to >= view.length) return;
    const order = view.map((image) => image.filename);
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    change(`${SHORT_NAMES[category]}: changed the order`, undefined, (current) => ({
      ...current,
      library: { ...current.library, [category]: { ...current.library[category], order } },
    }));
  }

  /* ---------- Save & publish ---------- */

  async function saveAll() {
    if (saving || library.busy || !anyDirty) return;
    setSaving(true);
    setSaveError(null);
    setSavedMessage(null);
    let working = docRef.current;
    const savedCategories: CategoryId[] = [];
    let savedItems: ShowcaseItem[] | undefined;
    let savedChosen: CommissionsImages | undefined;

    try {
      // 1. Library collections: order, descriptions and filenames (renames happen here).
      for (const category of libraryDirty) {
        const images = status[category].view.map((image) => ({ ...image }));
        const before = images.map((image) => image.filename);
        const saved = await persistCategory(category, images, true);
        const after = saved[category].map((image) => image.filename);
        library.setServer(saved);
        savedCategories.push(category);
        before.forEach((from, index) => {
          const to = after[index];
          if (to && to !== from) {
            working = renameInDoc(working, category, from, to);
            dispatch({ type: "rebase", mutate: (current) => renameInDoc(current, category, from, to) });
          }
        });
      }

      // 2. The Production page list (also picks up any renamed library photos).
      if (!same(working.items, state.savedItems)) {
        const response = await fetch(PAGE_API, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page: { items: itemsForSaving(working.items) } }),
        });
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json.error || "The Production page could not be saved.");
        savedItems = json.page.items;
      }

      // 3. The Commissions boxes.
      if (!same(working.chosen, state.savedChosen)) {
        const response = await fetch(PAGE_API, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commissions: working.chosen }),
        });
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json.error || "The Commissions boxes could not be saved.");
        savedChosen = json.commissions;
      }

      dispatch({ type: "saved", items: savedItems, chosen: savedChosen, clearLibrary: savedCategories, all: true });
      setSavedMessage("Saved and published. The live pages have been updated.");
    } catch (caught) {
      // Keep whatever did save, so nothing is sent twice.
      dispatch({ type: "saved", items: savedItems, chosen: savedChosen, clearLibrary: savedCategories, all: false });
      setSaveError(`${caught instanceof Error ? caught.message : "Could not save."} Anything not saved is still waiting below.`);
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Render ---------- */

  const activeTab = TABS.find((candidate) => candidate.id === tab)!;
  const counts: Record<TabId, number> = {
    production: doc.items.length,
    rehearsals: status.rehearsal.view.length,
    marketing: status.campaign.view.length,
    commissions: 7,
  };
  const loading = !pageData || library.loading;
  const loadError = pageError || library.loadError;

  return (
    <div className={styles.screen} aria-busy={saving}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>CURATED PORTFOLIO</p>
          <h1 className={styles.title}>Selected Work</h1>
        </div>
        <a className={styles.liveLink} href={activeTab.live} target="_blank" rel="noreferrer">
          {activeTab.liveLabel}
        </a>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Selected Work sections">
        {TABS.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            role="tab"
            id={`tab-${candidate.id}`}
            aria-selected={tab === candidate.id}
            aria-controls="selected-work-section"
            className={tab === candidate.id ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => chooseTab(candidate.id)}
          >
            <span className={styles.tabNum}>{candidate.number}</span>
            <span className={styles.tabName}>{candidate.name}</span>
            <span className={styles.tabCount}>{loading ? "" : counts[candidate.id]}</span>
          </button>
        ))}
      </div>

      <section id="selected-work-section" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {loadError ? (
          <p className={styles.errorText} role="alert">
            {loadError}{" "}
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => {
                void loadPage();
                void library.reload();
              }}
            >
              Try again
            </button>
          </p>
        ) : loading ? (
          <p className={styles.intro}>Loading Selected Work…</p>
        ) : tab === "production" ? (
          <ProductionPageTab
            items={doc.items}
            productions={pageData.productions}
            library={library}
            libraryImages={status.production.view}
            change={change}
            onLibraryField={(filename, field, value) => setLibraryField("production", filename, field, value)}
            onLibraryReorder={(from, to) => reorderLibrary("production", from, to)}
          />
        ) : tab === "rehearsals" || tab === "marketing" ? (
          <LibraryTab
            key={tab}
            category={tab === "rehearsals" ? "rehearsal" : "campaign"}
            images={status[tab === "rehearsals" ? "rehearsal" : "campaign"].view}
            library={library}
            uploadTitle={`Drop photographs here to add them to ${tab === "rehearsals" ? "Rehearsals" : "Marketing & PR"}`}
            onField={(filename, field, value) => setLibraryField(tab === "rehearsals" ? "rehearsal" : "campaign", filename, field, value)}
            onReorder={(from, to) => reorderLibrary(tab === "rehearsals" ? "rehearsal" : "campaign", from, to)}
          />
        ) : (
          <CommissionsTab
            chosen={doc.chosen}
            automatic={pageData.commissions.automatic}
            productions={pageData.productions}
            pageItems={doc.items}
            change={change}
          />
        )}
      </section>

      <div className={anyDirty ? `${styles.saveBar} ${styles.saveBarDirty}` : styles.saveBar} data-testid="save-bar">
        <span className={anyDirty ? `${styles.dot} ${styles.dotDirty}` : styles.dot} aria-hidden="true" />
        <span className={styles.saveCount} role="status">
          {saving
            ? "Saving…"
            : anyDirty
              ? `${changeCount} unsaved ${changeCount === 1 ? "change" : "changes"}`
              : "All changes saved"}
        </span>
        {saveError ? (
          <span className={styles.saveError} role="alert">
            {saveError}
          </span>
        ) : (
          <span className={styles.saveSummary} title={summary}>
            {anyDirty
              ? summary
              : savedMessage ?? "Uploads, removals, AI descriptions and photo edits are saved straight away."}
          </span>
        )}
        <span className={styles.spacer} />
        {anyDirty ? (
          <button
            type="button"
            className={styles.btn}
            disabled={saving || state.history.length === 0}
            onClick={() => {
              setSaveError(null);
              dispatch({ type: "undo" });
            }}
          >
            Undo
          </button>
        ) : null}
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={!anyDirty || saving || Boolean(library.busy)}
          onClick={() => void saveAll()}
        >
          {saving ? "Saving…" : "Save & publish"}
        </button>
      </div>

      {library.editing ? (
        <LibraryEditModal
          category={library.editing.category}
          image={library.editing.image}
          onCancel={library.closeEditor}
          onApply={library.applyEdit}
        />
      ) : null}
    </div>
  );
}
