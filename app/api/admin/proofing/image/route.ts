import fs from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { getProofingGallery } from "../../../../../lib/proofing/repository";

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
  const galleryId =
    request.nextUrl.searchParams.get("galleryId")?.trim() ?? "";

  const imageId =
    request.nextUrl.searchParams.get("imageId")?.trim() ?? "";

  if (
    !isSafeSegment(galleryId) ||
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

  const gallery = await getProofingGallery(galleryId);

  if (!gallery) {
    return NextResponse.json(
      {
        ok: false,
        message: "Proofing gallery not found.",
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
        message: "Proof image not found.",
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
        message: "Invalid proof image filename.",
      },
      {
        status: 400,
      },
    );
  }

  const galleryDirectory = path.join(
    proofingImagesDirectory,
    gallery.id,
  );

  const imagePath = path.join(
    galleryDirectory,
    image.webFilename,
  );

  try {
    const file = await fs.readFile(imagePath);

    return new NextResponse(file, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control":
          "private, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Proof image file could not be read.",
      },
      {
        status: 404,
      },
    );
  }
}