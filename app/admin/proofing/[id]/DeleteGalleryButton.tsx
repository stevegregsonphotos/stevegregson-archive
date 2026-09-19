"use client";

import {
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

type DeleteGalleryButtonProps = {
  galleryId: string;
  galleryTitle: string;
};

export default function DeleteGalleryButton({
  galleryId,
  galleryTitle,
}: DeleteGalleryButtonProps) {
  const router = useRouter();

  const [
    isDeleting,
    setIsDeleting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  async function deleteGallery() {
    if (isDeleting) {
      return;
    }

    const confirmed =
      window.confirm(
        `Permanently delete "${galleryTitle}"?\n\nThis will delete the gallery, its client selections and its proofing photographs from storage. This cannot be undone.`,
      );

    if (!confirmed) {
      return;
    }

    setError(null);
    setIsDeleting(true);

    try {
      const response =
        await fetch(
          "/api/admin/proofing/delete-gallery",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              galleryId,
            }),
          },
        );

      const result =
        (await response.json()) as {
          ok?: boolean;
          message?: string;
        };

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ||
            "Gallery could not be deleted.",
        );
      }

      router.push(
        "/admin/proofing",
      );

      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Gallery could not be deleted.",
      );

      setIsDeleting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="sp-gallery-delete-link"
        disabled={isDeleting}
        onClick={deleteGallery}
      >
        {isDeleting
          ? "Deleting…"
          : "Delete Gallery"}
      </button>

      {error ? (
        <p
          role="alert"
          style={{
            marginTop: "0.5rem",
            maxWidth: "18rem",
            fontSize: "0.75rem",
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
