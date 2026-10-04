import type { MetadataRoute } from "next";

import {
  getDirectoryData,
  MIN_VENUE_PRODUCTIONS,
  ROLE_GROUPS,
} from "../lib/people-directory";
import { getProductionImageUrl } from "../lib/production-image-url";
import { getPublicProductionSitemapImages } from "../lib/productions-repository";
import { getCachedProductionIndex } from "../lib/public-data-cache";

export const revalidate = 86400;

const siteUrl = "https://www.stevegregson.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The photo list is read live (lean query, no blur data) rather than kept
  // in the Data Cache, where a large archive could pass the 2MB item limit.
  // The sitemap itself is only rebuilt once a day or after a Backstage edit.
  const [productions, sitemapImages] = await Promise.all([
    getCachedProductionIndex(),
    getPublicProductionSitemapImages(),
  ]);

  // Every public photograph, listed under its production page, so Google
  // Images can find the whole archive (Google reads up to 1,000 per page).
  const imagesBySlug = new Map<string, string[]>();
  for (const production of sitemapImages) {
    const files = [
      production.hero,
      ...production.images,
    ].filter(Boolean);
    const urls: string[] = [];
    for (const file of new Set(files)) {
      try {
        urls.push(getProductionImageUrl(production.slug, file));
      } catch {
        // Skip a malformed filename rather than break the sitemap.
      }
    }
    imagesBySlug.set(production.slug, urls.slice(0, 1000));
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${siteUrl}/selected-work`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/rehearsals`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/marketing-pr`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/archive`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/people`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/commissions`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/drama-school-photography`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/opera-photography`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/about`,
      changeFrequency: "yearly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/contact`,
      changeFrequency: "yearly",
      priority: 0.6,
    },
  ];

  const productionRoutes: MetadataRoute.Sitemap = productions
    .filter(
      (production) =>
        production.access !== "password",
    )
    .map((production) => ({
      url: `${siteUrl}/productions/${production.slug}`,
      lastModified: new Date(
        production.updatedAt,
      ),
      images: imagesBySlug.get(production.slug) ?? [],
      changeFrequency: "yearly" as const,
      priority: 0.8,
    }));

  const { people, venues } = await getDirectoryData();

  const directoryRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/venues`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    ...ROLE_GROUPS
      .filter((group) => people.some((person) => person.groups.includes(group.key)))
      .map((group) => ({
        url: `${siteUrl}/people/roles/${group.key}`,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
    ...venues
      .filter((venue) => venue.productions.length >= MIN_VENUE_PRODUCTIONS)
      .map((venue) => ({
        url: `${siteUrl}/venues/${venue.slug}`,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ...people.map((person) => ({
      url: `${siteUrl}/people/${person.slug}`,
      changeFrequency: "monthly" as const,
      priority: person.productions.length > 1 ? 0.5 : 0.3,
    })),
  ];

  return [
    ...staticRoutes,
    ...productionRoutes,
    ...directoryRoutes,
  ];
}
