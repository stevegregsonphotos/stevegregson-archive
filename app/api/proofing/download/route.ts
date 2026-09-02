import fs from "node:fs/promises";
import path from "node:path";

import { cookies } from "next/headers";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getProofingGalleryBySlug,
} from "../../../../lib/proofing/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const proofingImagesDirectory = path.join(
  process.cwd(),
  "data",
  "proofing-images",
);

function isSafeSegment(value: string) {
  return (
    value.length > 0 &&
    !value.includes("/") &&
    !value.includes("\\") &&
    value !== "." &&
    value !== ".."
  );
}

function downloadFilename(
  originalFilename: string,
) {
  const base =
    originalFilename.replace(/\.[^.]+$/, "") ||
    "photograph";

  const safeBase = base
    .replace(/[\r\n"]/g, "")
    .trim();

  return `${safeBase || "photograph"}.webp`;
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
        message: "Invalid download request.",
      },
      { status: 400 },
    );
  }

  const gallery =
    getProofingGalleryBySlug(gallerySlug);

  if (!gallery) {
    return NextResponse.json(
      {
        ok: false,
        message: "Gallery not found.",
      },
      { status: 404 },
    );
  }

  /*
   * Downloads must not bypass gallery
   * availability rules.
   */
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
          "This gallery is not available for downloads.",
      },
      { status: 403 },
    );
  }

  /*
   * No-download galleries are rejected at
   * the server even if somebody constructs
   * the URL manually.
   */
  if (gallery.downloadPermission === "none") {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Downloads are not enabled for this gallery.",
      },
      { status: 403 },
    );
  }

  const cookieStore = await cookies();

  const expectedCookieName =
    `proofing_${gallery.id}`;

  const visitorId =
    cookieStore.get(
      expectedCookieName,
    )?.value;


  if (!visitorId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Please enter the gallery before downloading photographs.",
      },
      { status: 401 },
    );
  }

  const visitor =
    gallery.visitors?.find(
      (candidate) =>
        candidate.id === visitorId,
    );

  if (!visitor) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Your gallery session could not be found.",
      },
      { status: 401 },
    );
  }

  const image = gallery.images.find(
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

  /*
   * Selected-only downloads require the
   * photograph to be in this visitor's
   * current favourites.
   */
  if (
    gallery.downloadPermission ===
    "selected"
  ) {
    const isSelected =
      visitor.selection.favourites.some(
        (favourite) =>
          favourite.imageId === image.id,
      );

    if (!isSelected) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Select this photograph before downloading it.",
        },
        { status: 403 },
      );
    }
  }

  if (!isSafeSegment(image.webFilename)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid image filename.",
      },
      { status: 400 },
    );
  }

  const imagePath = path.join(
    proofingImagesDirectory,
    gallery.id,
    image.webFilename,
  );

  try {
    const file = await fs.readFile(imagePath);

    return new NextResponse(file, {
      headers: {
        "Content-Type": "image/webp",
        "Content-Disposition":
          `attachment; filename="${downloadFilename(
            image.originalFilename,
          )}"`,
        "Cache-Control":
          "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The photograph could not be downloaded.",
      },
      { status: 404 },
    );
  }
}
