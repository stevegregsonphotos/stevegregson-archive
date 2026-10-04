import "server-only";

import { getSiteContent, saveSiteContent } from "./site-content-repository";
import {
  cleanCommissionsImages,
  cleanSelectedWorkPage,
  COMMISSIONS_IMAGES_KEY,
  defaultSelectedWorkPage,
  SELECTED_WORK_PAGE_KEY,
  type CommissionsImages,
  type SelectedWorkPageContent,
} from "./selected-work-page";

/** Reads one site_content value; the public site passes a cached reader. */
type SiteContentReader = <T>(key: string) => Promise<T | null>;

export async function getSelectedWorkPage(
  readContent: SiteContentReader = getSiteContent,
): Promise<{
  page: SelectedWorkPageContent;
  saved: boolean;
}> {
  try {
    const stored = await readContent<unknown>(SELECTED_WORK_PAGE_KEY);
    const cleaned = stored ? cleanSelectedWorkPage(stored) : null;
    if (cleaned) return { page: cleaned, saved: true };
  } catch (error) {
    console.error("Could not read the Selected Work page settings", error);
  }

  return { page: defaultSelectedWorkPage(), saved: false };
}

export async function saveSelectedWorkPage(page: SelectedWorkPageContent) {
  await saveSiteContent(SELECTED_WORK_PAGE_KEY, page);
}

export async function getCommissionsImages(
  readContent: SiteContentReader = getSiteContent,
): Promise<CommissionsImages> {
  try {
    const stored = await readContent<unknown>(COMMISSIONS_IMAGES_KEY);
    return (stored && cleanCommissionsImages(stored)) || {};
  } catch (error) {
    console.error("Could not read the Commissions image settings", error);
    return {};
  }
}

export async function saveCommissionsImages(images: CommissionsImages) {
  await saveSiteContent(COMMISSIONS_IMAGES_KEY, images);
}
