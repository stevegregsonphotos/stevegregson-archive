import "server-only";

import { unstable_cache } from "next/cache";

import type { Production } from "../content/productions";
import { getDirectory } from "./directory-repository";
import {
  getAdminProductionSummaries,
  getArchiveProductions,
  getProduction,
  getProductionAccessSummary,
  getProductionIndex,
  getProductionSlugRedirects,
  getPublicProductionNavigation,
} from "./productions-repository";
import {
  getCommissionsImages,
  getSelectedWorkPage,
} from "./selected-work-page-repository";
import { getSelectedWork } from "./selected-work-repository";
import { getSiteContent } from "./site-content-repository";

/*
 * Cross-request cache for the PUBLIC website's database reads.
 *
 * Public pages are regenerated in the background (ISR) whenever a visitor
 * or crawler finds an expired copy. Without this layer every regeneration
 * queried Neon directly, so with ~1,500 public pages and constant crawler
 * traffic the database never got the five idle minutes it needs to
 * suspend. These wrappers keep each result in Vercel's Data Cache, so a
 * regeneration normally reads the cache instead of waking the database.
 *
 * Freshness: Backstage calls revalidateTag() for these tags after every
 * change (lib/revalidate-public-content.ts), so edits still appear at once.
 * Nothing expires on a timer: data only refreshes when Backstage changes it.
 *
 * Only public pages, the sitemap and llms.txt use these. Backstage screens,
 * password unlock routes and proofing keep reading live data directly from
 * the repositories.
 *
 * Results are stored as JSON: no Dates, Maps or functions in return values
 * (dates come back as ISO strings). Each cached value must stay well under
 * Vercel's 2MB per-item limit, which is why productions with their photos
 * are cached one production at a time.
 */

/**
 * Archive-wide lists: the production index, archive and navigation lists,
 * photo counts, directory links and old-address redirects. Each production's
 * own data has its own tag (see "One production at a time" below).
 */
export const PUBLIC_ARCHIVE_TAG = "public-archive";

/** Selected Work images and the Selected Work / Commissions page settings. */
export const PUBLIC_SELECTED_WORK_TAG = "public-selected-work";


const archiveOptions = {
  tags: [PUBLIC_ARCHIVE_TAG],
  revalidate: false as const,
};

const selectedWorkOptions = {
  tags: [PUBLIC_SELECTED_WORK_TAG],
  revalidate: false as const,
};

// --- Archive-wide lists (small: no photographs) ---------------------------

export const getCachedArchiveProductions = unstable_cache(
  () => getArchiveProductions(),
  ["public-archive-productions"],
  archiveOptions,
);

export const getCachedProductionIndex = unstable_cache(
  () => getProductionIndex(),
  ["public-production-index"],
  archiveOptions,
);

export const getCachedPublicProductionNavigation = unstable_cache(
  () => getPublicProductionNavigation(),
  ["public-production-navigation"],
  archiveOptions,
);

/** Per-production photo counts, used for the archive page's headline numbers. */
export const getCachedProductionSummaries = unstable_cache(
  () => getAdminProductionSummaries(),
  ["public-production-summaries"],
  archiveOptions,
);

export const getCachedDirectory = unstable_cache(
  () => getDirectory(),
  ["public-directory"],
  archiveOptions,
);

// --- One production at a time ---------------------------------------------

/*
 * Each production's own data is tagged with that production alone (plus a
 * catch-all tag for rare bulk changes). Editing one production therefore
 * refreshes only that production's data: every other production page can
 * rebuild itself from this cache without waking the database.
 */

/** Catch-all tag on every per-production entry, for bulk changes. */
export const PUBLIC_PRODUCTION_PAGES_TAG = "public-production-pages";

/** Same normalising rule the repository functions use for slugs. */
export function normaliseProductionSlug(slug: string): string | null {
  try {
    const normalised = decodeURIComponent(slug).trim().toLowerCase();
    return normalised || null;
  } catch {
    return null;
  }
}

/** Tag for one production's cached data. */
export function productionCacheTag(slug: string) {
  return `public-production:${normaliseProductionSlug(slug) ?? slug}`;
}

function cachedForProduction<T>(
  name: string,
  slug: string,
  read: (slug: string) => Promise<T>,
) {
  return unstable_cache(read, [name], {
    tags: [PUBLIC_PRODUCTION_PAGES_TAG, productionCacheTag(slug)],
    revalidate: false as const,
  })(slug);
}

/*
 * Every live production slug, from the small cached index. Addresses that
 * aren't productions (typos, robots guessing URLs) are turned away here
 * instead of each one costing a database look-up.
 */
async function isKnownProductionSlug(slug: string) {
  const index = await getCachedProductionIndex();
  return index.some((entry) => entry.slug.toLowerCase() === slug);
}

async function readPublicProduction(slug: string): Promise<Production | null> {
  const production = await getProduction(slug);

  if (!production) {
    return null;
  }

  // The encrypted gallery password is never needed to render the public
  // page (password checks happen in the live unlock route), so keep it
  // out of the shared cache.
  const { accessPasswordEncrypted: _omit, ...publicProduction } = production;
  void _omit;
  return publicProduction;
}

/** The production page's data, without the encrypted access password. */
export async function getCachedPublicProduction(slug: string) {
  const normalised = normaliseProductionSlug(slug);

  if (!normalised || !(await isKnownProductionSlug(normalised))) {
    return undefined;
  }

  return (
    (await cachedForProduction(
      "public-production-by-slug",
      normalised,
      readPublicProduction,
    )) ?? undefined
  );
}

export async function getCachedProductionAccessSummary(slug: string) {
  const normalised = normaliseProductionSlug(slug);

  if (!normalised || !(await isKnownProductionSlug(normalised))) {
    return undefined;
  }

  return (
    (await cachedForProduction(
      "public-production-access-summary",
      normalised,
      async (value) => (await getProductionAccessSummary(value)) ?? null,
    )) ?? undefined
  );
}

/** Old production addresses and where they now point (one small list). */
const getCachedProductionSlugRedirects = unstable_cache(
  () => getProductionSlugRedirects(),
  ["public-production-slug-redirects"],
  archiveOptions,
);

export async function getCachedProductionSlugRedirect(slug: string) {
  const normalised = normaliseProductionSlug(slug);

  if (!normalised) {
    return null;
  }

  const redirects = await getCachedProductionSlugRedirects();
  return Object.hasOwn(redirects, normalised) ? redirects[normalised] : null;
}

// --- Selected Work and page settings --------------------------------------

export const getCachedSelectedWork = unstable_cache(
  () => getSelectedWork(),
  ["public-selected-work"],
  selectedWorkOptions,
);

/*
 * The raw site_content read throws on a database error, so a failure is
 * never cached; the repository functions below then apply their usual
 * "fall back to the defaults" handling on top of it.
 */
const getCachedSiteContent = unstable_cache(
  (key: string) => getSiteContent<unknown>(key),
  ["public-site-content"],
  selectedWorkOptions,
);

function readCachedSiteContent<T>(key: string) {
  return getCachedSiteContent(key) as Promise<T | null>;
}

export function getCachedSelectedWorkPage() {
  return getSelectedWorkPage(readCachedSiteContent);
}

export function getCachedCommissionsImages() {
  return getCommissionsImages(readCachedSiteContent);
}
