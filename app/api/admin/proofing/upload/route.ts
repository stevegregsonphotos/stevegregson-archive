import {
  deleteProofingImage,
  putProofingImage,
} from "../../../../../lib/proofing/image-storage";

import sharp from "sharp";
import { NextResponse } from "next/server";

import { updateProofingGallery } from "../../../../../lib/proofing/repository";
import type { ProofingImage } from "../../../../../lib/proofing/types";

export const runtime = "nodejs";

function safeFilename(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const galleryId = String(
      formData.get("galleryId") ?? "",
    ).trim();

    const uploadedFile = formData.get("image");

    if (!galleryId) {
      return NextResponse.json(
        {
          ok: false,
          message: "Gallery ID is required.",
        },
        { status: 400 },
      );
    }

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          message: "No image was supplied.",
        },
        { status: 400 },
      );
    }

    const originalFilename = uploadedFile.name;

    const inputBuffer = Buffer.from(
      await uploadedFile.arrayBuffer(),
    );

    const image = sharp(inputBuffer, {
      failOn: "error",
    });

    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      return NextResponse.json(
        {
          ok: false,
          message: `Could not read ${originalFilename}.`,
        },
        { status: 400 },
      );
    }

    const imageId = crypto.randomUUID();

    const baseFilename =
      safeFilename(originalFilename) || "proof";

    const webFilename =
      `${baseFilename}-${imageId}.webp`;

    const proofBuffer = await sharp(inputBuffer)
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: 82,
        effort: 4,
      })
      .toBuffer();

    const proofMetadata =
      await sharp(proofBuffer).metadata();

    await putProofingImage(
      galleryId,
      webFilename,
      proofBuffer,
    );

    const proofingImage: ProofingImage = {
      id: imageId,

      /*
       * Critical for Lightroom:
       * this remains the exact uploaded filename.
       */
      originalFilename,

      webFilename,

      width:
        proofMetadata.width ?? metadata.width,

      height:
        proofMetadata.height ?? metadata.height,

      alt: originalFilename,

sortOrder: 0,

createdAt: new Date(
  uploadedFile.lastModified || Date.now(),
).toISOString(),
    };

    const updatedGallery = await updateProofingGallery(
      galleryId,
      (gallery) => ({
        ...gallery,

        images: [
          ...gallery.images,
          {
            ...proofingImage,
            sortOrder: gallery.images.length,
          },
        ],
      }),
    );

    if (!updatedGallery) {
      await deleteProofingImage(
          galleryId,
          webFilename,
        );

      return NextResponse.json(
        {
          ok: false,
          message: "Proofing gallery not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,

      image: proofingImage,

      gallery: {
        id: updatedGallery.id,
        imageCount: updatedGallery.images.length,
      },
    });
  } catch (error) {
    console.error(
      "Proofing upload failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message: "The proof image upload failed.",
      },
      { status: 500 },
    );
  }
}