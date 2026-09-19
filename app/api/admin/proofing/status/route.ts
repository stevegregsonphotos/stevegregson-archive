import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import {
  updateProofingGallery,
} from "@/lib/proofing/repository";

import type {
  ProofingGalleryStatus,
} from "@/lib/proofing/types";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StatusRequest = {
  galleryId?: unknown;
  status?: unknown;
};

const allowedStatuses:
  ProofingGalleryStatus[] = [
    "live",
    "archived",
  ];

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

  let body: StatusRequest;

  try {
    body =
      (await request.json()) as
        StatusRequest;
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

  const status =
    typeof body.status === "string"
      ? body.status.trim() as
          ProofingGalleryStatus
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

  if (
    !allowedStatuses.includes(
      status as ProofingGalleryStatus,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Invalid gallery status.",
      },
      {
        status: 400,
      },
    );
  }

  const updatedGallery =
    await updateProofingGallery(
      galleryId,
      (gallery) => ({
        ...gallery,
        status:
          status as ProofingGalleryStatus,
      }),
    );

  if (!updatedGallery) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Gallery not found.",
      },
      {
        status: 404,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    status:
      updatedGallery.status,
  });
}
