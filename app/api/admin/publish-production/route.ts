import { randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_SIZE = 500 * 1024 * 1024;

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

type PublishPayload = {
  slug: string;
  title: string;
  venue: string;
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
  if (!value || value.startsWith("/") || value.includes("\0")) {
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validatePayload(
  value: unknown,
): value is PublishPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<PublishPayload>;

  if (
    typeof payload.slug !== "string" ||
    !isSafeSlug(payload.slug) ||
    typeof payload.title !== "string" ||
    !payload.title.trim() ||
    typeof payload.venue !== "string" ||
    !payload.venue.trim() ||
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
    !isSafeArchivePath(payload.hero.filepath) ||
    typeof payload.hero.filename !== "string" ||
    !isSafeFilename(payload.hero.filename) ||
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
        !isSafeArchivePath(image.filepath) ||
        typeof image.filename !== "string" ||
        !isSafeFilename(image.filename) ||
        typeof image.alt !== "string" ||
        !image.alt.trim() ||
        typeof image.layout !== "string" ||
        !ALLOWED_LAYOUTS.has(image.layout),
    )
  ) {
    return false;
  }

  const filenames = [
    payload.hero.filename,
    ...payload.images.map((image) => image.filename),
  ];

  return new Set(filenames).size === filenames.length;
}

function createProductionSource(
  payload: PublishPayload,
  exportName: string,
) {
  const production = {
    slug: payload.slug,
    title: payload.title.trim(),
    venue: payload.venue.trim(),
    year: payload.year,
    description: payload.description.trim(),
    hero: payload.hero.filename,
    heroAlt: payload.hero.alt.trim(),
    credits: payload.credits.map((credit) => ({
      role: credit.role.trim(),
      name: credit.name.trim(),
      ...(credit.website?.trim()
        ? { website: credit.website.trim() }
        : {}),
    })),
    images: payload.images.map((image) => ({
      src: image.filename,
      alt: image.alt.trim(),
      layout: image.layout,
    })),
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

function updateProductionIndex(
  source: string,
  slug: string,
  exportName: string,
) {
  const importLine = `import { ${exportName} } from "./${slug}";`;

  if (
    source.includes(importLine) ||
    new RegExp(
      `from\\s+["']\\./${escapeRegExp(slug)}["']`,
    ).test(source)
  ) {
    throw new Error(
      `The productions index already imports "${slug}".`,
    );
  }

  const imports = [
    ...source.matchAll(
      /^import\s+\{[^}]+\}\s+from\s+["']\.\/[^"']+["'];$/gm,
    ),
  ];

  if (imports.length === 0) {
    throw new Error(
      "Could not locate the production imports in content/productions/index.ts.",
    );
  }

  const finalImport = imports.at(-1);

  if (!finalImport || finalImport.index === undefined) {
    throw new Error(
      "Could not locate the final production import.",
    );
  }

  const importInsertAt =
    finalImport.index + finalImport[0].length;

  let updated =
    source.slice(0, importInsertAt) +
    `\n${importLine}` +
    source.slice(importInsertAt);

  const arrayMatch = updated.match(
    /export const productions:\s*Production\[\]\s*=\s*\[\s*\n/,
  );

  if (!arrayMatch || arrayMatch.index === undefined) {
    throw new Error(
      "Could not locate the productions array in content/productions/index.ts.",
    );
  }

  const arrayInsertAt =
    arrayMatch.index + arrayMatch[0].length;

  updated =
    updated.slice(0, arrayInsertAt) +
    `  ${exportName},\n` +
    updated.slice(arrayInsertAt);

  return updated;
}

async function extractArchiveFile(
  zip: JSZip,
  archivePath: string,
  destinationPath: string,
) {
  const entry = zip.file(archivePath);

  if (!entry) {
    throw new Error(
      `The ZIP no longer contains "${archivePath}".`,
    );
  }

  const buffer = await entry.async("nodebuffer");
  await writeFile(destinationPath, buffer);
}

export async function POST(request: Request) {
  let stagingRoot: string | null = null;
  let createdImageDirectory: string | null = null;
  let createdProductionFile: string | null = null;

  try {
    const formData = await request.formData();
    const upload = formData.get("productionArchive");
    const rawPayload = formData.get("productionData");

    if (!(upload instanceof File)) {
      return Response.json(
        {
          ok: false,
          message:
            "The original production ZIP is required.",
        },
        { status: 400 },
      );
    }

    if (!upload.name.toLowerCase().endsWith(".zip")) {
      return Response.json(
        {
          ok: false,
          message:
            "The production archive must be a ZIP file.",
        },
        { status: 400 },
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
          status: upload.size === 0 ? 400 : 413,
        },
      );
    }

    if (typeof rawPayload !== "string") {
      return Response.json(
        {
          ok: false,
          message:
            "Production publishing data is missing.",
        },
        { status: 400 },
      );
    }

    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(rawPayload);
    } catch {
      return Response.json(
        {
          ok: false,
          message:
            "Production publishing data is not valid JSON.",
        },
        { status: 400 },
      );
    }

    if (!validatePayload(parsedPayload)) {
      return Response.json(
        {
          ok: false,
          message:
            "Production publishing data is incomplete or invalid.",
        },
        { status: 400 },
      );
    }

    const payload = parsedPayload;
    const projectRoot = process.cwd();
    const productionDirectory = path.join(
      projectRoot,
      "content",
      "productions",
    );
    const productionFile = path.join(
      productionDirectory,
      `${payload.slug}.ts`,
    );
    const productionIndexFile = path.join(
      productionDirectory,
      "index.ts",
    );
    const imagesDirectory = path.join(
      projectRoot,
      "public",
      "images",
      "productions",
      payload.slug,
    );

    if (await exists(productionFile)) {
      return Response.json(
        {
          ok: false,
          message: `A production file already exists for "${payload.slug}".`,
        },
        { status: 409 },
      );
    }

    if (await exists(imagesDirectory)) {
      return Response.json(
        {
          ok: false,
          message: `An image folder already exists for "${payload.slug}".`,
        },
        { status: 409 },
      );
    }

    const exportName = createExportName(payload.slug);
    const archiveBuffer = await upload.arrayBuffer();
    const zip = await JSZip.loadAsync(archiveBuffer);

    const stagingId = randomUUID();
    stagingRoot = path.join(
      projectRoot,
      ".tmp",
      "backstage-publish",
      stagingId,
    );

    const stagedImagesDirectory = path.join(
      stagingRoot,
      "images",
    );
    const stagedProductionFile = path.join(
      stagingRoot,
      `${payload.slug}.ts`,
    );

    await mkdir(stagedImagesDirectory, {
      recursive: true,
    });

    const filesToCopy = [
      {
        filepath: payload.hero.filepath,
        filename: payload.hero.filename,
      },
      ...payload.images.map((image) => ({
        filepath: image.filepath,
        filename: image.filename,
      })),
    ];

    for (const file of filesToCopy) {
      await extractArchiveFile(
        zip,
        file.filepath,
        path.join(
          stagedImagesDirectory,
          file.filename,
        ),
      );
    }

    const productionSource = createProductionSource(
      payload,
      exportName,
    );

    await writeFile(
      stagedProductionFile,
      productionSource,
      "utf8",
    );

    const currentIndex = await readFile(
      productionIndexFile,
      "utf8",
    );

    const updatedIndex = updateProductionIndex(
      currentIndex,
      payload.slug,
      exportName,
    );

    await mkdir(path.dirname(imagesDirectory), {
      recursive: true,
    });

    await rename(
      stagedImagesDirectory,
      imagesDirectory,
    );
    createdImageDirectory = imagesDirectory;

    await rename(
      stagedProductionFile,
      productionFile,
    );
    createdProductionFile = productionFile;

    await writeFile(
      productionIndexFile,
      updatedIndex,
      "utf8",
    );

    await rm(stagingRoot, {
      recursive: true,
      force: true,
    });
    stagingRoot = null;

    return Response.json({
      ok: true,
      message: `${payload.title} was published to the local archive.`,
      production: {
        slug: payload.slug,
        title: payload.title,
        url: `/productions/${payload.slug}`,
        imageCount: payload.images.length,
        hero: payload.hero.filename,
        productionFile: `content/productions/${payload.slug}.ts`,
        imageDirectory: `public/images/productions/${payload.slug}`,
      },
    });
  } catch (error) {
    console.error(
      "Production publishing failed:",
      error,
    );

    if (createdProductionFile) {
      await rm(createdProductionFile, {
        force: true,
      }).catch(() => undefined);
    }

    if (createdImageDirectory) {
      await rm(createdImageDirectory, {
        recursive: true,
        force: true,
      }).catch(() => undefined);
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
      { status: 500 },
    );
  }
}