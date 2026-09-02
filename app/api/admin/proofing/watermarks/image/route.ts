import fs from "node:fs/promises";
import path from "node:path";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getProofingWatermark,
  getProofingWatermarkDirectory,
} from "../../../../../../lib/proofing/watermarks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  const id =
    request.nextUrl.searchParams
      .get("id")
      ?.trim() ?? "";

  if (!id) {
    return NextResponse.json(
      {
        ok: false,
        message: "Watermark is required.",
      },
      { status: 400 },
    );
  }

  const watermark =
    getProofingWatermark(id);

  if (!watermark) {
    return NextResponse.json(
      {
        ok: false,
        message: "Watermark not found.",
      },
      { status: 404 },
    );
  }

  const filePath = path.join(
    getProofingWatermarkDirectory(),
    watermark.filename,
  );

  try {
    const file =
      await fs.readFile(filePath);

    return new NextResponse(file, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control":
          "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Watermark file could not be read.",
      },
      { status: 404 },
    );
  }
}
