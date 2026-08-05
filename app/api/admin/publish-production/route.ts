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

import JSZip from "jszip";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_SIZE = 500 * 1024 * 1024;
const MAX_PUBLISHED_IMAGE_WIDTH = 2560;
const PUBLISHED_WEBP_QUALITY = 82;
const BLUR_PLACEHOLDER_WIDTH = 24;

const RESERVED_PRODUCTION_FILES = new Set([
  "generated.ts",
  "index.ts",
  "types.ts",
]);

const ALLOWED_LAYOUTS = new Set([
  "wide",
  "left",
  "right",
  "medium",
  "full",
  "left-small",
  "right-small",
  "wide-left",
  "wide-right",
]);

type PublishCredit = {
  role: string;
  name: string;
  website?: string;
};

type PublishImage = {
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

type PublishedImageAsset = {
  sourceFilepath: string;
  filename: string;
  blurDataURL: string;
};

type PublishPayload = {
  slug: string;
  title: string;
  venue: string;
  month: number;
  year: number;
  description: string;
  hero: {
    filepath: string;
    filename: string;
    alt: string;
  };
  credits: PublishCredit[];
  images: PublishImage[];
};

function exists(targetPath: string) {
  return access(targetPath)
    .then(() => true)
    .catch(() => false);
}

function isSafeSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isSafeArchivePath(value: string) {
  if (
    !value ||
    value.startsWith("/") ||
    value.includes("\0")
  ) {
    return false;
  }

  const normalised = path.posix.normalize(value);

  return (
    normalised === value &&
    !normalised.startsWith("../") &&
    normalised !== ".."
  );
}

function isSafeFilename(value: string) {
  return (
    Boolean(value) &&
    value === path.basename(value) &&
    !value.includes("\0") &&
    value !== "." &&
    value !== ".."
  );
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

function createExportName(slug: string) {
  const parts = slug.split("-");

  return parts
    .map((part, index) =>
      index === 0
        ? part
        : `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join("");
}

function createRegistrySource(slugs: string[]) {
  const registrations = [...new Set(slugs)]
    .filter(isSafeSlug)
    .sort((first, second) =>
      first.localeCompare(second),
    )
    .map((slug) => ({
      slug,
      exportName: createExportName(slug),
    }));

  const imports = registrations.map(
    ({ slug, exportName }) =>
      `import { ${exportName} } from "./${slug}";`,
  );

  const entries = registrations.map(
    ({ exportName }) => `  ${exportName},`,
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

async function getExistingProductionSlugs(
  productionDirectory: string,
) {
  const entries = await readdir(
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

function validatePayload(
  value: unknown,
): value is PublishPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload =
    value as Partial<PublishPayload>;

  if (
    typeof payload.slug !== "string" ||
    !isSafeSlug(payload.slug) ||
    typeof payload.title !== "string" ||
    !payload.title.trim() ||
    typeof payload.venue !== "string" ||
    !payload.venue.trim() ||
    typeof payload.month !== "number" ||
    !Number.isInteger(payload.month) ||
    payload.month < 1 ||
    payload.month > 12 ||
    typeof payload.year !== "number" ||
    !Number.isInteger(payload.year) ||
    payload.year < 1800 ||
    payload.year > 2200 ||
    typeof payload.description !== "string"
  ) {
    return false;
  }

  if (
    !payload.hero ||
    typeof payload.hero.filepath !== "string" ||
    !isSafeArchivePath(
      payload.hero.filepath,
    ) ||
    typeof payload.hero.filename !== "string" ||
    !isSafeFilename(
      payload.hero.filename,
    ) ||
    typeof payload.hero.alt !== "string" ||
    !payload.hero.alt.trim()
  ) {
    return false;
  }

  if (
    !Array.isArray(payload.credits) ||
    payload.credits.some(
      (credit) =>
        !credit ||
        typeof credit.role !== "string" ||
        !credit.role.trim() ||
        typeof credit.name !== "string" ||
        !credit.name.trim() ||
        (credit.website !== undefined &&
          typeof credit.website !== "string"),
    )
  ) {
    return false;
  }

  if (
    !Array.isArray(payload.images) ||
    payload.images.length === 0 ||
    payload.images.some(
      (image) =>
        !image ||
        typeof image.filepath !== "string" ||
        !isSafeArchivePath(
          image.filepath,
        ) ||
        typeof image.filename !== "string" ||
        !isSafeFilename(
          image.filename,
        ) ||
        typeof image.alt !== "string" ||
        !image.alt.trim() ||
        typeof image.layout !== "string" ||
        !ALLOWED_LAYOUTS.has(
          image.layout,
        ),
    )
  ) {
    return false;
  }

  const sourcePaths = [
    payload.hero.filepath,
    ...payload.images.map(
      (image) => image.filepath,
    ),
  ];

  if (
    new Set(sourcePaths).size !==
    sourcePaths.length
  ) {
    return false;
  }

  const filenames = [
    payload.hero.filename,
    ...payload.images.map(
      (image) => image.filename,
    ),
  ];

  return (
    new Set(filenames).size ===
    filenames.length
  );
}function createProductionSource(
  payload: PublishPayload,
  exportName: string,
  heroAsset: PublishedImageAsset,
  galleryAssets: PublishedImageAsset[],
) {
  const galleryAssetByPath = new Map(
    galleryAssets.map((asset) => [
      asset.sourceFilepath,
      asset,
    ]),
  );

  const production = {
    slug: payload.slug,
    title: payload.title.trim(),
    venue: payload.venue.trim(),
    month: payload.month,
    year: payload.year,
    description:
      payload.description.trim(),
    hero: heroAsset.filename,
    heroAlt: payload.hero.alt.trim(),
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

async function publishArchiveImage(
  zip: JSZip,
  sourceFilepath: string,
  outputFilename: string,
  destinationDirectory: string,
): Promise<PublishedImageAsset> {
  const entry = zip.file(sourceFilepath);

  if (!entry) {
    throw new Error(
      `The ZIP no longer contains "${sourceFilepath}".`,
    );
  }

  const sourceBuffer =
    await entry.async("nodebuffer");

  const orientedImage = sharp(
    sourceBuffer,
    {
      failOn: "none",
    },
  ).rotate();

  const publishedBuffer =
    await orientedImage
      .clone()
      .resize({
        width: MAX_PUBLISHED_IMAGE_WIDTH,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: PUBLISHED_WEBP_QUALITY,
        effort: 5,
        smartSubsample: true,
      })
      .toBuffer();

  const blurBuffer =
    await orientedImage
      .clone()
      .resize({
        width: BLUR_PLACEHOLDER_WIDTH,
        fit: "inside",
        withoutEnlargement: true,
      })
      .blur(0.5)
      .webp({
        quality: 38,
        effort: 3,
      })
      .toBuffer();

  await writeFile(
    path.join(
      destinationDirectory,
      outputFilename,
    ),
    publishedBuffer,
  );

  return {
    sourceFilepath,
    filename: outputFilename,
    blurDataURL: `data:image/webp;base64,${blurBuffer.toString(
      "base64",
    )}`,
  };
}

export async function POST(
  request: Request,
) {
  let stagingRoot: string | null =
    null;

  let createdImageDirectory:
    | string
    | null = null;

  let createdProductionFile:
    | string
    | null = null;

  try {
    const formData =
      await request.formData();

    const upload = formData.get(
      "productionArchive",
    );

    const rawPayload = formData.get(
      "productionData",
    );

    if (!(upload instanceof File)) {
      return Response.json(
        {
          ok: false,
          message:
            "The original production ZIP is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !upload.name
        .toLowerCase()
        .endsWith(".zip")
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "The production archive must be a ZIP file.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      upload.size === 0 ||
      upload.size > MAX_UPLOAD_SIZE
    ) {
      return Response.json(
        {
          ok: false,
          message:
            upload.size === 0
              ? "The production ZIP is empty."
              : "The production ZIP is larger than 500 MB.",
        },
        {
          status:
            upload.size === 0
              ? 400
              : 413,
        },
      );
    }

    if (
      typeof rawPayload !== "string"
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "Production publishing data is missing.",
        },
        {
          status: 400,
        },
      );
    }

    let parsedPayload: unknown;

    try {
      parsedPayload =
        JSON.parse(rawPayload);
    } catch {
      return Response.json(
        {
          ok: false,
          message:
            "Production publishing data is not valid JSON.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !validatePayload(
        parsedPayload,
      )
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "Production publishing data is incomplete or invalid.",
        },
        {
          status: 400,
        },
      );
    }

    const payload = parsedPayload;
    const projectRoot = process.cwd();

    const productionDirectory =
      path.join(
        projectRoot,
        "content",
        "productions",
      );

    const productionFile = path.join(
      productionDirectory,
      `${payload.slug}.ts`,
    );

    const generatedRegistryFile =
      path.join(
        productionDirectory,
        "generated.ts",
      );

    const imagesDirectory = path.join(
      projectRoot,
      "public",
      "images",
      "productions",
      payload.slug,
    );

    if (
      await exists(productionFile)
    ) {
      return Response.json(
        {
          ok: false,
          message: `A production file already exists for "${payload.slug}".`,
        },
        {
          status: 409,
        },
      );
    }

    if (
      await exists(imagesDirectory)
    ) {
      return Response.json(
        {
          ok: false,
          message: `An image folder already exists for "${payload.slug}".`,
        },
        {
          status: 409,
        },
      );
    }

    const exportName =
      createExportName(
        payload.slug,
      );

    const archiveBuffer =
      await upload.arrayBuffer();

    const zip =
      await JSZip.loadAsync(
        archiveBuffer,
      );

    const stagingId = randomUUID();

    stagingRoot = path.join(
      projectRoot,
      ".tmp",
      "backstage-publish",
      stagingId,
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

    await mkdir(
      stagedImagesDirectory,
      {
        recursive: true,
      },
    );    const heroAsset =
      await publishArchiveImage(
        zip,
        payload.hero.filepath,
        createWebFilename(
          payload.hero.filename,
          "hero",
        ),
        stagedImagesDirectory,
      );

    const galleryAssets: PublishedImageAsset[] =
      [];

    for (const [index, image] of
      payload.images.entries()) {
      const prefix = String(
        index + 1,
      ).padStart(2, "0");

      galleryAssets.push(
        await publishArchiveImage(
          zip,
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

    await rm(stagingRoot, {
      recursive: true,
      force: true,
    }).catch(() => undefined);

    stagingRoot = null;

    return Response.json({
      ok: true,
      message: `${payload.title} was published and registered automatically.`,
      production: {
        slug: payload.slug,
        title: payload.title.trim(),
        month: payload.month,
        year: payload.year,
        url: `/productions/${payload.slug}`,
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
    });
  } catch (error) {
    console.error(
      "Production publishing failed:",
      error,
    );

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

    if (stagingRoot) {
      await rm(stagingRoot, {
        recursive: true,
        force: true,
      }).catch(() => undefined);
    }

    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "The production could not be published.",
      },
      {
        status: 500,
      },
    );
  }
}