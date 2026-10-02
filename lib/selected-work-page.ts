/*
 * The Selected Work (production) page and the Commissions page images, as
 * edited in Backstage. Shared by the public pages, the API and the editor,
 * so nothing here touches the database.
 */

import {
  showcaseHero,
  showcaseInterlude,
  showcaseSections,
  type ShowcaseImage,
} from "../content/selected-work-showcase";

export const SHOWCASE_SIZES = ["feature", "wide", "half", "portrait", "tall"] as const;
export type ShowcaseSize = (typeof SHOWCASE_SIZES)[number];

export const SHOWCASE_SIZE_LABELS: Record<ShowcaseSize, string> = {
  feature: "Feature (big, on its own)",
  wide: "Full width",
  half: "Half (pairs with the next half)",
  portrait: "Upright pair (pairs with the next upright)",
  tall: "Upright, on its own",
};

export type ShowcaseCredit = {
  title: string;
  venue: string;
  slug: string;
};

export type ShowcaseItem = {
  id: string;
  src: string;
  smallSrc?: string;
  width: number;
  height: number;
  alt: string;
  credit: ShowcaseCredit | null;
  size: ShowcaseSize;
  /** Extra breathing space before this photograph. */
  gapBefore?: boolean;
};

export type SelectedWorkPageContent = {
  items: ShowcaseItem[];
};

export const COMMISSIONS_SLOTS = [
  { id: "hero", label: "Top of the page (large)" },
  { id: "production", label: "Box: Production photography" },
  { id: "rehearsals", label: "Box: Rehearsal photography" },
  { id: "marketing", label: "Box: Campaign photography" },
  { id: "dramaSchools", label: "Box: Drama schools" },
  { id: "opera", label: "Box: Opera" },
  { id: "archive", label: "Box: The archive" },
] as const;

export type CommissionsSlot = (typeof COMMISSIONS_SLOTS)[number]["id"];
export type CommissionsPicture = { src: string; alt: string };
export type CommissionsImages = Partial<Record<CommissionsSlot, CommissionsPicture>>;

export const SELECTED_WORK_PAGE_KEY = "selected-work-page";
export const COMMISSIONS_IMAGES_KEY = "commissions-images";

const ALLOWED_IMAGE_HOSTS = [
  "https://images.stevegregson.com/",
  "https://selected-work-images.stevegregson.com/",
];

function isAllowedSrc(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length < 600 &&
    (ALLOWED_IMAGE_HOSTS.some((host) => value.startsWith(host)) ||
      /^\/selected-work-mockup\/[a-z0-9._-]+$/i.test(value))
  );
}

function isShortText(value: unknown, max = 300): value is string {
  return typeof value === "string" && value.length <= max;
}

function cleanCredit(value: unknown): ShowcaseCredit | null | undefined {
  if (value === null) return null;
  if (typeof value !== "object" || value === null) return undefined;
  const credit = value as Record<string, unknown>;
  if (
    !isShortText(credit.title, 200) ||
    !isShortText(credit.venue, 200) ||
    !isShortText(credit.slug, 200) ||
    !credit.title.trim() ||
    !/^[a-z0-9-]*$/.test(credit.slug)
  ) {
    return undefined;
  }
  return { title: credit.title.trim(), venue: credit.venue.trim(), slug: credit.slug };
}

/** Returns a cleaned copy, or null if anything is invalid. */
export function cleanSelectedWorkPage(value: unknown): SelectedWorkPageContent | null {
  if (typeof value !== "object" || value === null) return null;
  const rawItems = (value as { items?: unknown }).items;
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 80) return null;

  const items: ShowcaseItem[] = [];
  const ids = new Set<string>();

  for (const raw of rawItems) {
    if (typeof raw !== "object" || raw === null) return null;
    const item = raw as Record<string, unknown>;
    const credit = cleanCredit(item.credit);

    if (
      !isShortText(item.id, 120) ||
      !item.id ||
      ids.has(item.id) ||
      !isAllowedSrc(item.src) ||
      (item.smallSrc !== undefined && !isAllowedSrc(item.smallSrc)) ||
      typeof item.width !== "number" ||
      typeof item.height !== "number" ||
      item.width <= 0 ||
      item.height <= 0 ||
      !isShortText(item.alt, 600) ||
      credit === undefined ||
      !SHOWCASE_SIZES.includes(item.size as ShowcaseSize)
    ) {
      return null;
    }

    ids.add(item.id);
    items.push({
      id: item.id,
      src: item.src,
      ...(item.smallSrc ? { smallSrc: item.smallSrc as string } : {}),
      width: Math.round(item.width),
      height: Math.round(item.height),
      alt: item.alt.trim(),
      credit,
      size: item.size as ShowcaseSize,
      ...(item.gapBefore ? { gapBefore: true } : {}),
    });
  }

  return { items };
}

export function cleanCommissionsImages(value: unknown): CommissionsImages | null {
  if (typeof value !== "object" || value === null) return null;
  const result: CommissionsImages = {};

  for (const slot of COMMISSIONS_SLOTS) {
    const raw = (value as Record<string, unknown>)[slot.id];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== "object") return null;
    const picture = raw as Record<string, unknown>;
    if (!isAllowedSrc(picture.src) || !isShortText(picture.alt, 600)) return null;
    result[slot.id] = { src: picture.src, alt: picture.alt.trim() };
  }

  return result;
}

function fromShowcaseImage(
  image: ShowcaseImage,
  size: ShowcaseSize,
  gapBefore = false,
): ShowcaseItem {
  return {
    id: image.id,
    src: image.src,
    ...(image.smallSrc ? { smallSrc: image.smallSrc } : {}),
    width: image.width,
    height: image.height,
    alt: image.alt,
    credit: image.credit
      ? { title: image.credit.title, venue: image.credit.venue, slug: image.credit.slug }
      : null,
    size,
    ...(gapBefore ? { gapBefore: true } : {}),
  };
}

/** The page as it went live on 2 October 2026, used until Backstage saves. */
export function defaultSelectedWorkPage(): SelectedWorkPageContent {
  const items: ShowcaseItem[] = [fromShowcaseImage(showcaseHero, "feature")];

  showcaseSections.forEach((section, sectionIndex) => {
    section.images.forEach((image, imageIndex) => {
      items.push(fromShowcaseImage(image, image.size, sectionIndex > 0 && imageIndex === 0));
    });

    if (section.id === "middle") {
      items.push(fromShowcaseImage(showcaseInterlude, "feature", true));
    }
  });

  return { items };
}
