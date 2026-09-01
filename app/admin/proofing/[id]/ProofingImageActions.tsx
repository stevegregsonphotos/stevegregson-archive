"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
} from "react";

type ProofingImageActionsProps = {
  galleryId: string;
  imageId: string;
  introMessage: string;
  isCover: boolean;
};

type ActionResponse = {
  ok: boolean;
  message?: string;
};

export default function ProofingImageActions({
  galleryId,
  imageId,
  introMessage,
  isCover,
}: ProofingImageActionsProps) {
  const router = useRouter();
  const menuRef =
    useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] =
    useState(false);

  const [isSaving, setIsSaving] =
    useState(false);

  const [isDeleting, setIsDeleting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeMenu(
      event: MouseEvent,
    ) {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node,
        )
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      closeMenu,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        closeMenu,
      );
    };
  }, [isOpen]);

  async function setAsCover() {
    if (
      isCover ||
      isSaving ||
      isDeleting
    ) {
      return;
    }

    setIsOpen(false);
    setIsSaving(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        "/api/admin/proofing/presentation",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            galleryId,
            introMessage,
            coverImageId: imageId,
          }),
        },
      );

      const data =
        (await response.json()) as ActionResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.message ??
            "The gallery cover could not be changed.",
        );
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The gallery cover could not be changed.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteImage() {
    if (isSaving || isDeleting) {
      return;
    }

    setIsOpen(false);

    const confirmed = window.confirm(
      isCover
        ? "Delete this photograph? It is currently the gallery cover and will also be removed as the cover."
        : "Delete this photograph from the gallery?",
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage("");

    try {
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
        (await response.json()) as ActionResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.message ??
            "The photograph could not be deleted.",
        );
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The photograph could not be deleted.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div
      className="proofing-image-actions"
      ref={menuRef}
    >
      {isCover ? (
        <span className="proofing-image-cover-badge">
          Cover
        </span>
      ) : null}

      <div className="proofing-image-menu">
        <button
          type="button"
          className="proofing-image-menu-trigger"
          onClick={() =>
            setIsOpen((current) => !current)
          }
          disabled={
            isSaving || isDeleting
          }
          aria-label="Photograph options"
          aria-expanded={isOpen}
        >
          •••
        </button>

        {isOpen ? (
          <div className="proofing-image-menu-popover">
            {!isCover ? (
              <button
                type="button"
                onClick={setAsCover}
              >
                Set as cover
              </button>
            ) : null}

            <button
              type="button"
              className="proofing-image-menu-delete"
              onClick={deleteImage}
            >
              Delete photograph
            </button>
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <span
          className="proofing-image-action-error"
          role="alert"
        >
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}
