import { NextResponse } from "next/server";

import { updateProofingGallery } from "../../../../../lib/proofing/repository";
import type {
  ProofingDownloadPermission,
  ProofingGalleryStatus,
  ProofingWatermarkPosition,
} from "../../../../../lib/proofing/types";

const validStatuses: ProofingGalleryStatus[] = [
  "draft",
  "live",
  "expired",
  "archived",
];

const validDownloadPermissions: ProofingDownloadPermission[] =
  [
    "none",
    "web",
    "selected",
  ];

const validWatermarkPositions: ProofingWatermarkPosition[] =
  [
    "top-left",
    "top-center",
    "top-right",
    "center-left",
    "center",
    "center-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ];

export async function POST(request: Request) {
  const body = await request.json();

  const galleryId = String(
    body.galleryId ?? "",
  ).trim();

  const status = String(
    body.status ?? "",
  ) as ProofingGalleryStatus;

  const downloadPermission = String(
    body.downloadPermission ?? "",
  ) as ProofingDownloadPermission;

  const watermarkEnabled =
    body.watermarkEnabled === true;

  const watermarkIdValue = String(
    body.watermarkId ?? "",
  ).trim();

  const watermarkPositionValue = String(
    body.watermarkPosition ?? "bottom-right",
  ) as ProofingWatermarkPosition;

  const watermarkSizeValue = Number(
    body.watermarkSize ?? 30,
  );

  const watermarkOpacityValue = Number(
    body.watermarkOpacity ?? 65,
  );

  const expiresAtValue = String(
    body.expiresAt ?? "",
  ).trim();

  if (!galleryId) {
    return NextResponse.json(
      { error: "Gallery is required." },
      { status: 400 },
    );
  }

  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      { error: "Invalid gallery status." },
      { status: 400 },
    );
  }

  if (
    !validDownloadPermissions.includes(
      downloadPermission,
    )
  ) {
    return NextResponse.json(
      { error: "Invalid download setting." },
      { status: 400 },
    );
  }

  if (
    !validWatermarkPositions.includes(
      watermarkPositionValue,
    )
  ) {
    return NextResponse.json(
      { error: "Invalid watermark position." },
      { status: 400 },
    );
  }

  if (
    !Number.isFinite(watermarkSizeValue) ||
    watermarkSizeValue < 5 ||
    watermarkSizeValue > 100
  ) {
    return NextResponse.json(
      { error: "Invalid watermark size." },
      { status: 400 },
    );
  }

  if (
    !Number.isFinite(watermarkOpacityValue) ||
    watermarkOpacityValue < 5 ||
    watermarkOpacityValue > 100
  ) {
    return NextResponse.json(
      { error: "Invalid watermark opacity." },
      { status: 400 },
    );
  }

  let expiresAt: string | undefined;

  if (expiresAtValue) {
    const parsedDate = new Date(
      `${expiresAtValue}T23:59:59`,
    );

    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid expiry date." },
        { status: 400 },
      );
    }

    expiresAt = parsedDate.toISOString();
  }

  const updatedGallery = updateProofingGallery(
    galleryId,
    (gallery) => ({
      ...gallery,
      status,
      downloadPermission,
      watermarkEnabled,
      watermarkId:
        watermarkIdValue || undefined,
      watermarkPosition:
        watermarkPositionValue,
      watermarkSize:
        watermarkSizeValue,
      watermarkOpacity:
        watermarkOpacityValue,
      expiresAt,
    }),
  );

  if (!updatedGallery) {
    return NextResponse.json(
      { error: "Gallery not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
  });
}
