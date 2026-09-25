import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  beginCuratedImportFileStaging,
  createCuratedImportPreflightIndexDownloadUrl,
  createCuratedImportPreflightIndexUploadUrl,
  createCuratedImportUploadUrl,
  deleteCuratedImportArchive,
  deleteCuratedImportFolder,
  finalizeCuratedImportFiles,
} from "@/lib/curated-archive/staging";
import {
  setCuratedArchiveAccessOverride,
  setCuratedArchiveExclusionOverride,
  setCuratedArchiveOverride,
} from "@/lib/curated-archive-overrides-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
     * short-lived R2 URLs only.
     */
    if (directAction === "preflight-index-upload") {
      return Response.json({
        ok: true,
        url:
          await createCuratedImportPreflightIndexUploadUrl(),
      });
    }

    if (directAction === "preflight-index-read") {
      return Response.json({
        ok: true,
        url:
          await createCuratedImportPreflightIndexDownloadUrl(),
      });
    }

    if (
      directAction === "include" ||
      directAction === "exclude" ||
      directAction === "delete-folder"
    ) {
      let body: {
        production?: unknown;
        folder?: unknown;
      };

      try {
        body =
          (await request.json()) as typeof body;
      } catch {
        return Response.json(
          {
            ok: false,
            message:
              "Invalid request.",
          },
          {
            status: 400,
          },
        );
      }

      const production =
        typeof body.production === "string"
          ? body.production.trim()
          : "";

      const folder =
        typeof body.folder === "string"
          ? body.folder.trim()
          : "";

      if (!production) {
        return Response.json(
          {
            ok: false,
            message:
              "Production is required.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        directAction === "include" ||
        directAction === "exclude"
      ) {
        await setCuratedArchiveExclusionOverride(
          production,
          directAction === "exclude",
        );

        return Response.json({
          ok: true,
          production,
          excluded:
            directAction === "exclude",
        });
      }

      if (!folder) {
        return Response.json(
          {
            ok: false,
            message:
              "Curated folder is required.",
          },
          {
            status: 400,
          },
        );
      }

      const deleted =
        await deleteCuratedImportFolder(
          folder,
        );

      await setCuratedArchiveOverride(
        production,
        null,
      );

      await setCuratedArchiveAccessOverride(
        production,
        null,
      );

      return Response.json({
        ok: true,
        production,
        ...deleted,
      });
    }

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
        ) ||
        /(^|\/)\.editor-thumbnails\/[^/]+\.webp$/i.test(
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

      const mode =
        String(
          formData.get("mode") ??
            "additive",
        ).trim() === "replace"
          ? "replace"
          : "additive";

      const expectedFinalSelectionCount =
        Number.parseInt(
          String(
            formData.get(
              "expectedFinalSelectionCount",
            ) ?? "",
          ),
          10,
        );

      const actualFinalSelectionCount =
        relativePaths.filter(
          (relativePath) =>
            /(^|\/)final-selection\.json$/i.test(
              relativePath,
            ),
        ).length;

      if (
        Number.isInteger(
          expectedFinalSelectionCount,
        ) &&
        expectedFinalSelectionCount >= 0 &&
        actualFinalSelectionCount !==
          expectedFinalSelectionCount
      ) {
        throw new Error(
          `Curated collection count mismatch before finalization: expected ${expectedFinalSelectionCount} final selections but received ${actualFinalSelectionCount}.`,
        );
      }

      const manifest =
        await finalizeCuratedImportFiles(
          relativePaths,
          mode,
        );

      return Response.json({
        ok: true,
        message:
          "Curated folder staged successfully.",
        stagedFileCount:
          manifest.files.length,
        finalSelectionCount:
          manifest.files.filter(
            (relativePath) =>
              /(^|\/)final-selection\.json$/i.test(
                relativePath,
              ),
          ).length,
      });
    }

    /*
     * Large curated ZIP bodies are deliberately forbidden in
     * production architecture. Authoritative files must use
     * the presigned browser -> R2 flow above.
     */
    return Response.json(
      {
        ok: false,
        message:
          "Legacy ZIP staging is disabled. Upload curated files directly to R2.",
      },
      { status: 410 },
    );
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
