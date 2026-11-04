import { revalidatePath, revalidateTag } from "next/cache";

import { buildDirectory } from "./people-directory";
import { getArchiveProductions } from "./productions-repository";
import {
  getCachedArchiveProductions,
  normaliseProductionSlug,
  PUBLIC_ARCHIVE_TAG,
  PUBLIC_PRODUCTION_PAGES_TAG,
  PUBLIC_SELECTED_WORK_TAG,
  productionCacheTag,
} from "./public-data-cache";

/*
 * Call these from Backstage after any change to data the public website
 * shows. They clear the cross-request Data Cache (lib/public-data-cache.ts)
 * as well as the cached pages, so edits appear on the site straight away.
 * `{ expire: 0 }` expires the cached data at once instead of serving one
 * more stale copy while it refreshes.
 */

/**
 * Which productions' own data changed:
 * - one slug or a list of slugs: just those productions (include the old
 *   slug as well as the new one after a rename);
 * - an empty list: no individual production changed (e.g. archive order);
 * - nothing: unknown, so every production is refreshed (bulk changes).
 */
export type ChangedProductions = string | Array<string | null | undefined> | null | undefined;

function changedSlugs(changed: ChangedProductions): string[] | null {
  if (changed === null || changed === undefined) {
    return null;
  }

  const list = Array.isArray(changed) ? changed : [changed];
  return [...new Set(
    list.filter((slug): slug is string => typeof slug === "string" && slug.trim() !== ""),
  )];
}

/** Archive-wide lists only: index, archive, navigation, counts, directory, redirects. */
export function revalidateArchiveLists() {
  revalidateTag(PUBLIC_ARCHIVE_TAG, { expire: 0 });
}

/**
 * Archive-wide lists plus every production's own data. Use when it isn't
 * known which productions changed; prefer revalidateProductionContent(slug).
 */
export function revalidatePublicArchive() {
  revalidateArchiveLists();
  revalidateTag(PUBLIC_PRODUCTION_PAGES_TAG, { expire: 0 });
}

/*
 * People pages (/people/<name>, 1,000+ of them) only show the productions
 * that person is credited on. Rebuilding all of them after every Backstage
 * change used up Vercel's free "ISR writes" (each page is rewritten as
 * crawlers revisit it), so only the people credited on the changed
 * productions are refreshed: as credited before the change (from the cache,
 * which still holds the old version) and after it (fresh from the database),
 * so people added to or removed from a production are both covered.
 */
const MAX_PEOPLE_PAGES = 400; // beyond this, refreshing them all is simpler

type ArchiveList = Parameters<typeof buildDirectory>[0];

function peopleCreditedOn(slugs: string[], productions: ArchiveList) {
  const wanted = new Set(slugs.map((slug) => normaliseProductionSlug(slug) ?? slug));
  return buildDirectory(productions).people
    .filter((person) => person.productions.some((production) => wanted.has(normaliseProductionSlug(production.slug) ?? production.slug)))
    .flatMap((person) => [person.slug, ...person.altSlugs]);
}

export async function revalidateProductionContent(
  changed?: ChangedProductions,
) {
  const slugs = changedSlugs(changed);

  // null = refresh every People page (bulk or unknown changes, or if the
  // lookup fails for any reason: never risk leaving a page out of date).
  let people: Set<string> | null = null;
  if (slugs !== null) {
    try {
      people = new Set(slugs.length > 0 ? peopleCreditedOn(slugs, await getCachedArchiveProductions()) : []);
    } catch (error) {
      console.error("Couldn't work out which People pages to refresh (before):", error);
      people = null;
    }
  }

  revalidateArchiveLists();

  if (slugs === null) {
    revalidateTag(PUBLIC_PRODUCTION_PAGES_TAG, { expire: 0 });
  } else {
    for (const slug of slugs) {
      revalidateTag(productionCacheTag(slug), { expire: 0 });
    }
  }

  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath("/sitemap.xml");
  // Pages whose counts and lists come from the archive.
  revalidatePath("/commissions");
  revalidatePath("/drama-school-photography");
  revalidatePath("/opera-photography");
  revalidatePath("/people");
  revalidatePath("/people/roles/[role]", "page");
  revalidatePath("/venues");
  revalidatePath("/venues/[slug]", "page");
  revalidatePath("/llms.txt");

  if (people !== null && slugs !== null && slugs.length > 0) {
    try {
      for (const slug of peopleCreditedOn(slugs, await getArchiveProductions())) {
        people.add(slug);
      }
    } catch (error) {
      console.error("Couldn't work out which People pages to refresh (after):", error);
      people = null;
    }
  }

  if (people === null || people.size > MAX_PEOPLE_PAGES) {
    revalidatePath("/people/[slug]", "page");
  } else {
    for (const slug of people) {
      revalidatePath(`/people/${slug}`);
    }
  }

  // Every production page shows the archive navigation and directory links,
  // so they all rebuild on their next visit. Unchanged productions rebuild
  // from the cache, so this doesn't wake the database for each of them.
  for (const slug of slugs ?? []) {
    revalidatePath(`/productions/${slug}`);
  }
}

/** Selected Work images and the Selected Work / Commissions page settings. */
export function revalidateSelectedWorkContent() {
  revalidateTag(PUBLIC_SELECTED_WORK_TAG, { expire: 0 });

  revalidatePath("/");
  revalidatePath("/selected-work");
  revalidatePath("/rehearsals");
  revalidatePath("/marketing-pr");
  revalidatePath("/commissions");
}
