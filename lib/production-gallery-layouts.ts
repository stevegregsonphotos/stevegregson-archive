/*
 * Per-production "Gallery layout" presets, chosen in Backstage
 * (Productions › Edit › Photographs). "per-photo" is the original
 * behaviour, where each photograph's own layout setting places it;
 * the other presets lay every photograph out the same way and
 * ignore the per-photo settings (which are kept for switching back).
 *
 * Stored in the site_content key/value table under
 * productionGalleryLayoutKey(slug), so no change to the productions
 * tables is needed. A missing key means "per-photo".
 */

export const PRODUCTION_GALLERY_LAYOUTS = [
  "balanced",
  /** Retired 18 Nov 2026 (each photo alone, staggered). Stored values now read as the default. */
  "per-photo",
  "grid-3",
  "grid-2",
  "feature",
  "masonry",
  "editorial",
] as const;

export type ProductionGalleryLayout =
  (typeof PRODUCTION_GALLERY_LAYOUTS)[number];

export const DEFAULT_PRODUCTION_GALLERY_LAYOUT: ProductionGalleryLayout =
  "balanced";

export const PRODUCTION_GALLERY_LAYOUT_OPTIONS: Array<{
  value: ProductionGalleryLayout;
  name: string;
  description: string;
}> = [
  {
    value: "balanced",
    name: "Balanced rows",
    description: "Rows of two or three that fill the page, with a big photograph about every eight. Nothing is cropped: portraits sit beside landscapes.",
  },
  {
    value: "grid-3",
    name: "Even grid · 3 across",
    description: "Neat rows of three, every photograph cropped to the same landscape shape.",
  },
  {
    value: "grid-2",
    name: "Even grid · 2 across",
    description: "Larger pictures in rows of two, all cropped to the same landscape shape.",
  },
  {
    value: "feature",
    name: "One big, then 3 across",
    description: "The first photograph full width, then the rest in neat rows of three.",
  },
  {
    value: "masonry",
    name: "Masonry · 3 columns",
    description: "Three columns, every photograph uncropped at its own shape.",
  },
  {
    value: "editorial",
    name: "Editorial rhythm",
    description: "A repeating pattern: one big, then two side by side, then three. Nothing is cropped: portraits stay portrait.",
  },
];

export function isProductionGalleryLayout(
  value: unknown,
): value is ProductionGalleryLayout {
  return (
    typeof value === "string" &&
    (PRODUCTION_GALLERY_LAYOUTS as readonly string[]).includes(value)
  );
}

export function productionGalleryLayoutKey(slug: string) {
  return `production-gallery:${slug.trim().toLowerCase()}`;
}

/** Stored value in site_content. */
export type StoredProductionGalleryLayout = {
  layout: ProductionGalleryLayout;
};

export function parseStoredProductionGalleryLayout(
  value: unknown,
): ProductionGalleryLayout | undefined {
  /* The old "per-photo" layout is retired: read it as the default. */
  if (
    value &&
    typeof value === "object" &&
    (value as { layout?: unknown }).layout === "per-photo"
  ) {
    return undefined;
  }
  if (
    value &&
    typeof value === "object" &&
    "layout" in value &&
    isProductionGalleryLayout((value as { layout: unknown }).layout)
  ) {
    return (value as StoredProductionGalleryLayout).layout;
  }
  return undefined;
}

/**
 * How a photograph sits in a preset, on a 6-column grid. Used by the
 * Backstage mini preview; the public page uses matching CSS in globals.css.
 * `crop` = cropped to 3:2; otherwise the photograph keeps its own shape.
 */
export function presetTile(
  layout: Exclude<ProductionGalleryLayout, "per-photo" | "masonry" | "balanced">,
  index: number,
): { span: number; crop: boolean } {
  switch (layout) {
    case "grid-3":
      return { span: 2, crop: true };
    case "grid-2":
      return { span: 3, crop: true };
    case "feature":
      return index === 0 ? { span: 6, crop: false } : { span: 2, crop: true };
    case "editorial": {
      const position = index % 6;
      if (position === 0) return { span: 6, crop: false };
      if (position <= 2) return { span: 3, crop: true };
      return { span: 2, crop: true };
    }
  }
}

/*
 * Every row gallery (balanced and editorial) ends on a landscape photo on
 * its own, centred (Steve, 18 Nov 2026: so the page ends well). If the
 * running order ends on a portrait, the latest landscape moves to the end;
 * nothing else changes order. Landscape = wider than 1.2 : 1.
 */
export const LANDSCAPE_RATIO = 1.2;

export function landscapeEndingOrder(ratios: number[]): number[] {
  const order = ratios.map((_, index) => index);
  let last = -1;

  for (let index = ratios.length - 1; index >= 0; index -= 1) {
    if (ratios[index] > LANDSCAPE_RATIO) {
      last = index;
      break;
    }
  }

  if (last < 0 || last === ratios.length - 1) {
    return order;
  }

  order.splice(last, 1);
  order.push(last);
  return order;
}

/*
 * Balanced rows (the default since 18 Nov 2026). Works on each photo's
 * shape (width ÷ height) only, so the same rows are used at every screen
 * width; the CSS gives photos in a row one shared height.
 *  - The first photo, and then a landscape about every eight photos, gets a
 *    row of its own (capped so it's never taller than the screen).
 *  - Other rows take photos until their shapes add up to about 2.6 (two
 *    landscapes, or a portrait between two landscapes), at most three.
 *  - The last photo always has a row of its own (see landscapeEndingOrder).
 *  - A photo left alone just before it (not a deliberate big one) joins
 *    the row before, so the page never ends on two single photos.
 * Expects ratios already in display order (after landscapeEndingOrder).
 */
export const BALANCED_ROW_TARGET = 2.6;
export const BALANCED_MAX_PER_ROW = 3;
export const BALANCED_FEATURE_EVERY = 8;

export function balancedRows(ratios: number[]): number[][] {
  if (ratios.length === 0) {
    return [];
  }

  const end = ratios.length - 1;
  const rows: number[][] = [];
  const features = new Set<number>();
  let index = 0;
  let sinceFeature = 0;

  while (index < end) {
    const ratio = ratios[index];

    if (
      (index === 0 || (sinceFeature >= BALANCED_FEATURE_EVERY && end - index >= 4)) &&
      ratio > LANDSCAPE_RATIO
    ) {
      features.add(rows.length);
      rows.push([index]);
      index += 1;
      sinceFeature = 0;
      continue;
    }

    const row: number[] = [];
    let sum = 0;

    while (index < end && row.length < BALANCED_MAX_PER_ROW) {
      row.push(index);
      sum += ratios[index];
      index += 1;

      if (sum >= BALANCED_ROW_TARGET) {
        break;
      }
    }

    rows.push(row);
    sinceFeature += row.length;
  }

  const lastRow = rows.length - 1;
  const last = rows[lastRow];
  const previous = rows[lastRow - 1];

  if (
    last &&
    previous &&
    last.length === 1 &&
    !features.has(lastRow) &&
    !features.has(lastRow - 1) &&
    previous.length < BALANCED_MAX_PER_ROW + 1
  ) {
    previous.push(last[0]);
    rows.pop();
  }

  rows.push([end]);
  return rows;
}
