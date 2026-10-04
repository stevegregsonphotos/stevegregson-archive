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
  getProductionSlugRedirect,
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
 * The one-day revalidate is only a safety net.
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

/** Productions, credits, directory links and production gallery layouts. */
export const PUBLIC_ARCHIVE_TAG = "public-archive";

/** Selected Work images and the Selected Work / Commissions page settings. */
export const PUBLIC_SELECTED_WORK_TAG = "public-selected-work";


const archiveOptions = {
  tags: [PUBLIC_ARCHIVE_TAG],
  revalidate: false,
};

const selectedWorkOptions = {
  tags: [PUBLIC_SELECTED_WORK_TAG],
  revalidate: false,
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
 * Slugs are passed through exactly as the page received them; the
 * repository functions normalise them as before.
 */
const getCachedPublicProductionBySlug = unstable_cache(
  async (slug: string): Promise<Production | null> => {
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
  },
  ["public-production-by-slug"],
  archiveOptions,
);

/** The production page's data, without the encrypted access password. */
export async function getCachedPublicProduction(slug: string) {
  return (await getCachedPublicProductionBySlug(slug)) ?? undefined;
}

const getCachedProductionAccessSummaryBySlug = unstable_cache(
  async (slug: string) =>
    (await getProductionAccessSummary(slug)) ?? null,
  ["public-production-access-summary"],
  archiveOptions,
);

export async function getCachedProductionAccessSummary(slug: string) {
  return (await getCachedProductionAccessSummaryBySlug(slug)) ?? undefined;
}

export const getCachedProductionSlugRedirect = unstable_cache(
  (slug: string) => getProductionSlugRedirect(slug),
  ["public-production-slug-redirect"],
  archiveOptions,
);

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
