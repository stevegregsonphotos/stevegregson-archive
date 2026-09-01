"use client";

import {
  useMemo,
  useState,
} from "react";

type ProofingClientImage = {
  id: string;
  originalFilename: string;
  alt: string;
};

type ProofingGalleryClientProps = {
  gallerySlug: string;
  images: ProofingClientImage[];
  initialFavourites: string[];
  initialSelectionStatus?: string;
  initialSubmittedAt?: string;
  initialSubmittedFavourites: string[];
};

type FavouriteResponse = {
  ok: boolean;
  favourite?: boolean;
  favourites?: string[];
  message?: string;
  selectionStatus?: string;
  submittedAt?: string;
  submittedFavourites?: string[];
};

type SubmitResponse = {
  ok: boolean;
  submittedAt?: string;
  message?: string;
};

function sameSelection(
  first: string[],
  second: string[],
) {
  if (first.length !== second.length) {
    return false;
  }

  const firstSet = new Set(first);

  return second.every((id) =>
    firstSet.has(id),
  );
}

export default function ProofingGalleryClient({
  gallerySlug,
  images,
  initialFavourites,
  initialSelectionStatus = "not-started",
  initialSubmittedAt,
  initialSubmittedFavourites,
}: ProofingGalleryClientProps) {
  const [favourites, setFavourites] =
    useState<string[]>(initialFavourites);

  const [
    submittedFavourites,
    setSubmittedFavourites,
  ] = useState<string[]>(
    initialSubmittedFavourites,
  );

  const [updatingImageId, setUpdatingImageId] =
    useState<string | null>(null);

  const [view, setView] =
    useState<"all" | "favourites">("all");

  const [selectionStatus, setSelectionStatus] =
    useState(initialSelectionStatus);

  const [submittedAt, setSubmittedAt] =
    useState<string | undefined>(
      initialSubmittedAt,
    );

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [submitError, setSubmitError] =
    useState<string | null>(null);

  const favouriteSet = useMemo(
    () => new Set(favourites),
    [favourites],
  );

  const favouriteImages = useMemo(
    () =>
      images.filter((image) =>
        favouriteSet.has(image.id),
      ),
    [images, favouriteSet],
  );

  const visibleImages =
    view === "favourites"
      ? favouriteImages
      : images;

  const hasSubmittedSelection =
    submittedFavourites.length > 0 &&
    Boolean(submittedAt);

  const hasPendingChanges =
    hasSubmittedSelection &&
    !sameSelection(
      favourites,
      submittedFavourites,
    );

  const isSelectionCurrent =
    hasSubmittedSelection &&
    sameSelection(
      favourites,
      submittedFavourites,
    );

  async function toggleFavourite(
    imageId: string,
  ) {
    if (updatingImageId || isSubmitting) {
      return;
    }

    setUpdatingImageId(imageId);

    try {
      const response = await fetch(
        "/api/proofing/favourite",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            gallerySlug,
            imageId,
          }),
        },
      );

      const data =
        (await response.json()) as FavouriteResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.message ??
            "Favourite could not be updated.",
        );
      }

      setFavourites(
        data.favourites ?? [],
      );

      setSelectionStatus(
        data.selectionStatus ??
          "in-progress",
      );

      if (
        data.submittedFavourites
      ) {
        setSubmittedFavourites(
          data.submittedFavourites,
        );
      }

      if (data.submittedAt) {
        setSubmittedAt(
          data.submittedAt,
        );
      }

      setSubmitError(null);
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Favourite could not be updated.",
      );
    } finally {
      setUpdatingImageId(null);
    }
  }

  async function submitSelection() {
    if (
      favourites.length === 0 ||
      isSubmitting
    ) {
      return;
    }

    const isUpdate =
      hasSubmittedSelection;

    const confirmed = window.confirm(
      isUpdate
        ? `Submit your updated selection of ${
            favourites.length
          } photograph${
            favourites.length === 1
              ? ""
              : "s"
          }?`
        : `Submit your selection of ${
            favourites.length
          } photograph${
            favourites.length === 1
              ? ""
              : "s"
          }?`,
    );

    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(
        "/api/proofing/submit",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            gallerySlug,
          }),
        },
      );

      const data =
        (await response.json()) as SubmitResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.message ??
            "Your selection could not be submitted.",
        );
      }

      setSelectionStatus("submitted");

      setSubmittedAt(
        data.submittedAt,
      );

      setSubmittedFavourites(
        [...favourites],
      );
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Your selection could not be submitted.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const toolbarAction =
    favourites.length === 0
      ? null
      : hasPendingChanges
        ? {
            label: "Submit changes",
            status: "Changes not submitted",
          }
        : isSelectionCurrent
          ? {
              label: null,
              status: "Selection submitted",
            }
          : {
              label: "Submit selection",
              status: null,
            };

  return (
    <>
      <div className="proofing-client-selection-toolbar">
  <div className="proofing-client-view-controls">
    <button
      type="button"
      className={
        view === "all"
          ? "is-active"
          : ""
      }
      onClick={() => setView("all")}
    >
      Photos
      <span>{images.length}</span>
    </button>

    <button
      type="button"
      className={
        view === "favourites"
          ? "is-active"
          : ""
      }
      onClick={() =>
        setView("favourites")
      }
    >
      Favourites
      <span>
        ♥ {favourites.length}
      </span>
    </button>
  </div>

  {toolbarAction ? (
    <div className="proofing-client-toolbar-submit">
      {toolbarAction.status ? (
        <span
          className={
            hasPendingChanges
              ? "proofing-toolbar-pending"
              : "proofing-toolbar-submitted"
          }
        >
          {toolbarAction.status}
        </span>
      ) : null}

      {toolbarAction.label ? (
        <button
          type="button"
          className="proofing-toolbar-submit-button"
          disabled={isSubmitting}
          onClick={submitSelection}
        >
          {isSubmitting
            ? "Sending…"
            : hasPendingChanges
              ? "Send changes"
              : "Send favourites"}
        </button>
      ) : null}
    </div>
  ) : null}
</div>

      {submitError && view === "all" ? (
        <p
          className="proofing-submit-error proofing-toolbar-submit-error"
          role="alert"
        >
          {submitError}
        </p>
      ) : null}

      {view === "favourites" ? (
        <section className="proofing-review-header">
          <div>
            <p className="proofing-client-eyebrow">
              Your selection
            </p>

            <h2>My favourites</h2>

            <p className="proofing-review-copy">
              Review your selected photographs
              below. You can remove photographs
              before submitting your final
              selection.
            </p>
          </div>

          {hasPendingChanges ? (
            <div className="proofing-submit-area">
              <strong className="proofing-pending-heading">
                Changes not submitted
              </strong>

              <p>
                Your last submitted selection
                remains unchanged until you
                submit these updates.
              </p>

              <button
                type="button"
                className="proofing-submit-button"
                disabled={isSubmitting}
                onClick={submitSelection}
              >
                {isSubmitting
                  ? "Submitting…"
                  : "Submit changes"}
              </button>

              {submitError ? (
                <p
                  className="proofing-submit-error"
                  role="alert"
                >
                  {submitError}
                </p>
              ) : null}
            </div>
          ) : isSelectionCurrent ? (
            <div className="proofing-submitted-state">
              <strong>
                Selection submitted
              </strong>

              <span>
                {submittedFavourites.length} photograph
                {submittedFavourites.length === 1
                  ? ""
                  : "s"}{" "}
                received
              </span>

              {submittedAt ? (
                <span>
                  {new Date(
                    submittedAt,
                  ).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="proofing-submit-area">
              <button
                type="button"
                className="proofing-submit-button"
                disabled={
                  favourites.length === 0 ||
                  isSubmitting
                }
                onClick={submitSelection}
              >
                {isSubmitting
                  ? "Submitting…"
                  : "Submit selection"}
              </button>

              {favourites.length > 0 ? (
                <p>
                  Submit{" "}
                  <strong>
                    {favourites.length}
                  </strong>{" "}
                  selected photograph
                  {favourites.length === 1
                    ? ""
                    : "s"}
                </p>
              ) : null}

              {submitError ? (
                <p
                  className="proofing-submit-error"
                  role="alert"
                >
                  {submitError}
                </p>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {view === "favourites" &&
      visibleImages.length === 0 ? (
        <div className="proofing-review-empty">
          <p>
            You haven't selected any
            photographs yet.
          </p>

          <button
            type="button"
            onClick={() => setView("all")}
          >
            View photographs
          </button>
        </div>
      ) : (
        <section
          className="proofing-client-grid"
          aria-label={
            view === "favourites"
              ? "Favourite photographs"
              : "Proofing photographs"
          }
        >
          {visibleImages.map((image) => {
            const isFavourite =
              favouriteSet.has(image.id);

            const isUpdating =
              updatingImageId === image.id;

            return (
              <figure
                key={image.id}
                className="proofing-client-card"
              >
                <div className="proofing-client-image-wrap">
                  <img
                    src={`/api/proofing/image?gallery=${encodeURIComponent(
                      gallerySlug,
                    )}&image=${encodeURIComponent(
                      image.id,
                    )}`}
                    alt={image.alt}
                    loading="lazy"
                    className="proofing-client-image"
                  />

                  <button
                    type="button"
                    className={
                      isFavourite
                        ? "proofing-favourite-button is-favourite"
                        : "proofing-favourite-button"
                    }
                    aria-pressed={
                      isFavourite
                    }
                    aria-label={
                      isFavourite
                        ? `Remove ${image.originalFilename} from favourites`
                        : `Add ${image.originalFilename} to favourites`
                    }
                    disabled={
                      isUpdating ||
                      isSubmitting
                    }
                    onClick={() =>
                      toggleFavourite(
                        image.id,
                      )
                    }
                  >
                    <span aria-hidden="true">
                      {isFavourite
                        ? "♥"
                        : "♡"}
                    </span>
                  </button>
                </div>

                
              </figure>
            );
          })}
        </section>
      )}
    </>
  );
}