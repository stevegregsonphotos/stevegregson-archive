export type GalleryLayout =
  | "wide"
  | "left"
  | "right"
  | "medium"
  | "full"
  | "left-small"
  | "right-small"
  | "wide-left"
  | "wide-right";

export type GalleryOrientation =
  | "landscape"
  | "portrait"
  | "square";

export function getDeterministicGalleryLayout(
  orientation: GalleryOrientation,
  index: number,
): GalleryLayout {
  if (orientation === "portrait") {
    return index % 2 === 0
      ? "left"
      : "right";
  }

  if (orientation === "square") {
    return "medium";
  }

  const layouts: GalleryLayout[] = [
    "wide",
    "wide-left",
    "wide-right",
    "full",
  ];

  return layouts[
    index % layouts.length
  ];
}
