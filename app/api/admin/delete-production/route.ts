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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeleteRequest = {
  slug?: unknown;
  confirmation?: unknown;
};

function isSafeSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function exists(targetPath: string) {
  return access(targetPath)
    .then(() => true)
    .catch(() => false);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeProductionFromIndex(
  source: string,
  slug: string,
  exportName: string,
) {
  const escapedSlug = escapeRegExp(slug);
  const escapedExportName = escapeRegExp(exportName);

  const importPattern = new RegExp(
    `^import\\s+\\{\\s*${escapedExportName}\\s*\\}\\s+from\\s+["']\\./${escapedSlug}["'];?\\s*\\n?`,
    "m",
  );
  const arrayEntryPattern = new RegExp(
    `^\\s*${escapedExportName},\\s*\\n`,
    "m",
  );

  const withoutImport = source.replace(importPattern, "");
  const updated = withoutImport.replace(arrayEntryPattern, "");

  if (withoutImport === source || updated === withoutImport) {
    throw new Error(
      "The production could not be removed from the production index.",
    );
  }

  return updated;
}

export async function POST(request: Request) {
  let stagingRoot: string | null = null;
  let stagedProductionFile: string | null = null;
  let stagedImageDirectory: string | null = null;
  let indexUpdated = false;
  let currentIndex = "";
  let productionFile = "";
  let imageDirectory = "";
  let productionIndexFile = "";

  try {
    const body = (await request.json()) as DeleteRequest;

    if (
      typeof body.slug !== "string" ||
      !isSafeSlug(body.slug)
    ) {
      return Response.json(
        {
          ok: false,
          message: "A valid production slug is required.",
        },
        { status: 400 },
      );
    }

    if (body.confirmation !== "DELETE") {
      return Response.json(
        {
          ok: false,
          message: "Type DELETE to confirm permanent deletion.",
        },
        { status: 400 },
      );
    }

    const projectRoot = process.cwd();
    const productionDirectory = path.join(
      projectRoot,
      "content",
      "productions",
    );

    productionFile = path.join(
      productionDirectory,
      `${body.slug}.ts`,
    );
    productionIndexFile = path.join(
      productionDirectory,
      "index.ts",
    );
    imageDirectory = path.join(
      projectRoot,
      "public",
      "images",
      "productions",
      body.slug,
    );

    if (!(await exists(productionFile))) {
      return Response.json(
        {
          ok: false,
          message: "That production no longer exists.",
        },
        { status: 404 },
      );
    }

    const productionSource = await readFile(
      productionFile,
      "utf8",
    );
    const exportMatch = productionSource.match(
      /export const\s+([A-Za-z0-9_]+)\s*:/,
    );

    if (!exportMatch) {
      throw new Error(
        "The production export name could not be found.",
      );
    }

    currentIndex = await readFile(
      productionIndexFile,
      "utf8",
    );
    const updatedIndex = removeProductionFromIndex(
      currentIndex,
      body.slug,
      exportMatch[1],
    );

    stagingRoot = path.join(
      projectRoot,
      ".tmp",
      "backstage-delete",
      randomUUID(),
    );
    await mkdir(stagingRoot, { recursive: true });

    stagedProductionFile = path.join(
      stagingRoot,
      `${body.slug}.ts`,
    );
    await rename(productionFile, stagedProductionFile);

    if (await exists(imageDirectory)) {
      stagedImageDirectory = path.join(
        stagingRoot,
        "images",
      );
      await rename(imageDirectory, stagedImageDirectory);
    }

    await writeFile(
      productionIndexFile,
      updatedIndex,
      "utf8",
    );
    indexUpdated = true;

    await rm(stagingRoot, {
      recursive: true,
      force: true,
    });
    stagingRoot = null;
    stagedProductionFile = null;
    stagedImageDirectory = null;

    return Response.json({
      ok: true,
      message: "Production deleted permanently.",
      redirectTo: "/archive",
    });
  } catch (error) {
    console.error("Production deletion failed:", error);

    if (indexUpdated && currentIndex && productionIndexFile) {
      await writeFile(
        productionIndexFile,
        currentIndex,
        "utf8",
      ).catch(() => undefined);
    }

    if (
      stagedProductionFile &&
      productionFile &&
      (await exists(stagedProductionFile))
    ) {
      await rename(
        stagedProductionFile,
        productionFile,
      ).catch(() => undefined);
    }

    if (
      stagedImageDirectory &&
      imageDirectory &&
      (await exists(stagedImageDirectory))
    ) {
      await rename(
        stagedImageDirectory,
        imageDirectory,
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
            : "The production could not be deleted.",
      },
      { status: 500 },
    );
  }
}
