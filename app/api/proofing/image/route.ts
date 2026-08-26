import fs from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

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

export async function GET(request: NextRequest) {
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
      {
        status: 400,
      },
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
      {
        status: 404,
      },
    );
  }

  const image = gallery.images.find(
    (candidate) => candidate.id === imageId,
  );

  if (!image) {
    return NextResponse.json(
      {
        ok: false,
        message: "Image not found.",
      },
      {
        status: 404,
      },
    );
  }

  if (!isSafeSegment(image.webFilename)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid image filename.",
      },
      {
        status: 400,
      },
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

        /*
         * Client proofs should not be cached by
         * shared/proxy caches.
         *
         * We can refine browser caching once gallery
         * authentication is implemented.
         */
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Image file could not be read.",
      },
      {
        status: 404,
      },
    );
  }
}