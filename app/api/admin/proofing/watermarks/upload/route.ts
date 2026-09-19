import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import path from "node:path";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  getProofingWatermarks,
  saveProofingWatermarks,
} from "../../../../../../lib/proofing/watermarks";

import {
  createProofingWatermarkUploadUrl,
  proofingWatermarkExists,
} from "../../../../../../lib/proofing/watermark-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

function stringValue(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export async function POST(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  try {
    const body =
      (await request.json()) as {
        action?: unknown;
        name?: unknown;
        originalFilename?: unknown;
        id?: unknown;
        filename?: unknown;
      };

    const action = stringValue(body.action);

    if (action === "presign") {
      const originalFilename =
        stringValue(body.originalFilename);

      if (
        !originalFilename ||
        !/\.png$/i.test(originalFilename)
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Choose a transparent PNG watermark file.",
          },
          { status: 400 },
        );
      }

      const id = randomUUID();
      const filename = `${id}.png`;
      const uploadUrl =
        await createProofingWatermarkUploadUrl(
          filename,
        );

      return NextResponse.json({
        ok: true,
        id,
        filename,
        uploadUrl,
      });
    }

    if (action === "commit") {
      const id = stringValue(body.id);
      const filename = stringValue(body.filename);
      const originalFilename =
        stringValue(body.originalFilename);
      const requestedName = safeName(
        stringValue(body.name),
      );

      if (
        !id ||
        filename !== `${id}.png` ||
        !originalFilename
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Watermark metadata is invalid.",
          },
          { status: 400 },
        );
      }

      if (
        !(await proofingWatermarkExists(
          filename,
        ))
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "The watermark was not verified in R2.",
          },
          { status: 409 },
        );
      }

      const originalBaseName = path
        .basename(
          originalFilename,
          path.extname(originalFilename),
        )
        .trim();

      const now = new Date().toISOString();
      const watermark = {
        id,
        name:
          requestedName ||
          originalBaseName ||
          "Watermark",
        filename,
        createdAt: now,
        updatedAt: now,
      };

      const watermarks =
        await getProofingWatermarks();

      if (
        watermarks.some(
          (item) => item.id === id,
        )
      ) {
        return NextResponse.json({
          ok: true,
          watermark:
            watermarks.find(
              (item) => item.id === id,
            ),
        });
      }

      await saveProofingWatermarks([
        ...watermarks,
        watermark,
      ]);

      return NextResponse.json({
        ok: true,
        watermark,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Unknown watermark upload action.",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error(
      "Proofing watermark upload failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "The watermark could not be uploaded.",
      },
      { status: 500 },
    );
  }
}
