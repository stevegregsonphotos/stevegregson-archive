import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  beginCuratedImportFileStaging,
  createCuratedImportUploadUrl,
  deleteCuratedImportArchive,
  finalizeCuratedImportFiles,
  putCuratedImportArchive,
} from "@/lib/curated-archive/staging";

import JSZip from "jszip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_SIZE =
  500 * 1024 * 1024;

function meaningfulFiles(zip: JSZip) {
  return Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) =>
      entry.name.replace(/\\/g, "/"),
    )
    .filter(
      (name) =>
        !name.startsWith("__MACOSX/") &&
        !name
          .split("/")
          .some((part) => part.startsWith(".")),
    );
}

export async function POST(
  request: Request,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  try {
    const url =
      new URL(request.url);

    const directAction =
      url.searchParams
        .get("action")
        ?.trim();

    /*
     * Browser uploads never pass file bodies through
     * Vercel. Vercel performs authentication and signs
     * a short-lived R2 PUT URL only.
     */
    if (directAction === "presign") {
      const relativePath =
        String(
          url.searchParams.get(
            "relativePath",
          ) ?? "",
        )
          .replace(/\\/g, "/")
          .trim();

      const contentType =
        String(
          url.searchParams.get(
            "contentType",
          ) ??
            "application/octet-stream",
        ).trim();

      if (!relativePath) {
        return Response.json(
          {
            ok: false,
            message:
              "A curated file relative path is required.",
          },
          {
            status: 400,
          },
        );
      }

      const authoritativeFile =
        /(^|\/)final-selection\.json$/i.test(
          relativePath,
        ) ||
        /(^|\/)metadata-research\.json$/i.test(
          relativePath,
        ) ||
        /(^|\/)metadata-proposed\.txt$/i.test(
          relativePath,
        ) ||
        /(^|\/)thumbnail-catalogue\.json$/i.test(
          relativePath,
        ) ||
        /(^|\/)selected-web-staging\/[^/]+$/i.test(
          relativePath,
        );

      if (!authoritativeFile) {
        return Response.json(
          {
            ok: false,
            message:
              "That file is not part of the authoritative curated import.",
          },
          {
            status: 400,
          },
        );
      }

      const signed =
        await createCuratedImportUploadUrl(
          relativePath,
          contentType ||
            "application/octet-stream",
        );

      return Response.json({
        ok: true,
        ...signed,
      });
    }

    const formData =
      await request.formData();

    const action =
      String(
        formData.get("action") ?? "",
      ).trim();

    /*
     * Folder-based staging.
     *
     * These actions allow the browser to send only the
     * authoritative curated files directly, without first
     * manufacturing a ZIP archive.
     */
    if (action === "begin") {
      await beginCuratedImportFileStaging();

      return Response.json({
        ok: true,
        message:
          "Curated folder staging started.",
      });
    }

    if (action === "finalize") {
      let relativePaths:
        string[] = [];

      try {
        const parsed =
          JSON.parse(
            String(
              formData.get(
                "relativePaths",
              ) ?? "[]",
            ),
          );

        relativePaths =
          Array.isArray(parsed)
            ? parsed.filter(
                (
                  value,
                ): value is string =>
                  typeof value ===
                  "string" &&
                  Boolean(
                    value.trim(),
                  ),
              )
            : [];
      } catch {
        relativePaths = [];
      }

      const manifest =
        await finalizeCuratedImportFiles(
          relativePaths,
        );

      return Response.json({
        ok: true,
        message:
          "Curated folder staged successfully.",
        stagedFileCount:
          manifest.files.length,
      });
    }

    /*
     * Legacy ZIP staging remains temporarily available
     * until the browser client has been migrated.
     */
    const upload =
      formData.get("curatedArchive");

    if (!(upload instanceof File)) {
      return Response.json(
        {
          ok: false,
          message:
            "Choose a curated folder first.",
        },
        { status: 400 },
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
            "The curated folder package must be a ZIP archive.",
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
            upload.size > MAX_UPLOAD_SIZE
              ? "The curated folder is larger than 500 MB after packaging. Choose a smaller folder."
              : "The selected curated folder is empty.",
        },
        {
          status:
            upload.size > MAX_UPLOAD_SIZE
              ? 413
              : 400,
        },
      );
    }

    const archive = Buffer.from(
      await upload.arrayBuffer(),
    );

    const zip =
      await JSZip.loadAsync(archive);

    const files = meaningfulFiles(zip);

    const finalSelections =
      files.filter((name) =>
        /(^|\/)final-selection\.json$/i.test(
          name,
        ),
      );

    const stagedImages =
      files.filter((name) =>
        /(^|\/)selected-web-staging\/[^/]+$/i.test(
          name,
        ),
      );

    if (finalSelections.length === 0) {
      return Response.json(
        {
          ok: false,
          message:
            "The selected production folder package does not contain final-selection.json.",
        },
        { status: 400 },
      );
    }

    if (stagedImages.length === 0) {
      return Response.json(
        {
          ok: false,
          message:
            "The selected production folder package does not contain any selected-web-staging images.",
        },
        { status: 400 },
      );
    }

    await putCuratedImportArchive(
      archive,
    );

    return Response.json({
      ok: true,
      message:
        "Curated folder staged successfully.",
      archiveName: upload.name,
      productionCount:
        finalSelections.length,
      stagedImageCount:
        stagedImages.length,
    });
  } catch (error) {
    console.error(
      "Curated folder staging failed:",
      error,
    );

    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "The curated folder could not be staged.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  await deleteCuratedImportArchive();

  return Response.json({
    ok: true,
    message:
      "Staged curated folder cleared.",
  });
}
