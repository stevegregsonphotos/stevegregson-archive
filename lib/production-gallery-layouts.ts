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
  "per-photo";

export const PRODUCTION_GALLERY_LAYOUT_OPTIONS: Array<{
  value: ProductionGalleryLayout;
  name: string;
  description: string;
}> = [
  {
    value: "per-photo",
    name: "As set per photo",
    description: "Each photograph uses its own layout setting. This is how galleries have always worked.",
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
    description: "A repeating pattern: one full width, then two side by side, then three.",
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
  layout: Exclude<ProductionGalleryLayout, "per-photo" | "masonry">,
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
