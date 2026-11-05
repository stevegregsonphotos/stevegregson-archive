import type {
  ProofingGallery,
} from "./types";

/**
 * The gallery's chosen cover: either one of its photos or a photo
 * uploaded just for the cover. Undefined when no cover has been chosen.
 */
export function getChosenCover(
  gallery: Pick<ProofingGallery, "coverImageId" | "coverUpload" | "images">,
): { id: string; webFilename: string } | undefined {
  const coverId = gallery.coverImageId;

  if (!coverId) {
    return undefined;
  }

  if (gallery.coverUpload?.id === coverId) {
    return gallery.coverUpload;
  }

  return gallery.images.find(
    (image) => image.id === coverId,
  );
}

/** Cover-only uploads have ids starting with this, never a gallery photo. */
export const COVER_UPLOAD_PREFIX = "cover-";
