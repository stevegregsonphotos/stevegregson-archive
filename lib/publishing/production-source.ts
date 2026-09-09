import {
  encryptProductionPassword,
} from "@/lib/production-access";

import type {
  PublishedImageAsset,
} from "@/lib/publishing/publish-image";

export type PublishCredit = {
  role: string;
  name: string;
  website?: string;
};

export type PublishImage = {
  filepath: string;
  filename: string;
  alt: string;
  layout:
    | "wide"
    | "left"
    | "right"
    | "medium"
    | "full"
    | "left-small"
    | "right-small"
    | "wide-left"
    | "wide-right";
};

export type PublishPayload = {
  slug: string;
  title: string;
  venue: string;
  month: number;
  year: number;
  description: string;
  access?: "public" | "password";
  hero: {
    filepath: string;
    filename: string;
    alt: string;
  };
  credits: PublishCredit[];
  images: PublishImage[];
};

export function createExportName(
  slug: string,
) {
  const parts = slug.split("-");

  const exportName = parts
    .map((part, index) =>
      index === 0
        ? part
        : `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join("");

  return /^[0-9]/.test(exportName)
    ? `production${exportName.charAt(0).toUpperCase()}${exportName.slice(1)}`
    : exportName;
}

export function createRegistrySource(
  slugs: string[],
) {
  const registrations = [
    ...new Set(slugs),
  ]
    .filter((slug) =>
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
        slug,
      ),
    )
    .sort((first, second) =>
      first.localeCompare(second),
    )
    .map((slug) => ({
      slug,
      exportName:
        createExportName(slug),
    }));

  const imports = registrations.map(
    ({ slug, exportName }) =>
      `import { ${exportName} } from "./${slug}";`,
  );

  const entries = registrations.map(
    ({ exportName }) =>
      `  ${exportName},`,
  );

  return [
    'import type { Production } from "./types";',
    "",
    ...imports,
    "",
    "export const productionEntries: Production[] = [",
    ...entries,
    "];",
    "",
  ].join("\n");
}

export function createProductionSource(
  payload: PublishPayload,
  exportName: string,
  heroAsset: PublishedImageAsset,
  galleryAssets: PublishedImageAsset[],
) {
  const galleryAssetByPath =
    new Map(
      galleryAssets.map((asset) => [
        asset.sourceFilepath,
        asset,
      ]),
    );

  const access =
    payload.access ?? "public";

  const defaultLockedPassword =
    process.env
      .BULK_IMPORT_SCHOOL_DEFAULT_PASSWORD
      ?.trim();

  if (
    access === "password" &&
    !defaultLockedPassword
  ) {
    throw new Error(
      "BULK_IMPORT_SCHOOL_DEFAULT_PASSWORD is not configured.",
    );
  }

  const production = {
    slug: payload.slug,
    title: payload.title.trim(),
    venue: payload.venue.trim(),
    month: payload.month,
    year: payload.year,
    description:
      payload.description.trim(),
    access,
    ...(access === "password"
      ? {
          accessPasswordEncrypted:
            encryptProductionPassword(
              defaultLockedPassword as string,
            ),
        }
      : {}),
    hero: heroAsset.filename,
    heroAlt:
      payload.hero.alt.trim(),
    heroBlurDataURL:
      heroAsset.blurDataURL,
    credits: payload.credits.map(
      (credit) => ({
        role: credit.role.trim(),
        name: credit.name.trim(),
        ...(credit.website?.trim()
          ? {
              website:
                credit.website.trim(),
            }
          : {}),
      }),
    ),
    images: payload.images.map(
      (image) => {
        const asset =
          galleryAssetByPath.get(
            image.filepath,
          );

        if (!asset) {
          throw new Error(
            `No published asset was created for "${image.filepath}".`,
          );
        }

        return {
          src: asset.filename,
          alt: image.alt.trim(),
          layout: image.layout,
          blurDataURL:
            asset.blurDataURL,
        };
      },
    ),
  };

  return [
    'import type { Production } from "./types";',
    "",
    `export const ${exportName}: Production = ${JSON.stringify(
      production,
      null,
      2,
    )};`,
    "",
  ].join("\n");
}
