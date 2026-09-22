import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import {
  createProofingNotesReportDownloadUrl,
  createProofingNotesReportUploadUrl,
} from "@/lib/proofing/image-storage";

import {
  proofingGalleryExists,
} from "@/lib/proofing/repository";

import {
  NextResponse,
} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NotesReportRequest = {
  galleryId?: unknown;
  downloadFilename?: unknown;
};

function cleanString(
  value: unknown,
) {
  return typeof value === "string"
    ? value.trim()
    : "";
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

  let body:
    NotesReportRequest;

  try {
    body =
      (await request.json()) as
        NotesReportRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Invalid PDF download request.",
      },
      {
        status: 400,
      },
    );
  }

  const galleryId =
    cleanString(
      body.galleryId,
    );

  const requestedFilename =
    cleanString(
      body.downloadFilename,
    );

  if (!galleryId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Gallery ID is required.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !(await proofingGalleryExists(
      galleryId,
    ))
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Proofing gallery not found.",
      },
      {
        status: 404,
      },
    );
  }

  const downloadFilename =
    requestedFilename
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      ) ||
    "client-editing-requests.pdf";

  const [
    uploadUrl,
    downloadUrl,
  ] =
    await Promise.all([
      createProofingNotesReportUploadUrl(
        galleryId,
      ),
      createProofingNotesReportDownloadUrl(
        galleryId,
        downloadFilename.endsWith(
          ".pdf",
        )
          ? downloadFilename
          : `${downloadFilename}.pdf`,
      ),
    ]);

  return NextResponse.json({
    ok: true,
    uploadUrl,
    downloadUrl,
  });
}
