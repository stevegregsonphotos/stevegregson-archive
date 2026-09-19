import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import {
  createProofingImageUploadUrl,
  proofingImageExists,
} from "../../../../../lib/proofing/image-storage";

import { NextResponse } from "next/server";

import {
  getProofingGallery,
  updateProofingGallery,
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

  const gallery =
    await getProofingGallery(galleryId);

  if (!gallery) {
    return NextResponse.json(
      {
        ok: false,
        message: "Proofing gallery not found.",
      },
      { status: 404 },
    );
  }

  /*
   * Vercel authenticates and signs only. The image body
   * goes directly from the browser to Cloudflare R2.
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

    for (const image of validImages) {
      if (
        !(await proofingImageExists(
          galleryId,
          image.webFilename,
        ))
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              `${image.originalFilename} was not verified in R2.`,
          },
          { status: 409 },
        );
      }
    }

    const updatedGallery =
      await updateProofingGallery(
        galleryId,
        (currentGallery) => {
          const existingIds = new Set(
            currentGallery.images.map(
              (image) => image.id,
            ),
          );

          const newImages =
            validImages.filter(
              (image) =>
                !existingIds.has(image.imageId),
            );

          const nextImages: ProofingImage[] = [
            ...currentGallery.images,
            ...newImages.map(
              (image, index) => ({
                id: image.imageId,
                originalFilename:
                  image.originalFilename,
                webFilename: image.webFilename,
                width: image.width,
                height: image.height,
                alt: image.originalFilename,
                sortOrder:
                  currentGallery.images.length + index,
                createdAt: image.createdAt,
              }),
            ),
          ];

          return {
            ...currentGallery,
            images: nextImages,
          };
        },
      );

    if (!updatedGallery) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Proofing gallery could not be updated.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      committed: validImages.length,
      gallery: {
        id: updatedGallery.id,
        imageCount: updatedGallery.images.length,
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
