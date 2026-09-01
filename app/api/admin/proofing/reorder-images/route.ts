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

type ReorderImagesRequest = {
  galleryId?: string;
  imageIds?: string[];
};

export async function POST(
  request: NextRequest,
) {
  let payload: ReorderImagesRequest;

  try {
    payload =
      (await request.json()) as ReorderImagesRequest;
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

  const imageIds = Array.isArray(
    payload.imageIds,
  )
    ? payload.imageIds
    : [];

  if (!galleryId) {
    return NextResponse.json(
      {
        ok: false,
        message: "Gallery is required.",
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

  if (
    imageIds.length !== gallery.images.length
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The photograph order is incomplete.",
      },
      {
        status: 400,
      },
    );
  }

  const uniqueImageIds =
    new Set(imageIds);

  if (
    uniqueImageIds.size !== imageIds.length
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The photograph order contains duplicates.",
      },
      {
        status: 400,
      },
    );
  }

  const galleryImageIds = new Set(
    gallery.images.map(
      (image) => image.id,
    ),
  );

  const containsUnknownImage =
    imageIds.some(
      (imageId) =>
        !galleryImageIds.has(imageId),
    );

  if (containsUnknownImage) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The photograph order is invalid.",
      },
      {
        status: 400,
      },
    );
  }

  const imagesById = new Map(
    gallery.images.map(
      (image) => [image.id, image],
    ),
  );

  const reorderedImages =
    imageIds.map(
      (imageId, index) => ({
        ...imagesById.get(imageId)!,
        sortOrder: index,
      }),
    );

  const updatedGallery =
    updateProofingGallery(
      gallery.id,
      (currentGallery) => ({
        ...currentGallery,
        images: reorderedImages,
      }),
    );

  if (!updatedGallery) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The photograph order could not be saved.",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,
  });
}
