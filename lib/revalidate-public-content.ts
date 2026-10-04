import { revalidatePath, revalidateTag } from "next/cache";

import {
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

export function revalidateProductionContent(
  changed?: ChangedProductions,
) {
  const slugs = changedSlugs(changed);

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
  revalidatePath("/people/[slug]", "page");
  revalidatePath("/people/roles/[role]", "page");
  revalidatePath("/venues");
  revalidatePath("/venues/[slug]", "page");
  revalidatePath("/llms.txt");

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
