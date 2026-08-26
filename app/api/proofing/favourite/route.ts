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
   * Identify the visitor from the secure
   * HTTP-only cookie created when they
   * entered their email address.
   */
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

  const imageExists =
    gallery.images.some(
      (image) => image.id === imageId,
    );

  if (!imageExists) {
    return NextResponse.json(
      {
        ok: false,
        message: "Image not found.",
      },
      {
        status: 404,
      },
    );
  }

  const alreadyFavourite =
    visitor.selection.favourites.some(
      (favourite) =>
        favourite.imageId === imageId,
    );

  const now =
    new Date().toISOString();

  const updatedGallery =
    updateProofingGallery(
      gallery.id,
      (currentGallery) => ({
        ...currentGallery,

        visitors:
          currentGallery.visitors.map(
            (currentVisitor) => {
              if (
                currentVisitor.id !== visitorId
              ) {
                return currentVisitor;
              }

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
          ),
      }),
    );

  if (!updatedGallery) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Gallery could not be updated.",
      },
      {
        status: 500,
      },
    );
  }

  const updatedVisitor =
    updatedGallery.visitors.find(
      (candidate) =>
        candidate.id === visitorId,
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