import { revalidatePath, revalidateTag } from "next/cache";

import {
  PUBLIC_ARCHIVE_TAG,
  PUBLIC_SELECTED_WORK_TAG,
} from "./public-data-cache";

/*
 * Call these from Backstage after any change to data the public website
 * shows. They clear the cross-request Data Cache (lib/public-data-cache.ts)
 * as well as the cached pages, so edits appear on the site straight away.
 * `{ expire: 0 }` expires the cached data at once instead of serving one
 * more stale copy while it refreshes.
 */

/** Productions, credits, photos, archive order, gallery layouts, directory links. */
export function revalidatePublicArchive() {
  revalidateTag(PUBLIC_ARCHIVE_TAG, { expire: 0 });
}

export function revalidateProductionContent(
  slug?: string,
) {
  revalidatePublicArchive();

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

  if (slug) {
    revalidatePath(
      `/productions/${slug}`,
    );
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
