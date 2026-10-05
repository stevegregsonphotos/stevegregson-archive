import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import { NextResponse } from "next/server";

import { getProofingGalleries } from "../../../../../../lib/proofing/repository";
import {
  deleteProofingWatermarkRecord,
  getProofingWatermark,
  renameProofingWatermark,
} from "../../../../../../lib/proofing/watermarks";
import { deleteProofingWatermark } from "../../../../../../lib/proofing/watermark-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/** Rename or delete a proofing watermark from the Watermarks page. */
export async function POST(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  try {
    const body = (await request.json()) as {
      action?: unknown;
      id?: unknown;
      name?: unknown;
    };

    const action = stringValue(body.action);
    const id = stringValue(body.id);

    if (!id) {
      return NextResponse.json(
        { ok: false, message: "Choose a watermark." },
        { status: 400 },
      );
    }

    const watermark = await getProofingWatermark(id);

    if (!watermark) {
      return NextResponse.json(
        { ok: false, message: "That watermark no longer exists." },
        { status: 404 },
      );
    }

    if (action === "rename") {
      const name = stringValue(body.name)
        .replace(/\s+/g, " ")
        .slice(0, 100);

      if (!name) {
        return NextResponse.json(
          { ok: false, message: "Give the watermark a name." },
          { status: 400 },
        );
      }

      const renamed = await renameProofingWatermark(id, name);

      return NextResponse.json({ ok: true, watermark: renamed });
    }

    if (action === "delete") {
      // Never pull a watermark out from under a gallery that uses it.
      const usedBy = (await getProofingGalleries())
        .filter((gallery) => gallery.watermarkId === id)
        .map((gallery) => gallery.title);

      if (usedBy.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            usedBy,
            message:
              `This watermark is used by ${usedBy.length === 1 ? "a gallery" : `${usedBy.length} galleries`}: ${usedBy.join(", ")}. ` +
              "Choose a different watermark in that gallery's settings first, then delete it.",
          },
          { status: 409 },
        );
      }

      await deleteProofingWatermarkRecord(id);

      try {
        await deleteProofingWatermark(watermark.filename);
      } catch (storageError) {
        // The watermark is already gone from Backstage; a leftover file is harmless.
        console.error("Watermark file could not be removed from R2:", storageError);
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, message: "Unknown watermark action." },
      { status: 400 },
    );
  } catch (error) {
    console.error("Watermark change failed:", error);

    return NextResponse.json(
      { ok: false, message: "The watermark could not be changed. Please try again." },
      { status: 500 },
    );
  }
}
