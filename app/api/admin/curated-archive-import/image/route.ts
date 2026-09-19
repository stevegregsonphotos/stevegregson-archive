import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import {
  createCuratedImportDownloadUrl,
  findCuratedImportFileBySuffix,
  findCuratedImportStagedImage,
  getCuratedImportDirectFiles,
} from "@/lib/curated-archive/staging";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function imageContentType(
  file: string,
) {
  const extension =
    file
      .split(".")
      .pop()
      ?.toLowerCase();

  const contentTypes:
    Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };

  return extension
    ? contentTypes[extension] ?? null
    : null;
}

export async function GET(
  request: Request,
) {
  if (
    !isBackstageRequestAuthenticated(
      request,
    )
  ) {
    return createUnauthorizedResponse();
  }

  const url =
    new URL(request.url);

  const folder =
    url.searchParams
      .get("folder")
      ?.trim() ?? "";

  const file =
    url.searchParams
      .get("file")
      ?.trim() ?? "";

  if (!folder || !file) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Curated folder and image are required.",
      },
      {
        status: 400,
      },
    );
  }

  const contentType =
    imageContentType(file);

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

  try {
    const directFiles =
      await getCuratedImportDirectFiles();

    if (!directFiles) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "No direct curated upload is available.",
        },
        {
          status: 404,
        },
      );
    }

    const thumbnailRelativePath =
      findCuratedImportFileBySuffix(
        directFiles,
        `${folder}/.editor-thumbnails/${file}.webp`,
      );

    if (thumbnailRelativePath) {
      return NextResponse.redirect(
        await createCuratedImportDownloadUrl(
          thumbnailRelativePath,
          "image/webp",
        ),
        302,
      );
    }

    const stagedRelativePath =
      findCuratedImportStagedImage(
        directFiles,
        folder,
        file,
      );

    if (!stagedRelativePath) {
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

    return NextResponse.redirect(
      await createCuratedImportDownloadUrl(
        stagedRelativePath,
        contentType,
      ),
      302,
    );
  } catch (error) {
    console.error(
      "Curated image direct delivery failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "Curated image could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }
}
