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

type PresentationRequest = {
  galleryId?: string;
  introMessage?: string;
  coverImageId?: string | null;
};

export async function POST(
  request: NextRequest,
) {
  let payload: PresentationRequest;

  try {
    payload =
      (await request.json()) as PresentationRequest;
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

  const introMessage =
    payload.introMessage?.trim() ?? "";

  const coverImageId =
    payload.coverImageId?.trim() || undefined;

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

  /*
   * A cover must belong to this gallery.
   */
  if (
    coverImageId &&
    !gallery.images.some(
      (image) =>
        image.id === coverImageId,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The selected cover photograph does not belong to this gallery.",
      },
      {
        status: 400,
      },
    );
  }

  const updatedGallery =
    updateProofingGallery(
      gallery.id,
      (currentGallery) => ({
        ...currentGallery,

        introMessage:
          introMessage || undefined,

        coverImageId,
      }),
    );

  if (!updatedGallery) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Gallery presentation could not be saved.",
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