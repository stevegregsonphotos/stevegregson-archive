import type { Metadata } from "next";

import {
  getAdminProductionSummaries,
} from "../../../lib/productions-repository";

import { summariseUpcoming, type UpcomingSummary } from "../../../lib/upcoming-productions";
import { listUpcomingDrafts } from "../../../lib/upcoming-productions-repository";

import ProductionManager from "./ProductionManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Productions | Backstage",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ProductionsAdminPage() {
  const productionSummaries =
    await getAdminProductionSummaries();

  const productions = productionSummaries;

  // Upcoming drafts are private and optional: never let them break this page.
  let upcoming: UpcomingSummary[] = [];
  let upcomingError = false;
  try {
    upcoming = (await listUpcomingDrafts()).map(summariseUpcoming);
  } catch (error) {
    console.error("Upcoming productions could not be loaded:", error);
    upcomingError = true;
  }

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
        total + production.imageCount,
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
      upcoming={upcoming}
      upcomingError={upcomingError}
    />
  );
}