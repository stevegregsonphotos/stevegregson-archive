import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getProofingWatermark,
} from "../../../../../../lib/proofing/watermarks";

import {
  createProofingWatermarkDownloadUrl,
} from "../../../../../../lib/proofing/watermark-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

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
    await getProofingWatermark(id);

  if (!watermark) {
    return NextResponse.json(
      {
        ok: false,
        message: "Watermark not found.",
      },
      { status: 404 },
    );
  }

  try {
    return NextResponse.redirect(
      await createProofingWatermarkDownloadUrl(
        watermark.filename,
      ),
      302,
    );
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
