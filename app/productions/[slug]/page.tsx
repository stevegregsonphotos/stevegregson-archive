import type { Metadata } from "next";
import {
  notFound,
  permanentRedirect,
} from "next/navigation";

import ProductionContent from "../../../components/ProductionContent";
import ProtectedProduction from "../../../components/ProtectedProduction";
import { getProductionImageUrl } from "../../../lib/production-image-url";
import { getNextProductionFromData } from "../../../lib/productions-repository";
import {
  getCachedDirectory,
  getCachedProductionAccessSummary,
  getCachedProductionSlugRedirect,
  getCachedPublicProduction,
  getCachedPublicProductionNavigation,
} from "../../../lib/public-data-cache";
import {
  getDirectoryData,
  MIN_VENUE_PRODUCTIONS,
  splitCreditNames,
} from "../../../lib/people-directory";
import { canonicalVenue } from "../../../lib/venues";
import { serviceLinkFor } from "../../../lib/sectors";

export const revalidate = false; // Rebuilt only when Backstage changes something (on-demand revalidation).

export async function generateStaticParams() {
  return [];
}

type ProductionPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: ProductionPageProps): Promise<Metadata> {
  const { slug } = await params;

  const production =
    await getCachedProductionAccessSummary(
      slug,
    );

  if (!production) {
    return {
      title: "Production not found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  if (production.access === "password") {
    return {
      title: production.title,
      robots: {
        index: false,
        follow: false,
        noarchive: true,
      },
    };
  }

  const canonicalPath =
    `/productions/${production.slug}`;

  const title =
    `${production.title} — Theatre Photography at ${production.venue}`;

  const description =
    `${production.title} at ${production.venue} (${production.year}), photographed by London theatre photographer Steve Gregson. Production photography, cast and creative credits.`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: "article",
      url: canonicalPath,
      title,
      description,
      images: [
        {
          url: getProductionImageUrl(
            production.slug,
            production.hero,
          ),
          alt: production.heroAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        getProductionImageUrl(
          production.slug,
          production.hero,
        ),
      ],
    },
  };
}

export default async function ProductionPage({
  params,
}: ProductionPageProps) {
  const { slug } = await params;

  const production =
    await getCachedPublicProduction(slug);

  if (!production) {
    const redirectSlug =
      await getCachedProductionSlugRedirect(
        slug,
      );

    if (redirectSlug) {
      permanentRedirect(
        `/productions/${redirectSlug}`,
      );
    }

    notFound();
  }

  if (
    production.access === "password"
  ) {
    return (
      <ProtectedProduction
        slug={production.slug}
        title={production.title}
        venue={production.venue}
        year={production.year}
        hero={
          production.showHeroWhenLocked
            ? production.hero
            : undefined
        }
        heroAlt={
          production.showHeroWhenLocked
            ? production.heroAlt
            : undefined
        }
      />
    );
  }

  const [
    navigation,
    directory,
    peopleDirectory,
  ] = await Promise.all([
    getCachedPublicProductionNavigation(),
    getCachedDirectory(),
    getDirectoryData(),
  ]);

  const personSlugs: Record<string, string> = {};
  production.credits.forEach((credit) => {
    splitCreditNames(credit.name).forEach((name) => {
      const personSlug = peopleDirectory.slugForName(name);
      if (personSlug) personSlugs[name] = personSlug;
    });
  });

  const venue = canonicalVenue(production.venue);
  const venueSlug = venue && peopleDirectory.venues.some(
    (item) => item.slug === venue.slug && item.productions.length >= MIN_VENUE_PRODUCTIONS,
  )
    ? venue.slug
    : undefined;

  const nextProduction =
    getNextProductionFromData(
      navigation,
      production.slug,
    );

  return (
    <ProductionContent
      production={production}
      directory={directory}
      nextProduction={nextProduction}
      personSlugs={personSlugs}
      venueSlug={venueSlug}
      serviceLink={serviceLinkFor(production)}
    />
  );
}
