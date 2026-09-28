import type { Metadata } from "next";
import {
  notFound,
  permanentRedirect,
} from "next/navigation";

import ProductionContent from "../../../components/ProductionContent";
import ProtectedProduction from "../../../components/ProtectedProduction";
import {
  getDirectory,
} from "../../../lib/directory-repository";
import { getProductionImageUrl } from "../../../lib/production-image-url";
import {
  getNextProductionFromData,
  getProduction,
  getProductionAccessSummary,
  getProductionSlugRedirect,
  getPublicProductionNavigation,
} from "../../../lib/productions-repository";

export const revalidate = 3600;

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
    await getProductionAccessSummary(
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
    await getProduction(slug);

  if (!production) {
    const redirectSlug =
      await getProductionSlugRedirect(
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
  ] = await Promise.all([
    getPublicProductionNavigation(),
    getDirectory(),
  ]);

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
    />
  );
}
