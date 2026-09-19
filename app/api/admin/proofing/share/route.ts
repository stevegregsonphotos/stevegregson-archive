import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  sendProofingGalleryShareEmails,
} from "@/lib/proofing/email";
import {
  getProofingGallery,
} from "@/lib/proofing/repository";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShareRequest = {
  galleryId?: unknown;
};

export async function POST(
  request: Request,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  let body: ShareRequest;

  try {
    body =
      (await request.json()) as ShareRequest;
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
        message: "Gallery is required.",
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
        message: "Gallery not found.",
      },
      {
        status: 404,
      },
    );
  }

  const recipients =
    gallery.recipients ?? [];

  if (recipients.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "No recipients have been added to this gallery.",
      },
      {
        status: 400,
      },
    );
  }

  if (gallery.status !== "live") {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Make the gallery live before sharing it.",
      },
      {
        status: 409,
      },
    );
  }

  try {
    const origin =
      new URL(request.url).origin;

    const galleryUrl =
      `${origin}/proofing/${encodeURIComponent(
        gallery.slug,
      )}`;

    const result =
      await sendProofingGalleryShareEmails({
        galleryTitle:
          gallery.title,
        galleryUrl,
        recipients:
          recipients.map(
            (recipient) => ({
              email:
                recipient.email,
              name:
                recipient.name,
            }),
          ),
      });

    return NextResponse.json({
      ok: true,
      sent: result.sent,
      message:
        `Gallery sent to ${result.sent} recipient${
          result.sent === 1
            ? ""
            : "s"
        }.`,
    });
  } catch (error) {
    console.error(
      "Proofing gallery share failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Gallery could not be shared.",
      },
      {
        status: 500,
      },
    );
  }
}
