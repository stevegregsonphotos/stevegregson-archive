import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import {
  createProofingImageDownloadUrl,
  createProofingImageUploadUrl,
  createProofingThumbUploadUrl,
  deleteProofingImage,
  listProofingThumbs,
} from "../../../../../lib/proofing/image-storage";

import { NextResponse } from "next/server";

import {
  commitProofingImages,
  listProofingImageFiles,
  proofingGalleryExists,
} from "../../../../../lib/proofing/repository";

import type {
  ProofingImage,
} from "../../../../../lib/proofing/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadRequest = {
  action?: unknown;
  galleryId?: unknown;
  originalFilename?: unknown;
  originalFilenames?: unknown;
  images?: unknown;
  webFilenames?: unknown;
};

type CommitImage = {
  imageId: string;
  originalFilename: string;
  webFilename: string;
  width: number;
  height: number;
  createdAt: string;
  replaceImageId?: string;
};

function safeFilename(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stringValue(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function parseCommitImage(
  value: unknown,
): CommitImage | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const image = value as Record<string, unknown>;
  const imageId = stringValue(image.imageId);
  const originalFilename =
    stringValue(image.originalFilename);
  const webFilename = stringValue(image.webFilename);
  const width = Number(image.width);
  const height = Number(image.height);
  const createdAt = stringValue(image.createdAt);
  const replaceImageId =
    stringValue(image.replaceImageId);

  if (
    !imageId ||
    !originalFilename ||
    !webFilename ||
    !Number.isInteger(width) ||
    width <= 0 ||
    !Number.isInteger(height) ||
    height <= 0 ||
    !createdAt
  ) {
    return null;
  }

  return {
    imageId,
    originalFilename,
    webFilename,
    width,
    height,
    createdAt,
    ...(replaceImageId ? { replaceImageId } : {}),
  };
}

export async function POST(
  request: Request,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  let body: UploadRequest;

  try {
    body =
      (await request.json()) as UploadRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid upload request.",
      },
      { status: 400 },
    );
  }

  const action = stringValue(body.action);
  const galleryId = stringValue(body.galleryId);

  if (!galleryId) {
    return NextResponse.json(
      {
        ok: false,
        message: "Gallery ID is required.",
      },
      { status: 400 },
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
        message: "Proofing gallery not found.",
      },
      { status: 404 },
    );
  }

  /*
   * Sign a whole browser batch in one tiny Vercel request.
   * The image bodies still travel browser -> R2 directly.
   */
  if (action === "presign-batch") {
    const originalFilenames =
      Array.isArray(body.originalFilenames)
        ? body.originalFilenames
            .map(stringValue)
            .filter(Boolean)
        : [];

    if (
      originalFilenames.length === 0 ||
      originalFilenames.length > 24
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Between 1 and 24 filenames are required.",
        },
        { status: 400 },
      );
    }

    const jobs =
      await Promise.all(
        originalFilenames.map(
          async (originalFilename) => {
            const imageId =
              crypto.randomUUID();
            const baseFilename =
              safeFilename(
                originalFilename,
              ) || "proof";
            const webFilename =
              `${baseFilename}-${imageId}.webp`;

            return {
              originalFilename,
              imageId,
              webFilename,
              uploadUrl:
                await createProofingImageUploadUrl(
                  galleryId,
                  webFilename,
                ),
              // The small grid thumbnail goes up alongside the proof.
              thumbUploadUrl:
                await createProofingThumbUploadUrl(
                  galleryId,
                  webFilename,
                ),
            };
          },
        ),
      );

    return NextResponse.json({
      ok: true,
      jobs,
    });
  }

  /*
   * Thumbnails: which photos still need one (photos uploaded before
   * thumbnails existed). Steve's browser then makes them.
   */
  if (action === "thumbs-status") {
    const [images, thumbs] = await Promise.all([
      listProofingImageFiles(galleryId),
      listProofingThumbs(galleryId),
    ]);
    return NextResponse.json({
      ok: true,
      total: images.length,
      missing: images
        .filter((image) => !thumbs.has(image.webFilename))
        .map((image) => image.webFilename),
    });
  }

  /*
   * For up to 24 photos: a link to read the proof and a link to upload
   * its thumbnail. The photos move browser <-> R2 only, never via Vercel.
   */
  if (action === "presign-thumbs") {
    const requested = Array.isArray(body.webFilenames)
      ? body.webFilenames.map(stringValue).filter(Boolean)
      : [];

    if (requested.length === 0 || requested.length > 24) {
      return NextResponse.json(
        {
          ok: false,
          message: "Between 1 and 24 photos are required.",
        },
        { status: 400 },
      );
    }

    const known = new Set(
      (await listProofingImageFiles(galleryId)).map(
        (image) => image.webFilename,
      ),
    );

    const jobs = await Promise.all(
      requested
        .filter((webFilename) => known.has(webFilename))
        .map(async (webFilename) => ({
          webFilename,
          sourceUrl: await createProofingImageDownloadUrl(
            galleryId,
            webFilename,
          ),
          thumbUploadUrl: await createProofingThumbUploadUrl(
            galleryId,
            webFilename,
          ),
        })),
    );

    return NextResponse.json({ ok: true, jobs });
  }

  /*
   * Backwards-compatible single presign.
   */
  if (action === "presign") {
    const originalFilename =
      stringValue(body.originalFilename);

    if (!originalFilename) {
      return NextResponse.json(
        {
          ok: false,
          message: "Original filename is required.",
        },
        { status: 400 },
      );
    }

    const imageId = crypto.randomUUID();
    const baseFilename =
      safeFilename(originalFilename) || "proof";
    const webFilename =
      `${baseFilename}-${imageId}.webp`;

    const uploadUrl =
      await createProofingImageUploadUrl(
        galleryId,
        webFilename,
      );

    return NextResponse.json({
      ok: true,
      imageId,
      webFilename,
      uploadUrl,
    });
  }

  /*
   * Commit a small metadata batch only after the browser
   * has PUT those files directly to R2. A batch avoids
   * concurrent read/modify/write races in the gallery row.
   */
  if (action === "commit-batch") {
    if (!Array.isArray(body.images)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Image metadata is required.",
        },
        { status: 400 },
      );
    }

    const images = body.images.map(parseCommitImage);

    if (
      images.length === 0 ||
      images.some((image) => image === null)
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "Incomplete proofing image metadata.",
        },
        { status: 400 },
      );
    }

    const validImages = images as CommitImage[];

    const proofingImages:
      Array<ProofingImage & { replaceImageId?: string }> =
      validImages.map(
        (image) => ({
          id: image.imageId,
          originalFilename:
            image.originalFilename,
          webFilename:
            image.webFilename,
          width: image.width,
          height: image.height,
          alt: image.originalFilename,
          sortOrder: 0,
          createdAt: image.createdAt,
          ...(image.replaceImageId
            ? { replaceImageId: image.replaceImageId }
            : {}),
        }),
      );

    // Already-listed file names are skipped here too, so a retried
    // upload can never list the same photo twice.
    const result =
      await commitProofingImages(
        galleryId,
        proofingImages,
      );

    // Tidy away files nobody will use: skipped duplicates, and the old
    // picture of each replaced photo.
    await Promise.allSettled([
      ...result.skipped.map((image) =>
        deleteProofingImage(galleryId, image.webFilename),
      ),
      ...result.replaced.map((item) =>
        deleteProofingImage(galleryId, item.oldWebFilename),
      ),
    ]);

    return NextResponse.json({
      ok: true,
      committed: result.inserted.length,
      replaced: result.replaced.length,
      skipped: result.skipped.map(
        (image) => image.originalFilename,
      ),
      gallery: {
        id: galleryId,
        imageCount: result.imageCount,
      },
    });
  }

  return NextResponse.json(
    {
      ok: false,
      message: "Unknown upload action.",
    },
    { status: 400 },
  );
}
