import type { Production } from "./types";

import { aliceInWonderland } from "./alice-in-wonderland";
import { extraordinaryWomen } from "./extraordinary-women";
import { girlInTheMachine } from "./girl-in-the-machine";
import { godspell } from "./godspell";
import { lonelyLondoners } from "./lonely-londoners";
import { theCode } from "./the-code";

import { footfallsAndRockaby } from "./footfalls-and-rockaby";

export const productions: Production[] = [
  footfallsAndRockaby,
  godspell,
  theCode,
  extraordinaryWomen,
  lonelyLondoners,
  aliceInWonderland,
  girlInTheMachine,
];

export function getProduction(slug: string) {
  const normalisedSlug = decodeURIComponent(slug)
    .trim()
    .toLowerCase();

  return productions.find(
    (production) =>
      production.slug.trim().toLowerCase() === normalisedSlug,
  );
}

export function getNextProduction(slug: string) {
  const normalisedSlug = decodeURIComponent(slug)
    .trim()
    .toLowerCase();

  const currentIndex = productions.findIndex(
    (production) =>
      production.slug.trim().toLowerCase() === normalisedSlug,
  );

  if (currentIndex === -1 || productions.length < 2) {
    return undefined;
  }

  const nextIndex = (currentIndex + 1) % productions.length;

  return productions[nextIndex];
}

export type {
  GalleryLayout,
  Production,
  ProductionCredit,
  ProductionImage,
} from "./types";