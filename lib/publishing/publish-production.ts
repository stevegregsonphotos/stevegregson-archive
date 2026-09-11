import {
  rememberDirectoryCredits,
} from "@/lib/directory-writer";
import {
  encryptProductionPassword,
} from "@/lib/production-access";
import {
  createProduction,
  productionExists,
} from "@/lib/productions-repository";
import {
  type PublishedImageAsset,
} from "@/lib/publishing/publish-image";
import {
  deleteProductionImage,
  productionImageExists,
  putProductionImage,
} from "@/lib/publishing/production-image-storage";
import {
  type PublishPayload,
} from "@/lib/publishing/production-source";

import path from "node:path";

export type PublishSourceImage = (
  sourceFilepath: string,
  outputFilename: string,
  destinationDirectory: string,
) => Promise<PublishedImageAsset>;

export type PublishProductionResult = {
  directorySync:
    Awaited<ReturnType<typeof rememberDirectoryCredits>> | null;
  directoryWarning: string | null;
  production: {
    slug: string;
    title: string;
    month: number;
    year: number;
    url: string;
    imageCount: number;
    hero: string;
    productionFile: string;
    imageDirectory: string;
    registryFile: string;
    registration: "automatic";
  };
};

export class ProductionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductionConflictError";
  }
}

function createWebFilename(
  filename: string,
  prefix: string,
) {
  const parsed = path.parse(filename);
  const stem = parsed.name
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${prefix}-${stem || "photograph"}.webp`;
}

export async function publishProduction(
  payload: PublishPayload,
  publishSourceImage: PublishSourceImage,
): Promise<PublishProductionResult> {
  if (await productionExists(payload.slug)) {
    throw new ProductionConflictError(
      `A production already exists for "${payload.slug}".`,
    );
  }

  const heroAsset = await publishSourceImage(
    payload.hero.filepath,
    createWebFilename(payload.hero.filename, "hero"),
    "",
  );

  const galleryAssets: PublishedImageAsset[] = [];
  for (const [index, image] of payload.images.entries()) {
    const prefix = String(index + 1).padStart(2, "0");
    galleryAssets.push(
      await publishSourceImage(
        image.filepath,
        createWebFilename(image.filename, prefix),
        "",
      ),
    );
  }

  const assets = [heroAsset, ...galleryAssets];
  for (const asset of assets) {
    if (
      await productionImageExists(
        payload.slug,
        asset.filename,
      )
    ) {
      throw new ProductionConflictError(
        `A production image already exists in R2 for "${payload.slug}/${asset.filename}".`,
      );
    }
  }

  const uploaded: string[] = [];
  try {
    for (const asset of assets) {
      await putProductionImage(
        payload.slug,
        asset.filename,
        asset.buffer,
      );
      uploaded.push(asset.filename);
    }

    const galleryAssetByPath = new Map(
      galleryAssets.map((asset) => [
        asset.sourceFilepath,
        asset,
      ]),
    );

    const access = payload.access ?? "public";
    const defaultLockedPassword =
      process.env.BULK_IMPORT_SCHOOL_DEFAULT_PASSWORD?.trim();

    if (access === "password" && !defaultLockedPassword) {
      throw new Error(
        "BULK_IMPORT_SCHOOL_DEFAULT_PASSWORD is not configured.",
      );
    }

    await createProduction({
      slug: payload.slug,
      title: payload.title.trim(),
      venue: payload.venue.trim(),
      month: payload.month,
      year: payload.year,
      description: payload.description.trim(),
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
      heroAlt: payload.hero.alt.trim(),
      heroBlurDataURL: heroAsset.blurDataURL,
      credits: payload.credits.map((credit) => ({
        role: credit.role.trim(),
        name: credit.name.trim(),
        ...(credit.website?.trim()
          ? { website: credit.website.trim() }
          : {}),
      })),
      images: payload.images.map((image) => {
        const asset = galleryAssetByPath.get(image.filepath);
        if (!asset) {
          throw new Error(
            `No published asset was created for "${image.filepath}".`,
          );
        }
        return {
          src: asset.filename,
          alt: image.alt.trim(),
          layout: image.layout,
          blurDataURL: asset.blurDataURL,
        };
      }),
    });
  } catch (error) {
    for (const filename of uploaded) {
      await deleteProductionImage(
        payload.slug,
        filename,
      ).catch(() => undefined);
    }
    throw error;
  }

  let directorySync:
    Awaited<ReturnType<typeof rememberDirectoryCredits>> | null = null;
  let directoryWarning: string | null = null;

  try {
    directorySync = await rememberDirectoryCredits(
      payload.credits,
    );
  } catch (directoryError) {
    console.error("Directory sync failed:", directoryError);
    directoryWarning =
      directoryError instanceof Error
        ? directoryError.message
        : "The global website directory could not be updated.";
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_PRODUCTION_IMAGE_BASE_URL
      ?.trim()
      .replace(/\/+$/, "") ||
    "https://images.stevegregson.com";

  return {
    directorySync,
    directoryWarning,
    production: {
      slug: payload.slug,
      title: payload.title.trim(),
      month: payload.month,
      year: payload.year,
      url: `/productions/${payload.slug}`,
      imageCount: payload.images.length,
      hero: heroAsset.filename,
      productionFile: "Neon/Postgres",
      imageDirectory: `${baseUrl}/${payload.slug}`,
      registryFile: "Neon/Postgres",
      registration: "automatic",
    },
  };
}
