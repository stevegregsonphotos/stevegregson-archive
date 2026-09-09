import {
  rememberDirectoryCredits,
} from "@/lib/directory-writer";
import {
  type PublishedImageAsset,
} from "@/lib/publishing/publish-image";
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

  const imagesDirectory =
    path.join(
      projectRoot,
      "public",
      "images",
      "productions",
      payload.slug,
    );

  if (
    await exists(productionFile)
  ) {
    throw new ProductionConflictError(
      `A production file already exists for "${payload.slug}".`,
    );
  }

  if (
    await exists(imagesDirectory)
  ) {
    throw new ProductionConflictError(
      `An image folder already exists for "${payload.slug}".`,
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

  let createdImageDirectory:
    | string
    | null = null;

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

    await mkdir(
      path.dirname(
        imagesDirectory,
      ),
      {
        recursive: true,
      },
    );

    await rename(
      stagedImagesDirectory,
      imagesDirectory,
    );

    createdImageDirectory =
      imagesDirectory;

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
          `public/images/productions/${payload.slug}`,
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

    if (createdImageDirectory) {
      await rm(
        createdImageDirectory,
        {
          recursive: true,
          force: true,
        },
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
