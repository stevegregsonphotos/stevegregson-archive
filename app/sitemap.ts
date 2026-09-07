import type { MetadataRoute } from "next";

import { productions } from "../lib/productions";

const siteUrl = "https://www.stevegregson.com";

export default function sitemap(): MetadataRoute.Sitemap {
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
      url: `${siteUrl}/production`,
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
      changeFrequency: "yearly" as const,
      priority: 0.8,
    }));

  return [
    ...staticRoutes,
    ...productionRoutes,
  ];
}
