import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import {
  createProofingImageUploadUrl,
  deleteProofingImage,
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
  imageId?: unknown;
  originalFilename?: unknown;
  webFilename?: unknown;
  width?: unknown;
  height?: unknown;
  createdAt?: unknown;
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
      {
        status: 400,
      },
    );
  }

  const action =
    stringValue(body.action);

  const galleryId =
    stringValue(body.galleryId);

  if (!galleryId) {
    return NextResponse.json(
      {
        ok: false,
        message: "Gallery ID is required.",
      },
      {
        status: 400,
      },
    );
  }

  const gallery =
    await getProofingGallery(
      galleryId,
    );

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

  /*
   * Stage 1:
   * Vercel signs a tiny request only.
   * The photograph itself never passes through Vercel.
   */
  if (action === "presign") {
    const originalFilename =
      stringValue(
        body.originalFilename,
      );

    if (!originalFilename) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Original filename is required.",
        },
        {
          status: 400,
        },
      );
    }

    const imageId =
      crypto.randomUUID();

    const baseFilename =
      safeFilename(
        originalFilename,
      ) || "proof";

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
   * Stage 2:
   * After the browser has PUT the WebP directly to R2,
   * record only its small metadata in Neon.
   */
  if (action === "commit") {
    const imageId =
      stringValue(body.imageId);

    const originalFilename =
      stringValue(
        body.originalFilename,
      );

    const webFilename =
      stringValue(
        body.webFilename,
      );

    const width =
      Number(body.width);

    const height =
      Number(body.height);

    const createdAt =
      stringValue(
        body.createdAt,
      ) ||
      new Date().toISOString();

    if (
      !imageId ||
      !originalFilename ||
      !webFilename ||
      !Number.isInteger(width) ||
      width <= 0 ||
      !Number.isInteger(height) ||
      height <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Incomplete proofing image metadata.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !(await proofingImageExists(
        galleryId,
        webFilename,
      ))
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "The proofing image was not verified in R2.",
        },
        {
          status: 409,
        },
      );
    }

    /*
     * Safe retry:
     * if the metadata commit succeeded but the browser
     * lost the response, do not add a duplicate image.
     */
    const existing =
      gallery.images.find(
        (image) =>
          image.id === imageId,
      );

    if (existing) {
      return NextResponse.json({
        ok: true,
        image: existing,
        gallery: {
          id: gallery.id,
          imageCount:
            gallery.images.length,
        },
      });
    }

    const proofingImage:
      ProofingImage = {
        id: imageId,
        originalFilename,
        webFilename,
        width,
        height,
        alt: originalFilename,
        sortOrder:
          gallery.images.length,
        createdAt,
      };

    const updatedGallery =
      await updateProofingGallery(
        galleryId,
        (currentGallery) => {
          if (
            currentGallery.images.some(
              (image) =>
                image.id === imageId,
            )
          ) {
            return currentGallery;
          }

          return {
            ...currentGallery,

            images: [
              ...currentGallery.images,
              {
                ...proofingImage,
                sortOrder:
                  currentGallery.images.length,
              },
            ],
          };
        },
      );

    if (!updatedGallery) {
      await deleteProofingImage(
        galleryId,
        webFilename,
      ).catch(() => undefined);

      return NextResponse.json(
        {
          ok: false,
          message:
            "Proofing gallery could not be updated.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      ok: true,
      image: proofingImage,
      gallery: {
        id: updatedGallery.id,
        imageCount:
          updatedGallery.images.length,
      },
    });
  }

  return NextResponse.json(
    {
      ok: false,
      message: "Unknown upload action.",
    },
    {
      status: 400,
    },
  );
}
