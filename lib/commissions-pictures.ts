import "server-only";

import { getProductionCardImageUrl } from "./production-image-url";
import { getLiveSectorData } from "./sectors";
import {
  getSelectedWorkDisplayUrl,
  getSelectedWorkPreviewUrl,
} from "./selected-work-image-url";
import {
  getSelectedWork,
  type SelectedWorkCategory,
  type SelectedWorkData,
} from "./selected-work-repository";
import { getCommissionsImages } from "./selected-work-page-repository";
import type {
  CommissionsPicture,
  CommissionsSlot,
} from "./selected-work-page";

/** The Selected Work photograph behind the page title: mostly black, high contrast. */
const HERO_IMAGE = "stage-performer-profile-vertical-light-minimalist-darkness";

type CoverProduction = { slug: string; hero: string; heroAlt: string; title: string };

/** The nth landscape image in a Selected Work library category. */
function selectedPicture(
  portfolio: SelectedWorkData,
  category: SelectedWorkCategory,
  index: number,
  size: "preview" | "display" = "preview",
): CommissionsPicture | undefined {
  const images = portfolio[category] ?? [];
  const landscape = images.filter((image) => !image.width || !image.height || image.width > image.height);
  const image = landscape[index] ?? images[index];
  if (!image) return undefined;
  const url = size === "display" ? getSelectedWorkDisplayUrl : getSelectedWorkPreviewUrl;
  return { src: url(category, image.filename), alt: image.alt };
}

function productionCover(production?: CoverProduction): CommissionsPicture | undefined {
  return production
    ? { src: getProductionCardImageUrl(production.slug, production.hero), alt: production.heroAlt || production.title }
    : undefined;
}

/** What the Commissions page shows when nothing has been picked in Backstage. */
export function automaticCommissionsPictures(
  portfolio: SelectedWorkData,
  dramaSchools: CoverProduction[],
  opera: CoverProduction[],
): Record<CommissionsSlot, CommissionsPicture | undefined> {
  const heroImage = portfolio.production?.find(
    (image) => image.filename.replace(/\.[a-z0-9]+$/i, "") === HERO_IMAGE,
  );

  return {
    hero: heroImage
      ? { src: getSelectedWorkDisplayUrl("production", heroImage.filename), alt: heroImage.alt }
      : selectedPicture(portfolio, "production", 1, "display"),
    production: selectedPicture(portfolio, "production", 0),
    rehearsals: selectedPicture(portfolio, "rehearsal", 0),
    marketing: selectedPicture(portfolio, "campaign", 2),
    dramaSchools: productionCover(
      dramaSchools.find((production) => !/summer school/i.test(production.title)) ?? dramaSchools[0],
    ),
    opera: productionCover(opera[0]),
    archive: selectedPicture(portfolio, "production", 2),
  };
}

/** For Backstage: each box's picture now, and whether it was picked by hand. */
export async function getCommissionsPicturesForEditor() {
  const [{ dramaSchools, opera }, portfolio, chosen] = await Promise.all([
    getLiveSectorData(),
    getSelectedWork().catch(() => ({ production: [], rehearsal: [], campaign: [] }) as SelectedWorkData),
    getCommissionsImages(),
  ]);

  return {
    automatic: automaticCommissionsPictures(portfolio, dramaSchools.productions, opera.productions),
    chosen,
  };
}
