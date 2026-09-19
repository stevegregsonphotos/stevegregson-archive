import { cookies } from "next/headers";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getProofingGalleryBySlug,
} from "../../../../lib/proofing/repository";
import {
  createProofingImageDownloadUrl,
} from "../../../../lib/proofing/image-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isSafeSegment(value: string) {
  return (
    value.length > 0 &&
    !value.includes("/") &&
    !value.includes("\\") &&
    value !== "." &&
    value !== ".."
  );
}

export async function GET(
  request: NextRequest,
) {
  const gallerySlug =
    request.nextUrl.searchParams
      .get("gallery")
      ?.trim() ?? "";

  const imageId =
    request.nextUrl.searchParams
      .get("image")
      ?.trim() ?? "";

  if (
    !isSafeSegment(gallerySlug) ||
    !isSafeSegment(imageId)
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid image request.",
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
    hasExpiredByDate
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "This gallery is not available.",
      },
      { status: 403 },
    );
  }

  const cookieStore = await cookies();
  const visitorId =
    cookieStore.get(
      `proofing_${gallery.id}`,
    )?.value;

  const visitor = visitorId
    ? gallery.visitors?.find(
        (candidate) =>
          candidate.id === visitorId,
      )
    : undefined;

  const isPublicCover =
    gallery.coverImageId === imageId;

  if (!visitor && !isPublicCover) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Please enter the gallery to view this photograph.",
      },
      { status: 401 },
    );
  }

  const image =
    gallery.images.find(
      (candidate) =>
        candidate.id === imageId,
    );

  if (!image) {
    return NextResponse.json(
      {
        ok: false,
        message: "Image not found.",
      },
      { status: 404 },
    );
  }

  if (!isSafeSegment(image.webFilename)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Invalid image filename.",
      },
      { status: 400 },
    );
  }

  try {
    /*
     * Vercel performs only the gallery/session check.
     * The photograph bytes move directly from R2 to the
     * browser. Watermarks are a presentation overlay in
     * the proofing UI, so image delivery never invokes
     * Sharp or proxies image bodies through Vercel.
     */
    return NextResponse.redirect(
      await createProofingImageDownloadUrl(
        gallery.id,
        image.webFilename,
      ),
      302,
    );
  } catch (error) {
    console.error(
      "Proofing image delivery failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "Image file could not be read.",
      },
      { status: 404 },
    );
  }
}
