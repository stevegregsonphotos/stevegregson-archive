import sharp from "sharp";
import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import {
  findCuratedImportStagedImage,
  getCuratedImportDirectFiles,
  materializeCuratedImport,
  readCuratedImportDirectFile,
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

type CuratedImageLocation = {
  imagePath: string | null;
  stagedRelativePath: string | null;
};

async function findCuratedImage(
  production: string,
  requestedFolder: string,
  requestedFile: string,
  curationRoot: string,
  directFiles: string[] | null,
): Promise<CuratedImageLocation | null> {
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

    if (requestedFolder && entry.name !== requestedFolder) {
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
      (production &&
        finalSelection.production.trim() !==
          production)
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

    if (directFiles) {
      const stagedRelativePath =
        findCuratedImportStagedImage(
          directFiles,
          entry.name,
          requestedFile,
        );

      if (!stagedRelativePath) {
        return null;
      }

      return {
        imagePath: null,
        stagedRelativePath,
      };
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

    return {
      imagePath,
      stagedRelativePath: null,
    };
  }

  return null;
}

function imageContentType(file: string) {
  const extension = path.extname(file).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };
  return contentTypes[extension] ?? null;
}

export async function GET(
  request: Request,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  const url = new URL(request.url);
  const production =
    url.searchParams.get("production")?.trim() ?? "";
  const folder =
    url.searchParams.get("folder")?.trim() ?? "";
  const file =
    url.searchParams.get("file")?.trim() ?? "";

  if ((!production && !folder) || !file) {
    return NextResponse.json(
      {
        ok: false,
        message: "Curated folder (or production) and image are required.",
      },
      { status: 400 },
    );
  }

  const contentType = imageContentType(file);

  if (!contentType) {
    return NextResponse.json(
      { ok: false, message: "Unsupported curated image type." },
      { status: 415 },
    );
  }

  /*
   * Uploaded curator packages already live in R2.  Serve editor thumbnails
   * straight from that manifest instead of rematerialising the whole archive
   * for every <img> request.  Folder identity also removes ambiguity when
   * two curator folders have the same production title.
   */
  if (folder) {
    const stagedRelativePath =
      `${folder}/selected-web-staging/${file}`;

    try {
      const sourceImage =
        await readCuratedImportDirectFile(
          stagedRelativePath,
        );

      const image =
        await sharp(sourceImage, {
          failOn: "none",
        })
          .rotate()
          .resize({
            width: 800,
            height: 800,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({
            quality: 78,
          })
          .toBuffer();

      return new Response(
        new Uint8Array(image),
        {
          headers: {
            "Content-Type": "image/webp",
          "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    } catch {
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
  }

  const curationRoot = await materializeCuratedImport();

  if (!curationRoot) {
    return NextResponse.json(
      {
        ok: false,
        message: "Choose a curated folder before viewing curated images.",
      },
      { status: 409 },
    );
  }

  const directFiles = await getCuratedImportDirectFiles();
  const location = await findCuratedImage(
    production,
    folder,
    file,
    curationRoot,
    directFiles,
  );

  if (!location) {
    return NextResponse.json(
      { ok: false, message: "Curated image was not found." },
      { status: 404 },
    );
  }

  const image = location.stagedRelativePath
    ? await readCuratedImportDirectFile(location.stagedRelativePath)
    : await fs.readFile(location.imagePath as string);

  return new Response(image, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
