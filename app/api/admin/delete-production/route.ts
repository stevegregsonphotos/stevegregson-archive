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

import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "../../../../lib/backstage-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESERVED_PRODUCTION_FILES = new Set([
  "generated.ts",
  "index.ts",
  "types.ts",
]);

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

function createExportName(slug: string) {
  return slug
    .split("-")
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

async function getProductionSlugs(
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

export async function POST(
  request: Request,
) {
  if (
    !isBackstageRequestAuthenticated(
      request,
    )
  ) {
    return createUnauthorizedResponse();
  }

  let stagingRoot: string | null =
    null;

  let stagedProductionFile:
    | string
    | null = null;

  let stagedImageDirectory:
    | string
    | null = null;

  let productionFile = "";
  let imageDirectory = "";

  try {
    const body =
      (await request.json()) as DeleteRequest;

    if (
      typeof body.slug !== "string" ||
      !isSafeSlug(body.slug)
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "A valid production slug is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      body.confirmation !== "DELETE"
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "Type DELETE to confirm permanent deletion.",
        },
        {
          status: 400,
        },
      );
    }

    const slug = body.slug;
    const projectRoot = process.cwd();

    const productionDirectory =
      path.join(
        projectRoot,
        "content",
        "productions",
      );

    productionFile = path.join(
      productionDirectory,
      `${slug}.ts`,
    );

    const generatedRegistryFile =
      path.join(
        productionDirectory,
        "generated.ts",
      );

    imageDirectory = path.join(
      projectRoot,
      "public",
      "images",
      "productions",
      slug,
    );

    if (
      !(await exists(productionFile))
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "That production no longer exists.",
        },
        {
          status: 404,
        },
      );
    }

    const existingSlugs =
      await getProductionSlugs(
        productionDirectory,
      );

    const remainingSlugs =
      existingSlugs.filter(
        (existingSlug) =>
          existingSlug !== slug,
      );

    if (
      remainingSlugs.length ===
      existingSlugs.length
    ) {
      throw new Error(
        "The production could not be found in the generated registry.",
      );
    }

    const updatedRegistry =
      createRegistrySource(
        remainingSlugs,
      );

    stagingRoot = path.join(
      projectRoot,
      ".tmp",
      "backstage-delete",
      randomUUID(),
    );

    await mkdir(stagingRoot, {
      recursive: true,
    });

    stagedProductionFile =
      path.join(
        stagingRoot,
        `${slug}.ts`,
      );

    await rename(
      productionFile,
      stagedProductionFile,
    );

    if (
      await exists(imageDirectory)
    ) {
      stagedImageDirectory =
        path.join(
          stagingRoot,
          "images",
        );

      await rename(
        imageDirectory,
        stagedImageDirectory,
      );
    }

    await writeFile(
      generatedRegistryFile,
      updatedRegistry,
      "utf8",
    );

    await rm(stagingRoot, {
      recursive: true,
      force: true,
    });

    stagingRoot = null;
    stagedProductionFile = null;
    stagedImageDirectory = null;

    return Response.json({
      ok: true,
      message:
        "Production deleted permanently.",
      redirectTo:
        "/admin/productions",
    });
  } catch (error) {
    console.error(
      "Production deletion failed:",
      error,
    );

    if (
      stagedProductionFile &&
      productionFile &&
      (await exists(
        stagedProductionFile,
      ))
    ) {
      await rename(
        stagedProductionFile,
        productionFile,
      ).catch(() => undefined);
    }

    if (
      stagedImageDirectory &&
      imageDirectory &&
      (await exists(
        stagedImageDirectory,
      ))
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

    /*
     * Rebuild the registry from whatever production
     * files currently exist after rollback.
     */
    try {
      const projectRoot =
        process.cwd();

      const productionDirectory =
        path.join(
          projectRoot,
          "content",
          "productions",
        );

      const generatedRegistryFile =
        path.join(
          productionDirectory,
          "generated.ts",
        );

      const currentSlugs =
        await getProductionSlugs(
          productionDirectory,
        );

      await writeFile(
        generatedRegistryFile,
        createRegistrySource(
          currentSlugs,
        ),
        "utf8",
      );
    } catch (registryError) {
      console.error(
        "Production registry recovery failed:",
        registryError,
      );
    }

    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "The production could not be deleted.",
      },
      {
        status: 500,
      },
    );
  }
}