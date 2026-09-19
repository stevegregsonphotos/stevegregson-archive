import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import {
  deleteProofingGalleryObjects,
} from "@/lib/proofing/image-storage";

import {
  deleteProofingGallery,
  getProofingGallery,
} from "@/lib/proofing/repository";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeleteGalleryRequest = {
  galleryId?: unknown;
};

export async function POST(
  request: Request,
) {
  if (
    !isBackstageRequestAuthenticated(
      request,
    )
  ) {
    return createUnauthorizedResponse();
  }

  let body:
    DeleteGalleryRequest;

  try {
    body =
      (await request.json()) as
        DeleteGalleryRequest;
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
    typeof body.galleryId === "string"
      ? body.galleryId.trim()
      : "";

  if (!galleryId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Gallery ID is required.",
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
        message:
          "Proofing gallery was not found.",
      },
      {
        status: 404,
      },
    );
  }

  try {
    /*
     * Delete R2 first. If storage deletion fails,
     * keep Neon untouched so the gallery remains
     * recoverable and visible in Backstage.
     */
    await deleteProofingGalleryObjects(
      galleryId,
    );

    const deleted =
      await deleteProofingGallery(
        galleryId,
      );

    if (!deleted) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Gallery database record could not be deleted.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      ok: true,
      galleryId,
      title: gallery.title,
    });
  } catch (error) {
    console.error(
      "Proofing gallery deletion failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "The proofing gallery could not be deleted.",
      },
      {
        status: 500,
      },
    );
  }
}
