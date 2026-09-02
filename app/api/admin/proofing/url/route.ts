import { NextResponse } from "next/server";

import {
  getProofingGalleries,
  updateProofingGallery,
} from "../../../../../lib/proofing/repository";

function normaliseSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: Request) {
  const body = await request.json();

  const galleryId = String(
    body.galleryId ?? "",
  ).trim();

  const requestedSlug = String(
    body.slug ?? "",
  ).trim();

  const slug = normaliseSlug(requestedSlug);

  if (!galleryId || !slug) {
    return NextResponse.json(
      {
        error: "A gallery and URL are required.",
      },
      { status: 400 },
    );
  }

  const duplicateGallery = getProofingGalleries().find(
    (gallery) =>
      gallery.id !== galleryId &&
      gallery.slug.trim().toLowerCase() === slug,
  );

  if (duplicateGallery) {
    return NextResponse.json(
      {
        error:
          "That gallery URL is already being used.",
      },
      { status: 409 },
    );
  }

  const updatedGallery = updateProofingGallery(
    galleryId,
    (gallery) => ({
      ...gallery,
      slug,
    }),
  );

  if (!updatedGallery) {
    return NextResponse.json(
      {
        error: "Gallery not found.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    slug: updatedGallery.slug,
  });
}
