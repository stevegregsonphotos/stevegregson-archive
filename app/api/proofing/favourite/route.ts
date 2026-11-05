import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getProofingGalleryImageBySlug,
  updateProofingVisitor,
} from "../../../../lib/proofing/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FavouriteRequest = {
  gallerySlug?: string;
  imageId?: string;
};

export async function POST(
  request: NextRequest,
) {
  let payload: FavouriteRequest;

  try {
    payload =
      (await request.json()) as FavouriteRequest;
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

  const imageId =
    payload.imageId?.trim() ?? "";

  if (!gallerySlug || !imageId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Gallery and image are required.",
      },
      {
        status: 400,
      },
    );
  }

  const resolved =
    await getProofingGalleryImageBySlug(
      gallerySlug,
      imageId,
    );

  if (!resolved) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Gallery or image not found.",
      },
      {
        status: 404,
      },
    );
  }

  const { gallery } = resolved;

  /*
   * Identify the visitor from the secure
   * HTTP-only cookie created when they
   * entered their email address.
   */
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
    gallery.visitors?.find(
      (candidate) =>
        candidate.id === visitorId,
    );

  if (!visitor) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Your gallery session could not be found. Please enter the gallery again.",
      },
      {
        status: 401,
      },
    );
  }

  const now =
    new Date().toISOString();

  /*
   * Only this visitor's own record is read and saved. Whether it's already
   * a favourite is decided from the latest saved copy, so two quick clicks
   * can't get out of step.
   */
  let alreadyFavourite = false;

  const updatedVisitor =
    await updateProofingVisitor(
      gallery.id,
      visitorId,
      (currentVisitor) => {
        alreadyFavourite =
          currentVisitor.selection.favourites.some(
            (favourite) =>
              favourite.imageId === imageId,
          );

        const favourites =
          alreadyFavourite
            ? currentVisitor.selection.favourites.filter(
                (favourite) =>
                  favourite.imageId !==
                  imageId,
              )
            : [
                ...currentVisitor.selection
                  .favourites,
                {
                  imageId,
                  createdAt: now,
                },
              ];

        return {
          ...currentVisitor,

          lastSeenAt: now,

          selection: {
            /*
             * Preserve the previous submitted
             * snapshot and submittedAt.
             *
             * Only the working favourites and
             * current status change here.
             */
            ...currentVisitor.selection,

            favourites,

            status:
              favourites.length > 0
                ? "in-progress"
                : "not-started",
          },
        };
      },
    );

  if (!updatedVisitor) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Visitor selection could not be updated.",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,

    favourite: !alreadyFavourite,

    favourites:
      updatedVisitor.selection.favourites.map(
        (favourite) =>
          favourite.imageId,
      ),

    selectionStatus:
      updatedVisitor.selection.status,

    submittedAt:
      updatedVisitor.selection.submittedAt,

    submittedFavourites:
      updatedVisitor.selection.submittedFavourites?.map(
        (favourite) =>
          favourite.imageId,
      ) ?? [],
  });
}