import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  beginCuratedImportFileStaging,
  createCuratedImportUploadUrl,
  deleteCuratedImportArchive,
  finalizeCuratedImportFiles,
} from "@/lib/curated-archive/staging";

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
