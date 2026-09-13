import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import {
  materializeCuratedImport,
} from "@/lib/curated-archive/staging";

import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FinalSelectionImage = {
  stagedFile?: unknown;
};

type FinalSelection = {
  production?: unknown;
  images?: FinalSelectionImage[];
};

async function findCuratedImage(
  production: string,
  requestedFile: string,
  curationRoot: string,
) {
  const entries =
    await fs.readdir(
      curationRoot,
      {
        withFileTypes: true,
      },
    );

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const directory =
      path.join(
        curationRoot,
        entry.name,
      );

    let finalSelection: FinalSelection;

    try {
      finalSelection =
        JSON.parse(
          await fs.readFile(
            path.join(
              directory,
              "final-selection.json",
            ),
            "utf8",
          ),
        ) as FinalSelection;
    } catch {
      continue;
    }

    if (
      typeof finalSelection.production !==
        "string" ||
      finalSelection.production.trim() !==
        production
    ) {
      continue;
    }

    const allowedFiles =
      new Set(
        (
          Array.isArray(
            finalSelection.images,
          )
            ? finalSelection.images
            : []
        ).flatMap((image) =>
          typeof image.stagedFile ===
          "string"
            ? [image.stagedFile]
            : [],
        ),
      );

    if (
      !allowedFiles.has(
        requestedFile,
      )
    ) {
      return null;
    }

    const stagingRoot =
      path.resolve(
        directory,
        "selected-web-staging",
      );

    const imagePath =
      path.resolve(
        stagingRoot,
        requestedFile,
      );

    if (
      !imagePath.startsWith(
        `${stagingRoot}${path.sep}`,
      )
    ) {
      return null;
    }

    try {
      const stat =
        await fs.stat(imagePath);

      if (!stat.isFile()) {
        return null;
      }
    } catch {
      return null;
    }

    return imagePath;
  }

  return null;
}

export async function GET(
  request: Request,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  const curationRoot =
    await materializeCuratedImport();

  if (!curationRoot) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Choose a curated folder before viewing curated images.",
      },
      { status: 409 },
    );
  }

  const url =
    new URL(request.url);

  const production =
    url.searchParams
      .get("production")
      ?.trim() ?? "";

  const file =
    url.searchParams
      .get("file")
      ?.trim() ?? "";

  if (!production || !file) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Production and image are required.",
      },
      {
        status: 400,
      },
    );
  }

  const imagePath =
    await findCuratedImage(
      production,
      file,
      curationRoot,
    );

  if (!imagePath) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Curated image was not found.",
      },
      {
        status: 404,
      },
    );
  }

  const extension =
    path.extname(
      imagePath,
    ).toLowerCase();

  const contentTypes:
    Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    };

  const contentType =
    contentTypes[extension];

  if (!contentType) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Unsupported curated image type.",
      },
      {
        status: 415,
      },
    );
  }

  const image =
    await fs.readFile(
      imagePath,
    );

  return new Response(image, {
    headers: {
      "Content-Type":
        contentType,
      "Cache-Control":
        "private, no-store",
      "X-Content-Type-Options":
        "nosniff",
    },
  });
}
