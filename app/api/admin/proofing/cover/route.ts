import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import { NextResponse } from "next/server";

import {
  createProofingImageUploadUrl,
  deleteProofingImage,
  proofingImageExists,
} from "../../../../../lib/proofing/image-storage";

import {
  getProofingGallery,
  updateProofingGallery,
} from "../../../../../lib/proofing/repository";

import {
  COVER_UPLOAD_PREFIX,
} from "../../../../../lib/proofing/cover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * The gallery cover, which can be set before any photos are uploaded:
 *  - "set": use one of the gallery's photos (or the uploaded cover), or none
 *  - "presign" + "commit": upload a photo just for the cover. The photo goes
 *    straight from the browser to R2; this only signs the link and saves
 *    the details.
 */

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return fail("Invalid request.");
  }

  const action = text(body.action);
  const galleryId = text(body.galleryId);

  if (!galleryId) {
    return fail("Gallery is required.");
  }

  const gallery = await getProofingGallery(galleryId);

  if (!gallery) {
    return fail("Gallery not found.", 404);
  }

  if (action === "set") {
    const coverImageId = text(body.coverImageId) || undefined;

    if (
      coverImageId &&
      gallery.coverUpload?.id !== coverImageId &&
      !gallery.images.some((image) => image.id === coverImageId)
    ) {
      return fail("That photo isn't in this gallery.");
    }

    await updateProofingGallery(gallery.id, (current) => ({
      ...current,
      coverImageId,
    }));

    return NextResponse.json({ ok: true });
  }

  if (action === "presign") {
    const coverId = `${COVER_UPLOAD_PREFIX}${crypto.randomUUID()}`;
    const webFilename = `${coverId}.webp`;

    return NextResponse.json({
      ok: true,
      coverId,
      webFilename,
      uploadUrl: await createProofingImageUploadUrl(gallery.id, webFilename),
    });
  }

  if (action === "commit") {
    const coverId = text(body.coverId);
    const originalFilename = text(body.originalFilename) || "Cover photo";
    const width = Number(body.width);
    const height = Number(body.height);
    const webFilename = `${coverId}.webp`;

    if (
      !coverId.startsWith(COVER_UPLOAD_PREFIX) ||
      !/^[a-z0-9-]+$/i.test(coverId) ||
      !Number.isInteger(width) ||
      width <= 0 ||
      !Number.isInteger(height) ||
      height <= 0
    ) {
      return fail("Incomplete cover photo details.");
    }

    if (!(await proofingImageExists(gallery.id, webFilename))) {
      return fail("The cover photo didn't finish uploading. Please try again.");
    }

    const previous = gallery.coverUpload;

    await updateProofingGallery(gallery.id, (current) => ({
      ...current,
      coverImageId: coverId,
      coverUpload: { id: coverId, webFilename, originalFilename, width, height },
    }));

    if (previous && previous.webFilename !== webFilename) {
      await deleteProofingImage(gallery.id, previous.webFilename).catch(() => undefined);
    }

    return NextResponse.json({ ok: true, coverId });
  }

  return fail("Unknown cover action.");
}
