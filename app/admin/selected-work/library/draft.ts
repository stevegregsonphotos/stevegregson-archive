/*
 * Everything on the Selected Work screen that waits for "Save & publish":
 * the Production page list, the Commissions box pictures and unsaved
 * library edits (order, descriptions, filenames). Kept in one reducer so a
 * single Undo button steps back through all of them.
 */

import type {
  CommissionsImages,
  ShowcaseItem,
} from "../../../../lib/selected-work-page";

import {
  CATEGORY_IDS,
  parseLibraryUrl,
  renameLibraryUrl,
  type CategoryId,
  type SelectedWorkImage,
} from "./pipeline";

export type FieldDraft = { alt?: string; suggestedFilename?: string };
export type CategoryDraft = { order: string[] | null; fields: Record<string, FieldDraft> };
export type LibraryDraft = Record<CategoryId, CategoryDraft>;

export type Doc = {
  items: ShowcaseItem[];
  chosen: CommissionsImages;
  library: LibraryDraft;
};

type HistoryEntry = { label: string; key: string; doc: Doc };

export type DraftState = {
  doc: Doc;
  savedItems: ShowcaseItem[];
  savedChosen: CommissionsImages;
  history: HistoryEntry[];
  /** Changes made for you (e.g. a photo removed from the page because it was deleted). */
  notes: string[];
};

export function emptyLibraryDraft(): LibraryDraft {
  return {
    production: { order: null, fields: {} },
    rehearsal: { order: null, fields: {} },
    campaign: { order: null, fields: {} },
  };
}

export const INITIAL_DRAFT: DraftState = {
  doc: { items: [], chosen: {}, library: emptyLibraryDraft() },
  savedItems: [],
  savedChosen: {},
  history: [],
  notes: [],
};

export type DraftAction =
  | { type: "load"; items: ShowcaseItem[]; chosen: CommissionsImages }
  /** A change you made: recorded for Undo. Same key as the last change merges (typing). */
  | { type: "change"; label: string; key?: string; mutate: (doc: Doc) => Doc }
  /** A change made for you: applied to the draft and every Undo step. */
  | { type: "rebase"; mutate: (doc: Doc) => Doc; note?: string }
  | { type: "undo" }
  | { type: "saved"; items?: ShowcaseItem[]; chosen?: CommissionsImages; clearLibrary: CategoryId[]; all: boolean };

export function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "load":
      return {
        ...INITIAL_DRAFT,
        doc: { items: action.items, chosen: action.chosen, library: emptyLibraryDraft() },
        savedItems: action.items,
        savedChosen: action.chosen,
      };

    case "change": {
      const next = action.mutate(state.doc);
      if (next === state.doc) return state;
      const last = state.history[state.history.length - 1];
      const merge = Boolean(action.key && last && last.key === action.key);
      return {
        ...state,
        doc: next,
        history: merge
          ? state.history
          : [...state.history, { label: action.label, key: action.key ?? `auto-${state.history.length}-${action.label}`, doc: state.doc }],
      };
    }

    case "rebase":
      return {
        ...state,
        doc: action.mutate(state.doc),
        history: state.history.map((entry) => ({ ...entry, doc: action.mutate(entry.doc) })),
        notes: action.note ? [...state.notes, action.note] : state.notes,
      };

    case "undo": {
      const last = state.history[state.history.length - 1];
      if (!last) return state;
      return { ...state, doc: last.doc, history: state.history.slice(0, -1) };
    }

    case "saved": {
      const clear = (library: LibraryDraft) => {
        const next = { ...library };
        action.clearLibrary.forEach((category) => {
          next[category] = { order: null, fields: {} };
        });
        return next;
      };
      const doc = {
        items: action.items ?? state.doc.items,
        chosen: action.chosen ?? state.doc.chosen,
        library: clear(state.doc.library),
      };
      return {
        doc,
        savedItems: action.items ?? state.savedItems,
        savedChosen: action.chosen ?? state.savedChosen,
        history: action.all ? [] : state.history.map((entry) => ({ ...entry, doc: { ...entry.doc, library: clear(entry.doc.library) } })),
        notes: action.all ? [] : state.notes,
      };
    }
  }
}

/* ---------- Library view ---------- */

/** The library as it will be saved: server data with your unsaved order and wording on top. */
export function libraryView(server: SelectedWorkImage[], draft: CategoryDraft): SelectedWorkImage[] {
  let images = server;

  if (draft.order) {
    const byName = new Map(server.map((image) => [image.filename, image]));
    const ordered = draft.order.map((name) => byName.get(name)).filter((image): image is SelectedWorkImage => Boolean(image));
    const seen = new Set(ordered.map((image) => image.filename));
    images = [...ordered, ...server.filter((image) => !seen.has(image.filename))];
  }

  return images.map((image) => {
    const fields = draft.fields[image.filename];
    return fields ? { ...image, ...fields } : image;
  });
}

export function hasPendingRename(image: SelectedWorkImage) {
  return Boolean(image.suggestedFilename?.trim());
}

/** Whether a library category needs saving, and how many filenames are waiting to be applied. */
export function libraryStatus(server: SelectedWorkImage[], draft: CategoryDraft) {
  const view = libraryView(server, draft);
  const orderChanged = view.some((image, index) => image.filename !== server[index]?.filename);
  const serverByName = new Map(server.map((image) => [image.filename, image]));
  const wordingChanged = view.some((image) => {
    const original = serverByName.get(image.filename);
    return Boolean(
      original &&
        (original.alt !== image.alt || (original.suggestedFilename ?? "") !== (image.suggestedFilename ?? "")),
    );
  });
  const pendingRenames = view.filter(hasPendingRename).length;
  return { view, orderChanged, wordingChanged, pendingRenames, dirty: orderChanged || wordingChanged || pendingRenames > 0 };
}

/* ---------- Mutators used for rebasing ---------- */

/** A library photograph was renamed (edited or saved): follow it everywhere. */
export function renameInDoc(doc: Doc, category: CategoryId, from: string, to: string): Doc {
  if (from === to) return doc;
  const items = doc.items.map((item) => {
    const src = renameLibraryUrl(item.src, category, from, to);
    const smallSrc = item.smallSrc ? renameLibraryUrl(item.smallSrc, category, from, to) : item.smallSrc;
    return src === item.src && smallSrc === item.smallSrc ? item : { ...item, src, ...(smallSrc ? { smallSrc } : {}) };
  });
  const chosen: CommissionsImages = {};
  (Object.keys(doc.chosen) as Array<keyof CommissionsImages>).forEach((slot) => {
    const picture = doc.chosen[slot];
    if (picture) chosen[slot] = { ...picture, src: renameLibraryUrl(picture.src, category, from, to) };
  });
  const draft = doc.library[category];
  const fields = { ...draft.fields };
  if (fields[from]) {
    fields[to] = fields[from];
    delete fields[from];
  }
  return {
    items,
    chosen,
    library: {
      ...doc.library,
      [category]: { order: draft.order ? draft.order.map((name) => (name === from ? to : name)) : null, fields },
    },
  };
}

/** A library photograph was deleted: take it off the page and out of the boxes. */
export function removeFromDoc(doc: Doc, category: CategoryId, filename: string): Doc {
  const refersTo = (src?: string) => {
    if (!src) return false;
    const parsed = parseLibraryUrl(src);
    return Boolean(parsed && parsed.category === category && parsed.filename === filename);
  };
  const remaining = doc.items.filter((item) => !refersTo(item.src));
  const chosen: CommissionsImages = {};
  (Object.keys(doc.chosen) as Array<keyof CommissionsImages>).forEach((slot) => {
    const picture = doc.chosen[slot];
    if (picture && !refersTo(picture.src)) chosen[slot] = picture;
  });
  const draft = doc.library[category];
  const fields = { ...draft.fields };
  delete fields[filename];
  return {
    // The page must keep at least one photograph.
    items: remaining.length ? remaining : doc.items,
    chosen,
    library: {
      ...doc.library,
      [category]: { order: draft.order ? draft.order.filter((name) => name !== filename) : null, fields },
    },
  };
}

/** Drop unsaved wording for a photograph (used when Vision AI has just rewritten it). */
export function dropFieldDraft(doc: Doc, category: CategoryId, filename: string): Doc {
  const draft = doc.library[category];
  if (!draft.fields[filename]) return doc;
  const fields = { ...draft.fields };
  delete fields[filename];
  return { ...doc, library: { ...doc.library, [category]: { ...draft, fields } } };
}

export function pageUsesLibraryImage(items: ShowcaseItem[], category: CategoryId, filename: string) {
  return items.some((item) => {
    const parsed = parseLibraryUrl(item.src);
    return parsed?.category === category && parsed.filename === filename;
  });
}

export { CATEGORY_IDS };
