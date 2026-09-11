import type { Metadata } from "next";

import {
  getProductions,
} from "../../../lib/productions-repository";

import ProductionManager from "./ProductionManager";

export const metadata: Metadata = {
  title: "Productions | Backstage",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ProductionsAdminPage() {
  const productions =
    await getProductions();

  const productionSummaries = productions.map(
    (production) => ({
      slug: production.slug,
      title: production.title,
      venue: production.venue,
      month: production.month ?? null,
      year: production.year,
      hero: production.hero,
      imageCount: production.images.length,
    }),
  );

  const years = productions.map(
    (production) => production.year,
  );

  const uniqueVenues = new Set(
    productions
      .map((production) => production.venue.trim())
      .filter(Boolean),
  );

  const metrics = {
    productionCount: productions.length,
    photographCount: productions.reduce(
      (total, production) =>
        total + production.images.length,
      0,
    ),
    earliestYear:
      years.length > 0
        ? Math.min(...years)
        : null,
    latestYear:
      years.length > 0
        ? Math.max(...years)
        : null,
    venueCount: uniqueVenues.size,
  };

  return (
    <ProductionManager
      productions={productionSummaries}
      metrics={metrics}
    />
  );
}