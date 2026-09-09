import {
  rememberDirectoryCredits,
} from "@/lib/directory-writer";
import {
  type PublishedImageAsset,
} from "@/lib/publishing/publish-image";
import {
  deleteProductionImage,
  productionImageExists,
  putProductionImage,
} from "@/lib/publishing/production-image-storage";
import {
  createExportName,
  createProductionSource,
  createRegistrySource,
  type PublishPayload,
} from "@/lib/publishing/production-source";

import { randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const RESERVED_PRODUCTION_FILES =
  new Set([
    "generated.ts",
    "index.ts",
    "types.ts",
  ]);

export type PublishSourceImage =
  (
    sourceFilepath: string,
    outputFilename: string,
    destinationDirectory: string,
  ) => Promise<PublishedImageAsset>;

export type PublishProductionResult = {
  directorySync:
    Awaited<
      ReturnType<
        typeof rememberDirectoryCredits
      >
    > | null;
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

export class ProductionConflictError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "ProductionConflictError";
  }
}

function exists(targetPath: string) {
  return access(targetPath)
    .then(() => true)
    .catch(() => false);
}

function isSafeSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
    value,
  );
}

function createWebFilename(
  filename: string,
  prefix: string,
) {
  const parsed =
    path.parse(filename);

  const stem = parsed.name
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${prefix}-${stem || "photograph"}.webp`;
}

async function getExistingProductionSlugs(
  productionDirectory: string,
) {
  const entries =
    await readdir(
      productionDirectory,
      {
        withFileTypes: true,
      },
    );

  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !RESERVED_PRODUCTION_FILES.has(
          entry.name,
        ),
    )
    .map((entry) =>
      entry.name.slice(0, -3),
    )
    .filter(isSafeSlug);
}

export async function publishProduction(
  payload: PublishPayload,
  publishSourceImage:
    PublishSourceImage,
): Promise<PublishProductionResult> {
  const projectRoot =
    process.cwd();

  const productionDirectory =
    path.join(
      projectRoot,
      "content",
      "productions",
    );

  const productionFile =
    path.join(
      productionDirectory,
      `${payload.slug}.ts`,
    );

  const generatedRegistryFile =
    path.join(
      productionDirectory,
      "generated.ts",
    );

  if (
    await exists(productionFile)
  ) {
    throw new ProductionConflictError(
      `A production file already exists for "${payload.slug}".`,
    );
  }

  const exportName =
    createExportName(
      payload.slug,
    );

  const stagingRoot =
    path.join(
      projectRoot,
      ".tmp",
      "backstage-publish",
      randomUUID(),
    );

  const stagedImagesDirectory =
    path.join(
      stagingRoot,
      "images",
    );

  const stagedProductionFile =
    path.join(
      stagingRoot,
      `${payload.slug}.ts`,
    );

  const stagedRegistryFile =
    path.join(
      stagingRoot,
      "generated.ts",
    );

  const uploadedImageFilenames:
    string[] = [];

  let createdProductionFile:
    | string
    | null = null;

  try {
    await mkdir(
      stagedImagesDirectory,
      {
        recursive: true,
      },
    );

    const heroAsset =
      await publishSourceImage(
        payload.hero.filepath,
        createWebFilename(
          payload.hero.filename,
          "hero",
        ),
        stagedImagesDirectory,
      );

    const galleryAssets:
      PublishedImageAsset[] = [];

    for (const [index, image] of
      payload.images.entries()) {
      const prefix =
        String(index + 1).padStart(
          2,
          "0",
        );

      galleryAssets.push(
        await publishSourceImage(
          image.filepath,
          createWebFilename(
            image.filename,
            prefix,
          ),
          stagedImagesDirectory,
        ),
      );
    }

    const productionSource =
      createProductionSource(
        payload,
        exportName,
        heroAsset,
        galleryAssets,
      );

    await writeFile(
      stagedProductionFile,
      productionSource,
      "utf8",
    );

    await mkdir(
      productionDirectory,
      {
        recursive: true,
      },
    );

    const existingSlugs =
      await getExistingProductionSlugs(
        productionDirectory,
      );

    const registrySource =
      createRegistrySource([
        ...existingSlugs,
        payload.slug,
      ]);

    await writeFile(
      stagedRegistryFile,
      registrySource,
      "utf8",
    );

    const publishedAssets = [
      heroAsset,
      ...galleryAssets,
    ];

    for (const asset of publishedAssets) {
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

    for (const asset of publishedAssets) {
      const stagedImagePath =
        path.join(
          stagedImagesDirectory,
          asset.filename,
        );

      const imageBuffer =
        await readFile(
          stagedImagePath,
        );

      await putProductionImage(
        payload.slug,
        asset.filename,
        imageBuffer,
      );

      uploadedImageFilenames.push(
        asset.filename,
      );
    }

    await rename(
      stagedProductionFile,
      productionFile,
    );

    createdProductionFile =
      productionFile;

    await rename(
      stagedRegistryFile,
      generatedRegistryFile,
    );

    await rm(
      stagingRoot,
      {
        recursive: true,
        force: true,
      },
    ).catch(() => undefined);

    let directorySync:
      Awaited<
        ReturnType<
          typeof rememberDirectoryCredits
        >
      > | null = null;

    let directoryWarning:
      string | null = null;

    try {
      directorySync =
        await rememberDirectoryCredits(
          payload.credits,
        );
    } catch (directoryError) {
      console.error(
        "Directory sync failed:",
        directoryError,
      );

      directoryWarning =
        directoryError instanceof Error
          ? directoryError.message
          : "The global website directory could not be updated.";
    }

    return {
      directorySync,
      directoryWarning,
      production: {
        slug: payload.slug,
        title:
          payload.title.trim(),
        month: payload.month,
        year: payload.year,
        url:
          `/productions/${payload.slug}`,
        imageCount:
          payload.images.length,
        hero:
          heroAsset.filename,
        productionFile:
          `content/productions/${payload.slug}.ts`,
        imageDirectory:
          `${process.env.NEXT_PUBLIC_PRODUCTION_IMAGE_BASE_URL?.replace(
            /\/$/,
            "",
          )}/${payload.slug}`,
        registryFile:
          "content/productions/generated.ts",
        registration:
          "automatic",
      },
    };
  } catch (error) {
    if (createdProductionFile) {
      await rm(
        createdProductionFile,
        {
          force: true,
        },
      ).catch(() => undefined);
    }

    for (
      const filename of
        uploadedImageFilenames
    ) {
      await deleteProductionImage(
        payload.slug,
        filename,
      ).catch(() => undefined);
    }

    await rm(
      stagingRoot,
      {
        recursive: true,
        force: true,
      },
    ).catch(() => undefined);

    throw error;
  }
}
