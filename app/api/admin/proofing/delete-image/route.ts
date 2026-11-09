import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import {
  deleteProofingImages,
} from "../../../../../lib/proofing/image-storage";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  deleteProofingImageRecords,
  listProofingImageFiles,
  updateProofingGallery,
} from "../../../../../lib/proofing/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeleteImageRequest = {
  galleryId?: string;
  imageId?: string;
  imageIds?: string[];
};

/*
 * Deletes one or many photos in a single request (Backstage › Delete
 * selected sends them in batches). Everything happens once per request,
 * not once per photo: one favourites/cover tidy, one database delete +
 * renumber, and the files removed in bulk.
 */
export async function POST(
  request: NextRequest,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  let payload: DeleteImageRequest;

  try {
    payload =
      (await request.json()) as DeleteImageRequest;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid request." },
      { status: 400 },
    );
  }

  const galleryId =
    payload.galleryId?.trim() ?? "";

  const requestedIds = [
    ...(Array.isArray(payload.imageIds)
      ? payload.imageIds
      : []),
    ...(payload.imageId ? [payload.imageId] : []),
  ]
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!galleryId || requestedIds.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Gallery and photograph are required.",
      },
      { status: 400 },
    );
  }

  if (requestedIds.length > 1000) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Please delete at most 1,000 photographs at a time.",
      },
      { status: 400 },
    );
  }

  const wanted = new Set(requestedIds);

  // Just ids + file names, not the whole gallery.
  const files = (
    await listProofingImageFiles(galleryId)
  ).filter((file) => wanted.has(file.id));

  if (files.length === 0) {
    // Already gone (e.g. a retried request): nothing to do.
    return NextResponse.json({
      ok: true,
      deleted: 0,
    });
  }

  const ids = new Set(files.map((file) => file.id));

  const updatedGallery =
    await updateProofingGallery(
      galleryId,
      (currentGallery) => ({
        ...currentGallery,

        visitors: currentGallery.visitors.map(
          (visitor) => ({
            ...visitor,
            selection: {
              ...visitor.selection,
              favourites:
                visitor.selection.favourites.filter(
                  (favourite) =>
                    !ids.has(favourite.imageId),
                ),
              submittedFavourites:
                visitor.selection.submittedFavourites?.filter(
                  (favourite) =>
                    !ids.has(favourite.imageId),
                ),
            },
          }),
        ),

        selection: currentGallery.selection
          ? {
              ...currentGallery.selection,
              favourites:
                currentGallery.selection.favourites.filter(
                  (favourite) =>
                    !ids.has(favourite.imageId),
                ),
              submittedFavourites:
                currentGallery.selection.submittedFavourites?.filter(
                  (favourite) =>
                    !ids.has(favourite.imageId),
                ),
            }
          : undefined,

        coverImageId:
          currentGallery.coverImageId &&
          ids.has(currentGallery.coverImageId)
            ? undefined
            : currentGallery.coverImageId,
      }),
    );

  if (!updatedGallery) {
    return NextResponse.json(
      { ok: false, message: "Gallery not found." },
      { status: 404 },
    );
  }

  await deleteProofingImageRecords(galleryId, [...ids]);

  try {
    await deleteProofingImages(
      galleryId,
      files.map((file) => file.webFilename),
    );
  } catch (error) {
    console.error(
      "Proofing image files could not be removed:",
      error,
    );
  }

  return NextResponse.json({
    ok: true,
    deleted: ids.size,
  });
}
