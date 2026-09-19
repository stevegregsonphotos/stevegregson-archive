import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import {
  createProofingImageUploadUrl,
} from "../../../../../lib/proofing/image-storage";

import { NextResponse } from "next/server";

import {
  insertProofingImages,
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
};

type CommitImage = {
  imageId: string;
  originalFilename: string;
  webFilename: string;
  width: number;
  height: number;
  createdAt: string;
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
      ProofingImage[] =
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
        }),
      );

    const result =
      await insertProofingImages(
        galleryId,
        proofingImages,
      );

    return NextResponse.json({
      ok: true,
      committed: validImages.length,
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
