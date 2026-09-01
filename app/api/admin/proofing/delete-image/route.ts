import fs from "node:fs";
import path from "node:path";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getProofingGallery,
  updateProofingGallery,
} from "../../../../../lib/proofing/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeleteImageRequest = {
  galleryId?: string;
  imageId?: string;
};

export async function POST(
  request: NextRequest,
) {
  let payload: DeleteImageRequest;

  try {
    payload =
      (await request.json()) as DeleteImageRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid request.",
      },
      {
        status: 400,
      },
    );
  }

  const galleryId =
    payload.galleryId?.trim() ?? "";

  const imageId =
    payload.imageId?.trim() ?? "";

  if (!galleryId || !imageId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Gallery and photograph are required.",
      },
      {
        status: 400,
      },
    );
  }

  const gallery =
    getProofingGallery(galleryId);

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
    (galleryImage) =>
      galleryImage.id === imageId,
  );

  if (!image) {
    return NextResponse.json(
      {
        ok: false,
        message: "Photograph not found.",
      },
      {
        status: 404,
      },
    );
  }

  const updatedGallery =
    updateProofingGallery(
      gallery.id,
      (currentGallery) => {
        const remainingImages =
          currentGallery.images
            .filter(
              (galleryImage) =>
                galleryImage.id !== imageId,
            )
            .map(
              (galleryImage, index) => ({
                ...galleryImage,
                sortOrder: index,
              }),
            );

        const visitors =
          currentGallery.visitors.map(
            (visitor) => ({
              ...visitor,

              selection: {
                ...visitor.selection,

                favourites:
                  visitor.selection.favourites.filter(
                    (favourite) =>
                      favourite.imageId !==
                      imageId,
                  ),

                submittedFavourites:
                  visitor.selection
                    .submittedFavourites
                    ?.filter(
                      (favourite) =>
                        favourite.imageId !==
                        imageId,
                    ),
              },
            }),
          );

        const legacySelection =
          currentGallery.selection
            ? {
                ...currentGallery.selection,

                favourites:
                  currentGallery.selection.favourites.filter(
                    (favourite) =>
                      favourite.imageId !==
                      imageId,
                  ),

                submittedFavourites:
                  currentGallery.selection
                    .submittedFavourites
                    ?.filter(
                      (favourite) =>
                        favourite.imageId !==
                        imageId,
                    ),
              }
            : undefined;

        return {
          ...currentGallery,

          images: remainingImages,

          visitors,

          selection: legacySelection,

          coverImageId:
            currentGallery.coverImageId ===
            imageId
              ? undefined
              : currentGallery.coverImageId,
        };
      },
    );

  if (!updatedGallery) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The photograph could not be removed.",
      },
      {
        status: 500,
      },
    );
  }

  const imagePath = path.join(
    process.cwd(),
    "data",
    "proofing-images",
    gallery.id,
    image.webFilename,
  );

  try {
    fs.rmSync(imagePath, {
      force: true,
    });
  } catch (error) {
    console.error(
      "Proofing image file could not be removed:",
      error,
    );
  }

  return NextResponse.json({
    ok: true,
  });
}
