import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import {
  getProofingNotesReport,
} from "@/lib/proofing/image-storage";

import {
  proofingGalleryExists,
} from "@/lib/proofing/repository";

import {
  NextRequest,
  NextResponse,
} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFilename(
  value: string,
) {
  const clean =
    value
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      );

  const filename =
    clean ||
    "client-editing-requests.pdf";

  return filename
    .toLowerCase()
    .endsWith(".pdf")
      ? filename
      : `${filename}.pdf`;
}

export async function GET(
  request: NextRequest,
) {
  if (
    !isBackstageRequestAuthenticated(
      request,
    )
  ) {
    return createUnauthorizedResponse();
  }

  const galleryId =
    request.nextUrl.searchParams
      .get("galleryId")
      ?.trim() ?? "";

  const filename =
    safeFilename(
      request.nextUrl.searchParams
        .get("filename")
        ?.trim() ?? "",
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

  try {
    const bytes =
      await getProofingNotesReport(
        galleryId,
      );

    const body =
      Uint8Array.from(
        bytes,
      ).buffer;

    return new NextResponse(
      body,
      {
        status: 200,
        headers: {
          /*
           * Safari has repeatedly stalled when this
           * attachment is advertised as application/pdf.
           * Send the exact PDF bytes as a generic binary
           * attachment while retaining the .pdf filename.
           */
          "Content-Type":
            "application/octet-stream",
          "Content-Disposition":
            `attachment; filename="${filename}"`,
          "Content-Length":
            String(bytes.byteLength),
          "Cache-Control":
            "private, no-store",
          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The PDF report could not be downloaded.",
      },
      {
        status: 404,
      },
    );
  }
}
