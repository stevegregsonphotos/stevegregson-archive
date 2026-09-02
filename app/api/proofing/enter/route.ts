import crypto from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getProofingGalleryBySlug,
  updateProofingGallery,
} from "../../../../lib/proofing/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EnterGalleryRequest = {
  gallerySlug?: string;
  email?: string;
};

function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

function looksLikeEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email,
  );
}

export async function POST(
  request: NextRequest,
) {
  let payload: EnterGalleryRequest;

  try {
    payload =
      (await request.json()) as EnterGalleryRequest;
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

  const gallerySlug =
    payload.gallerySlug?.trim() ?? "";

  const email = normaliseEmail(
    payload.email ?? "",
  );

  if (!gallerySlug || !looksLikeEmail(email)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Please enter a valid email address.",
      },
      {
        status: 400,
      },
    );
  }

  const gallery =
    getProofingGalleryBySlug(gallerySlug);

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
   * Do not create visitor sessions for galleries
   * that are not currently available.
   */
  const hasExpiredByDate =
    Boolean(gallery.expiresAt) &&
    new Date(
      gallery.expiresAt as string,
    ).getTime() < Date.now();

  if (
    gallery.status !== "live" ||
    hasExpiredByDate
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "This gallery is not currently available.",
      },
      { status: 403 },
    );
  }

  let visitorId = "";

  const updatedGallery =
    updateProofingGallery(
      gallery.id,
      (currentGallery) => {
        const visitors =
          currentGallery.visitors ?? [];

        const existingVisitor =
          visitors.find(
            (visitor) =>
              visitor.email === email,
          );

        const now =
          new Date().toISOString();

        if (existingVisitor) {
          visitorId = existingVisitor.id;

          return {
            ...currentGallery,

            visitors: visitors.map(
              (visitor) =>
                visitor.id ===
                existingVisitor.id
                  ? {
                      ...visitor,
                      lastSeenAt: now,
                    }
                  : visitor,
            ),
          };
        }

        visitorId = crypto.randomUUID();

        return {
          ...currentGallery,

          visitors: [
            ...visitors,
            {
              id: visitorId,
              email,
              createdAt: now,
              lastSeenAt: now,

              selection: {
                status: "not-started",
                favourites: [],
              },
            },
          ],
        };
      },
    );

  if (!updatedGallery || !visitorId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Gallery access could not be created.",
      },
      {
        status: 500,
      },
    );
  }

  const response = NextResponse.json({
    ok: true,
  });

  response.cookies.set(
    `proofing_${gallery.id}`,
    visitorId,
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV ===
        "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    },
  );

  return response;
}