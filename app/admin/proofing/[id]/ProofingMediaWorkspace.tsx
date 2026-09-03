"use client";

import {
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import ProofingImageActions from "./ProofingImageActions";
import ProofingImageSort from "./ProofingImageSort";
import ProofingUpload from "./ProofingUpload";

type MediaImage = {
  id: string;
  originalFilename: string;
  alt: string;
  createdAt?: string;
  sortOrder: number;
  imageUrl: string;
  isCover: boolean;
};

type Props = {
  galleryId: string;
  introMessage: string;
  images: MediaImage[];
};

type DeleteResponse = {
  ok: boolean;
  message?: string;
};

export default function ProofingMediaWorkspace({
  galleryId,
  introMessage,
  images,
}: Props) {
  const router = useRouter();

  const [selectedIds, setSelectedIds] =
    useState<Set<string>>(
      () => new Set(),
    );

  const [isDeleting, setIsDeleting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const allSelected =
    images.length > 0 &&
    selectedIds.size === images.length;

  const selectedCount =
    selectedIds.size;

  const selectedNames = useMemo(
    () =>
      images
        .filter((image) =>
          selectedIds.has(image.id),
        )
        .map(
          (image) =>
            image.originalFilename,
        ),
    [images, selectedIds],
  );

  function toggleImage(
    imageId: string,
  ) {
    if (isDeleting) {
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }

      return next;
    });
  }

  function toggleAll() {
    if (isDeleting) {
      return;
    }

    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(
      new Set(
        images.map(
          (image) => image.id,
        ),
      ),
    );
  }

  function clearSelection() {
    if (isDeleting) {
      return;
    }

    setSelectedIds(new Set());
  }

  async function deleteSelected() {
    if (
      selectedIds.size === 0 ||
      isDeleting
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete ${selectedIds.size} selected photograph${
          selectedIds.size === 1
            ? ""
            : "s"
        } from this gallery?`,
      );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage("");

    try {
      for (const imageId of selectedIds) {
        const response = await fetch(
          "/api/admin/proofing/delete-image",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              galleryId,
              imageId,
            }),
          },
        );

        const data =
          (await response.json()) as DeleteResponse;

        if (!response.ok || !data.ok) {
          throw new Error(
            data.message ??
              "A photograph could not be deleted.",
          );
        }
      }

      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The selected photographs could not be deleted.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="sp-workspace-panel">
      <div className="sp-workspace-toolbar">
        {selectedCount > 0 ? (
          <div className="sp-media-selection-summary">
            <strong>
              {selectedCount} selected
            </strong>

            <button
              type="button"
              onClick={clearSelection}
              disabled={isDeleting}
            >
              Clear
            </button>
          </div>
        ) : (
          <div>
            <h2>All Media</h2>

            <span>
              {images.length} item
              {images.length === 1
                ? ""
                : "s"}
            </span>
          </div>
        )}

        <div className="sp-workspace-toolbar-actions">
          {images.length > 0 ? (
            <button
              type="button"
              className="sp-media-select-all"
              onClick={toggleAll}
              disabled={isDeleting}
            >
              {allSelected
                ? "Deselect All"
                : "Select All"}
            </button>
          ) : null}

          {selectedCount > 0 ? (
            <button
              type="button"
              className="sp-media-delete-selected"
              onClick={() =>
                void deleteSelected()
              }
              disabled={isDeleting}
              title={
                selectedNames.length
                  ? selectedNames.join(
                      "\n",
                    )
                  : undefined
              }
            >
              {isDeleting
                ? "Deleting…"
                : `Delete ${selectedCount}`}
            </button>
          ) : (
            <>
              <ProofingImageSort
                galleryId={galleryId}
                images={images.map(
                  (image) => ({
                    id: image.id,
                    originalFilename:
                      image.originalFilename,
                    createdAt:
                      image.createdAt,
                    sortOrder:
                      image.sortOrder,
                  }),
                )}
              />

              <ProofingUpload
                galleryId={galleryId}
              />
            </>
          )}
        </div>
      </div>

      {errorMessage ? (
        <div
          className="sp-media-bulk-error"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}

      {images.length === 0 ? (
        <div className="sp-media-empty">
          <h3>No photographs yet</h3>

          <p>
            Upload photographs to begin
            building this client gallery.
          </p>

          <ProofingUpload
            galleryId={galleryId}
          />
        </div>
      ) : (
        <div className="sp-media-grid">
          {images.map((image) => {
            const isSelected =
              selectedIds.has(
                image.id,
              );

            return (
              <article
                key={image.id}
                className={`sp-media-card${
                  isSelected
                    ? " is-selected"
                    : ""
                }`}
              >
                <div className="sp-media-card-image">
                  <button
                    type="button"
                    className="sp-media-select-image"
                    aria-label={
                      isSelected
                        ? `Deselect ${image.originalFilename}`
                        : `Select ${image.originalFilename}`
                    }
                    aria-pressed={
                      isSelected
                    }
                    onClick={() =>
                      toggleImage(
                        image.id,
                      )
                    }
                  >
                    <span
                      className="sp-media-selection-check"
                      aria-hidden="true"
                    >
                      {isSelected
                        ? "✓"
                        : ""}
                    </span>
                  </button>

                  <img
                    src={image.imageUrl}
                    alt={image.alt}
                    loading="lazy"
                  />

                  <div className="sp-media-card-actions">
                    <ProofingImageActions
                      galleryId={
                        galleryId
                      }
                      imageId={
                        image.id
                      }
                      introMessage={
                        introMessage
                      }
                      isCover={
                        image.isCover
                      }
                    />
                  </div>
                </div>

                <p className="sp-media-card-filename">
                  {
                    image.originalFilename
                  }
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
