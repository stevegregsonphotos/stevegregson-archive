import { cookies } from "next/headers";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getProofingImageAccess,
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

  /*
   * Light check: only the few fields needed, never the gallery's whole
   * visitor list (which grows with every visitor and is read for every
   * thumbnail). The browser's proofing_* cookies hold visitor codes; a
   * code only counts if it belongs to this gallery.
   */
  const cookieStore = await cookies();
  const visitorIds = cookieStore
    .getAll()
    .filter((cookie) => cookie.name.startsWith("proofing_"))
    .map((cookie) => cookie.value);

  const access =
    await getProofingImageAccess(
      gallerySlug,
      imageId,
      visitorIds,
    );

  if (!access) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Gallery or image not found.",
      },
      { status: 404 },
    );
  }

  const hasExpiredByDate =
    Boolean(access.expiresAt) &&
    new Date(
      access.expiresAt as string,
    ).getTime() < Date.now();

  if (
    access.status !== "live" ||
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

  const isPublicCover =
    access.coverImageId === imageId;

  if (!access.isVisitor && !isPublicCover) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Please enter the gallery to view this photograph.",
      },
      { status: 401 },
    );
  }

  const gallery = { id: access.galleryId };
  const image = { webFilename: access.webFilename };

  try {
    /*
     * Vercel performs only the gallery/session check.
     * The photograph bytes move directly from R2 to the
     * browser. Watermarks are a presentation overlay in
     * the proofing UI, so image delivery never invokes
     * Sharp or proxies image bodies through Vercel.
     */
    const response = NextResponse.redirect(
      await createProofingImageDownloadUrl(
        gallery.id,
        image.webFilename,
      ),
      302,
    );
    // The link is valid for 15 minutes; let this visitor's browser reuse it
    // for 10, so scrolling back through the gallery doesn't ask again.
    response.headers.set(
      "Cache-Control",
      "private, max-age=600",
    );
    return response;
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
