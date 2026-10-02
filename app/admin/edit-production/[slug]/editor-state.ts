/*
 * Draft state for Productions › Edit: everything on both tabs lives in one
 * "doc" that is saved together by the Save & publish bar. Each change is
 * recorded for Undo; typing in the same field merges into one step.
 */

import {
  DEFAULT_PRODUCTION_GALLERY_LAYOUT,
  type ProductionGalleryLayout,
} from "../../../../lib/production-gallery-layouts";

export type GalleryLayout =
  | "wide"
  | "left"
  | "right"
  | "medium"
  | "full"
  | "left-small"
  | "right-small"
  | "wide-left"
  | "wide-right";

export const LAYOUT_OPTIONS: Array<{ value: GalleryLayout; label: string }> = [
  { value: "wide", label: "Wide" },
  { value: "full", label: "Full" },
  { value: "medium", label: "Medium" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "left-small", label: "Left small" },
  { value: "right-small", label: "Right small" },
  { value: "wide-left", label: "Wide left" },
  { value: "wide-right", label: "Wide right" },
];

export function layoutLabel(layout: GalleryLayout) {
  return LAYOUT_OPTIONS.find((option) => option.value === layout)?.label ?? layout;
}

export type ProductionImage = {
  src: string;
  alt: string;
  layout: GalleryLayout;
  suggestedFilename?: string;
  originalSrc?: string;
  editAspect?: "original" | "3:2" | "4:5" | "1:1" | "16:9";
  editZoom?: number;
  editPanX?: number;
  editPanY?: number;
  editBrightness?: number;
  editAutoStrength?: number;
  analysisStatus?: "pending" | "complete";
  analysedAt?: string;
};

export type ProductionCredit = {
  role: string;
  name: string;
  website?: string;
};

export type Production = {
  slug: string;
  title: string;
  venue: string;
  month?: number | null;
  year: number;
  description: string;
  hero: string;
  heroAlt: string;
  access?: "public" | "password";
  showHeroWhenLocked?: boolean;
  accessPassword?: string;
  credits: ProductionCredit[];
  images: ProductionImage[];
  galleryLayout?: ProductionGalleryLayout;
};

export type Doc = {
  slug: string;
  title: string;
  venue: string;
  month: string;
  year: string;
  description: string;
  access: "public" | "password";
  accessPassword: string;
  showHeroWhenLocked: boolean;
  credits: ProductionCredit[];
  hero: string;
  images: ProductionImage[];
  galleryLayout: ProductionGalleryLayout;
};

export function docFromProduction(production: Production): Doc {
  return {
    slug: production.slug,
    title: production.title,
    venue: production.venue,
    month: production.month == null ? "" : String(production.month),
    year: String(production.year),
    description: production.description,
    access: production.access ?? "public",
    accessPassword: production.accessPassword ?? "",
    showHeroWhenLocked: production.showHeroWhenLocked ?? false,
    credits: production.credits,
    hero: production.hero,
    images: production.images,
    galleryLayout: production.galleryLayout ?? DEFAULT_PRODUCTION_GALLERY_LAYOUT,
  };
}

/** True while a photo still has no description, or only the automatic placeholder. */
export function needsDescription(image: ProductionImage) {
  const alt = image.alt.trim();
  return !alt || /production photograph/i.test(alt);
}

type HistoryEntry = { label: string; key: string; doc: Doc };

export type EditorState = {
  doc: Doc | null;
  saved: Doc | null;
  history: HistoryEntry[];
};

export type EditorAction =
  | { type: "load"; doc: Doc }
  | { type: "change"; label: string; key?: string; mutate: (doc: Doc) => Doc }
  | { type: "undo" };

export const INITIAL_EDITOR_STATE: EditorState = { doc: null, saved: null, history: [] };

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
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
              {
                label: action.label,
                key: action.key ?? `auto-${state.history.length}-${action.label}`,
                doc: state.doc,
              },
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

export function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
