import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getProofingGalleryBaseBySlug,
  signInProofingVisitor,
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
    await getProofingGalleryBaseBySlug(
      gallerySlug,
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

  /*
   * Each visitor is their own small record, so hundreds of people signing
   * in at once never wait on (or overwrite) each other.
   */
  let visitorId = "";
  try {
    visitorId = await signInProofingVisitor(
      gallery.id,
      email,
    );
  } catch (error) {
    console.error("Proofing sign-in failed:", error);
  }

  if (!visitorId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Gallery access could not be created. Please try again.",
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