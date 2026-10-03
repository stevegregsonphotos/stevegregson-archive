/*
 * Upcoming productions: private drafts Steve starts in Backstage before the
 * photographs exist (credits, venue, notes from the documentation he's sent).
 *
 * Drafts live ONLY in the site_content key/value table under one key
 * (UPCOMING_PRODUCTIONS_KEY). They are never written to the productions
 * table, so nothing public (archive, sitemap, search, directories,
 * production pages) can see them. They become a real production only when
 * Steve adds the photos in Upload & publish.
 *
 * This file is plain TypeScript (no server-only imports) so the cleaning
 * rules can be shared by the API route, the editor and the unit tests.
 */

export const UPCOMING_PRODUCTIONS_KEY = "upcoming-productions";

export const UPCOMING_LIMITS = {
  drafts: 200,
  credits: 300,
  title: 200,
  venue: 200,
  company: 200,
  shootDates: 300,
  description: 6000,
  notes: 40000,
  role: 160,
  name: 300,
  website: 500,
  /** Rough cap on the whole stored value, in characters of JSON. */
  totalJson: 2_000_000,
} as const;

export type UpcomingCredit = {
  role: string;
  name: string;
  website?: string;
};

export type UpcomingDraft = {
  id: string;
  title: string;
  venue: string;
  /** "" when not known yet, otherwise "1"–"12". */
  month: string;
  /** "" when not known yet, otherwise a four-digit year. */
  year: string;
  description: string;
  company: string;
  shootDates: string;
  notes: string;
  credits: UpcomingCredit[];
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishedUrl?: string;
};

/** The fields Steve edits (everything except bookkeeping). */
export type UpcomingDraftInput = Pick<
  UpcomingDraft,
  "title" | "venue" | "month" | "year" | "description" | "company" | "shootDates" | "notes" | "credits"
>;

export type UpcomingStore = {
  version: 1;
  drafts: UpcomingDraft[];
};

export const EMPTY_UPCOMING_INPUT: UpcomingDraftInput = {
  title: "",
  venue: "",
  month: "",
  year: "",
  description: "",
  company: "",
  shootDates: "",
  notes: "",
  credits: [],
};

function text(value: unknown, max: number, { multiline = false } = {}) {
  if (typeof value !== "string") return "";
  // Drop control characters other than newlines/tabs in multi-line fields.
  const cleaned = multiline
    ? value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    : value.replace(/[\u0000-\u001f\u007f]+/g, " ");
  return cleaned.slice(0, max);
}

function cleanMonth(value: unknown) {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  const month = Number.parseInt(raw, 10);
  return Number.isInteger(month) && month >= 1 && month <= 12 && /^\d{1,2}$/.test(raw) ? String(month) : "";
}

function cleanYear(value: unknown) {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  const year = Number.parseInt(raw, 10);
  return /^\d{4}$/.test(raw) && year >= 1900 && year <= 2100 ? String(year) : "";
}

function cleanCredits(value: unknown): UpcomingCredit[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, UPCOMING_LIMITS.credits).flatMap((item): UpcomingCredit[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const credit: UpcomingCredit = {
      role: text(record.role, UPCOMING_LIMITS.role),
      name: text(record.name, UPCOMING_LIMITS.name),
    };
    const website = text(record.website, UPCOMING_LIMITS.website).trim();
    if (website) credit.website = website;
    return [credit];
  });
}

/** Cleans what the editor sends. Unknown fields are ignored; bad values become blank. */
export function cleanUpcomingInput(value: unknown): UpcomingDraftInput {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    title: text(record.title, UPCOMING_LIMITS.title),
    venue: text(record.venue, UPCOMING_LIMITS.venue),
    month: cleanMonth(record.month),
    year: cleanYear(record.year),
    description: text(record.description, UPCOMING_LIMITS.description, { multiline: true }),
    company: text(record.company, UPCOMING_LIMITS.company),
    shootDates: text(record.shootDates, UPCOMING_LIMITS.shootDates),
    notes: text(record.notes, UPCOMING_LIMITS.notes, { multiline: true }),
    credits: cleanCredits(record.credits),
  };
}

/** Credits worth keeping when saving: rows with at least a role or a name. */
export function tidyCreditsForSave(credits: UpcomingCredit[]) {
  return credits
    .map((credit) => {
      const tidy: UpcomingCredit = { role: credit.role.trim(), name: credit.name.trim() };
      if (credit.website?.trim()) tidy.website = credit.website.trim();
      return tidy;
    })
    .filter((credit) => credit.role || credit.name);
}

export function isValidUpcomingId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]{6,40}$/.test(value);
}

export function createUpcomingId(random: () => number = Math.random) {
  const time = Date.now().toString(36);
  let tail = "";
  for (let index = 0; index < 8; index += 1) tail += Math.floor(random() * 36).toString(36);
  return `${time}${tail}`;
}

function cleanIso(value: unknown, fallback: string) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

/** Reads whatever is stored, tolerating missing or damaged data. */
export function readUpcomingStore(value: unknown): UpcomingStore {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawDrafts = Array.isArray(record.drafts) ? record.drafts : [];
  const seen = new Set<string>();
  const drafts: UpcomingDraft[] = [];
  const epoch = new Date(0).toISOString();

  for (const raw of rawDrafts) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    if (!isValidUpcomingId(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    const createdAt = cleanIso(item.createdAt, epoch);
    const draft: UpcomingDraft = {
      id: item.id,
      ...cleanUpcomingInput(item),
      status: item.status === "published" ? "published" : "draft",
      createdAt,
      updatedAt: cleanIso(item.updatedAt, createdAt),
    };
    if (typeof item.publishedAt === "string") draft.publishedAt = cleanIso(item.publishedAt, createdAt);
    if (typeof item.publishedUrl === "string" && item.publishedUrl.startsWith("/")) {
      draft.publishedUrl = item.publishedUrl.slice(0, 300);
    }
    drafts.push(draft);
  }

  return { version: 1, drafts };
}

export type UpcomingCompleteness = {
  details: boolean;
  credits: number;
  description: boolean;
  notes: boolean;
};

export function upcomingCompleteness(draft: UpcomingDraftInput): UpcomingCompleteness {
  return {
    details: Boolean(draft.title.trim() && draft.venue.trim() && draft.month && draft.year),
    credits: draft.credits.filter((credit) => credit.role.trim() && credit.name.trim()).length,
    description: Boolean(draft.description.trim()),
    notes: Boolean(draft.notes.trim()),
  };
}

/** What's still needed before "Add photos & publish" can go through. */
export function missingForPublish(draft: UpcomingDraftInput) {
  return [
    !draft.title.trim() ? "title" : "",
    !draft.venue.trim() ? "venue" : "",
    !draft.month ? "month" : "",
    !draft.year ? "year" : "",
    !draft.description.trim() ? "description" : "",
  ].filter(Boolean);
}

/** Summary sent to the Productions list (no notes, to keep it light). */
export type UpcomingSummary = Pick<
  UpcomingDraft,
  "id" | "title" | "venue" | "month" | "year" | "shootDates" | "company" | "status" | "updatedAt" | "publishedUrl"
> & { completeness: UpcomingCompleteness };

export function summariseUpcoming(draft: UpcomingDraft): UpcomingSummary {
  return {
    id: draft.id,
    title: draft.title,
    venue: draft.venue,
    month: draft.month,
    year: draft.year,
    shootDates: draft.shootDates,
    company: draft.company,
    status: draft.status,
    updatedAt: draft.updatedAt,
    publishedUrl: draft.publishedUrl,
    completeness: upcomingCompleteness(draft),
  };
}

/** Drafts first (most recently edited first), then published ones. */
export function sortUpcoming<T extends { status: string; updatedAt: string }>(drafts: T[]) {
  return [...drafts].sort((a, b) => {
    if (a.status !== b.status) return a.status === "draft" ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}
