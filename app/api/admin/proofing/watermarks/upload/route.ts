import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import sharp from "sharp";

import {
  getProofingWatermarkDirectory,
  getProofingWatermarks,
  saveProofingWatermarks,
} from "../../../../../../lib/proofing/watermarks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function safeName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const file = formData.get("file");
    const requestedName = safeName(
      String(formData.get("name") ?? ""),
    );

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Choose a PNG watermark file.",
        },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "The watermark file is empty.",
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Watermark files must be smaller than 10 MB.",
        },
        { status: 400 },
      );
    }

    const input = Buffer.from(
      await file.arrayBuffer(),
    );

    let metadata;

    try {
      metadata = await sharp(input).metadata();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          message:
            "The selected file is not a valid image.",
        },
        { status: 400 },
      );
    }

    if (metadata.format !== "png") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Watermarks must be uploaded as PNG files.",
        },
        { status: 400 },
      );
    }

    if (!metadata.hasAlpha) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "The PNG must contain transparency.",
        },
        { status: 400 },
      );
    }

    const id = randomUUID();
    const filename = `${id}.png`;

    const originalBaseName = path
      .basename(file.name, path.extname(file.name))
      .trim();

    const name =
      requestedName ||
      originalBaseName ||
      "Watermark";

    const directory =
      getProofingWatermarkDirectory();

    await fs.writeFile(
      path.join(directory, filename),
      input,
    );

    const now = new Date().toISOString();

    const watermark = {
      id,
      name,
      filename,
      createdAt: now,
      updatedAt: now,
    };

    const watermarks =
      getProofingWatermarks();

    saveProofingWatermarks([
      ...watermarks,
      watermark,
    ]);

    return NextResponse.json({
      ok: true,
      watermark,
    });
  } catch {
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
