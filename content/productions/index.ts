import type { Production } from "./types";

import { productionEntries } from "./generated";

function productionMonth(production: Production) {
  return production.month ?? 0;
}

export const productions = [...productionEntries].sort(
  (first, second) =>
    second.year - first.year ||
    productionMonth(second) - productionMonth(first) ||
    first.title.localeCompare(second.title),
);

export function getProduction(slug: string) {
  const normalisedSlug = decodeURIComponent(slug)
    .trim()
    .toLowerCase();

  return productions.find(
    (production) =>
      production.slug.trim().toLowerCase() ===
      normalisedSlug,
  );
}

export function getNextProduction(slug: string) {
  const normalisedSlug = decodeURIComponent(slug)
    .trim()
    .toLowerCase();

  const currentIndex = productions.findIndex(
    (production) =>
      production.slug.trim().toLowerCase() ===
      normalisedSlug,
  );

  if (
    currentIndex === -1 ||
    productions.length < 2
  ) {
    return undefined;
  }

  const nextIndex =
    (currentIndex + 1) % productions.length;

  return productions[nextIndex];
}

export type {
  GalleryLayout,
  Production,
  ProductionCredit,
  ProductionImage,
} from "./types";