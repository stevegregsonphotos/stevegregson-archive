import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getProofingGalleryBySlug,
  updateProofingGallery,
} from "../../../../lib/proofing/repository";

import {
  sendProofingSubmissionEmails,
} from "../../../../lib/proofing/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubmitSelectionRequest = {
  gallerySlug?: string;
};

export async function POST(
  request: NextRequest,
) {
  let payload: SubmitSelectionRequest;

  try {
    payload =
      (await request.json()) as SubmitSelectionRequest;
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

  if (!gallerySlug) {
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
    await getProofingGalleryBySlug(gallerySlug);

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
   * Existing visitor sessions must not
   * bypass gallery availability rules.
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

  const visitorId =
    request.cookies.get(
      `proofing_${gallery.id}`,
    )?.value;

  if (!visitorId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Please enter your email address to access this gallery.",
      },
      {
        status: 401,
      },
    );
  }

  const visitor =
    gallery.visitors.find(
      (candidate) =>
        candidate.id === visitorId,
    );

  if (!visitor) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Your gallery session could not be found.",
      },
      {
        status: 401,
      },
    );
  }

  if (
    visitor.selection.favourites.length === 0
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Please select at least one photograph before submitting.",
      },
      {
        status: 400,
      },
    );
  }

  /*
   * Build the Lightroom-ready filename list
   * before updating the gallery.
   */

  const selectedFilenames =
    visitor.selection.favourites
      .map((favourite) => {
        const image = gallery.images.find(
          (candidate) =>
            candidate.id ===
            favourite.imageId,
        );

        return image?.originalFilename;
      })
      .filter(
        (filename): filename is string =>
          Boolean(filename),
      );
      const isUpdate =
  Boolean(visitor.selection.submittedAt);

  const now = new Date().toISOString();

  /*
   * IMPORTANT:
   *
   * Save the client's selection BEFORE
   * attempting to send email.
   *
   * Email delivery must never determine
   * whether the selection itself succeeds.
   */

  const updatedGallery =
    await updateProofingGallery(
      gallery.id,
      (currentGallery) => ({
        ...currentGallery,

        visitors:
          currentGallery.visitors.map(
            (currentVisitor) =>
              currentVisitor.id === visitorId
                ? {
                    ...currentVisitor,

                    lastSeenAt: now,

                    selection: {
  ...currentVisitor.selection,

  status: "submitted",

  /*
   * Freeze a snapshot of exactly what the
   * client submitted at this moment.
   *
   * Their working favourites may subsequently
   * change without altering this confirmed
   * selection.
   */
  submittedFavourites:
    currentVisitor.selection.favourites.map(
      (favourite) => ({
        ...favourite,
      }),
    ),

  submittedAt: now,
},
                  }
                : currentVisitor,
          ),
      }),
    );

  if (!updatedGallery) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Selection could not be submitted.",
      },
      {
        status: 500,
      },
    );
  }

  /*
   * The submission is now safely stored.
   *
   * Email is a secondary notification.
   * If it fails, log the problem but still
   * return a successful submission response.
   */

  let emailSent = false;

  try {
    await sendProofingSubmissionEmails({
  galleryTitle: gallery.title,
  clientEmail: visitor.email,
  filenames: selectedFilenames,
  submittedAt: now,
  isUpdate,
});

    emailSent = true;
  } catch (error) {
    console.error(
      "Proofing submission email failed:",
      error,
    );
  }

  return NextResponse.json({
    ok: true,
    submittedAt: now,
    emailSent,
  });
}