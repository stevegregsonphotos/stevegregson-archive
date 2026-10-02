"use client";

import ImageEditor from "@/components/admin/image-editor/ImageEditor";

import { libraryFullUrl, type CategoryId, type EditResult, type SelectedWorkImage } from "./pipeline";

/**
 * The old "Edit image" modal (crop aspect, zoom, pan, brightness, auto
 * strength). Always edits from the original upload, as before.
 */
export default function LibraryEditModal({
  category,
  image,
  onCancel,
  onApply,
}: {
  category: CategoryId;
  image: SelectedWorkImage;
  onCancel: () => void;
  onApply: (result: EditResult) => void | Promise<unknown>;
}) {
  const sourceFilename = image.originalFilename ?? image.filename;

  return (
    <ImageEditor
      source={`${libraryFullUrl(category, sourceFilename)}?editor=1`}
      filename={sourceFilename}
      initialSettings={{
        aspect: image.editAspect ?? "original",
        zoom: image.editZoom ?? 1,
        panX: image.editPanX ?? 0,
        panY: image.editPanY ?? 0,
        brightness: image.editBrightness ?? 100,
        autoStrength: image.editAutoStrength ?? 0,
      }}
      onCancel={onCancel}
      onApply={async (result) => {
        await onApply(result);
      }}
    />
  );
}
