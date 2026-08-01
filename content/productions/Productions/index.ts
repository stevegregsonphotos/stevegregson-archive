import { aliceInWonderland } from "./alice-in-wonderland";
import { lonelyLondoners } from "./lonely-londoners";

import type { Production } from "./types";

export type {
  GalleryLayout,
  Production,
  ProductionCredit,
  ProductionImage,
  ProductionLink,
} from "./types";

export const productions: Production[] = [
  lonelyLondoners,
  aliceInWonderland,
];

export function getProduction(slug: string) {
  return productions.find((production) => production.slug === slug);
}