import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getProofingGalleryBySlug,
} from "../../../../lib/proofing/repository";
import {
  getProofingWatermark,
} from "../../../../lib/proofing/watermarks";
import {
  createProofingWatermarkDownloadUrl,
} from "../../../../lib/proofing/watermark-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  const gallerySlug =
    request.nextUrl.searchParams
      .get("gallery")
      ?.trim() ?? "";

  if (!gallerySlug) {
    return NextResponse.json(
      {
        ok: false,
        message: "Gallery is required.",
      },
      { status: 400 },
    );
  }

  const gallery =
    await getProofingGalleryBySlug(
      gallerySlug,
    );

  if (!gallery) {
    return NextResponse.json(
      {
        ok: false,
        message: "Gallery not found.",
      },
      { status: 404 },
    );
  }

  const hasExpiredByDate =
    Boolean(gallery.expiresAt) &&
    new Date(
      gallery.expiresAt as string,
    ).getTime() < Date.now();

  if (
    gallery.status !== "live" ||
    hasExpiredByDate ||
    !gallery.watermarkEnabled ||
    !gallery.watermarkId
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Watermark is not available.",
      },
      { status: 404 },
    );
  }

  const watermark =
    await getProofingWatermark(
      gallery.watermarkId,
    );

  if (!watermark) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Watermark is not available.",
      },
      { status: 404 },
    );
  }

  return NextResponse.redirect(
    await createProofingWatermarkDownloadUrl(
      watermark.filename,
    ),
    302,
  );
}
