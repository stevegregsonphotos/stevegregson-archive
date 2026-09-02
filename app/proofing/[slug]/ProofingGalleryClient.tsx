"use client";

import {
  useEffect,
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
  introMessage?: string;
  showIntroOnLoad?: boolean;
  downloadPermission:
    | "none"
    | "web"
    | "selected";
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
  introMessage,
  showIntroOnLoad = false,
  downloadPermission,
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

  const [viewerImageId, setViewerImageId] =
    useState<string | null>(null);

  const [showIntro, setShowIntro] =
    useState(
      Boolean(
        showIntroOnLoad &&
        introMessage,
      ),
    );

  useEffect(() => {
    if (!showIntroOnLoad) {
      return;
    }

    window.history.replaceState(
      null,
      "",
      `/proofing/${encodeURIComponent(
        gallerySlug,
      )}`,
    );
  }, [gallerySlug, showIntroOnLoad]);

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

  const viewerImageIndex = viewerImageId
    ? visibleImages.findIndex(
        (image) => image.id === viewerImageId,
      )
    : -1;

  const viewerImage =
    viewerImageIndex >= 0
      ? visibleImages[viewerImageIndex]
      : null;

  const previousViewerImage =
    viewerImageIndex > 0
      ? visibleImages[viewerImageIndex - 1]
      : null;

  const nextViewerImage =
    viewerImageIndex >= 0 &&
    viewerImageIndex < visibleImages.length - 1
      ? visibleImages[viewerImageIndex + 1]
      : null;

  useEffect(() => {
    if (!viewerImage) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setViewerImageId(null);
        return;
      }

      if (
        event.key === "ArrowLeft" &&
        previousViewerImage
      ) {
        setViewerImageId(previousViewerImage.id);
        return;
      }

      if (
        event.key === "ArrowRight" &&
        nextViewerImage
      ) {
        setViewerImageId(nextViewerImage.id);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    viewerImage,
    previousViewerImage,
    nextViewerImage,
  ]);

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
      {showIntro && introMessage ? (
        <div
          className="proofing-intro-modal-backdrop"
          role="presentation"
        >
          <section
            className="proofing-intro-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="proofing-intro-title"
          >
            <p className="proofing-client-eyebrow">
              Private Client Gallery
            </p>

            <h2 id="proofing-intro-title">
              Before you begin
            </h2>

            <p className="proofing-intro-modal-message">
              {introMessage}
            </p>

            <button
              type="button"
              onClick={() => setShowIntro(false)}
            >
              View photographs
            </button>
          </section>
        </div>
      ) : null}
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
                  <button
                    type="button"
                    className="proofing-client-image-open"
                    aria-label={`View ${image.originalFilename}`}
                    onClick={() =>
                      setViewerImageId(image.id)
                    }
                  >
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
                  </button>

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
        {viewerImage ? (
          <div
            className="proofing-viewer"
            role="dialog"
            aria-modal="true"
            aria-label="Photograph viewer"
          >
            <button
              type="button"
              className="proofing-viewer-close"
              aria-label="Close photograph"
              onClick={() => setViewerImageId(null)}
            >
              ×
            </button>

            {previousViewerImage ? (
              <button
                type="button"
                className="proofing-viewer-nav proofing-viewer-previous"
                aria-label="Previous photograph"
                onClick={() =>
                  setViewerImageId(previousViewerImage.id)
                }
              >
                ‹
              </button>
            ) : null}

            <div className="proofing-viewer-stage">
              <img
                src={`/api/proofing/image?gallery=${encodeURIComponent(
                  gallerySlug,
                )}&image=${encodeURIComponent(
                  viewerImage.id,
                )}`}
                alt={viewerImage.alt}
                className="proofing-viewer-image"
              />

              <div className="proofing-viewer-actions">
                <div className="proofing-viewer-actions">
                  <button
                    type="button"
                    className={
                      favouriteSet.has(viewerImage.id)
                        ? "proofing-viewer-favourite is-favourite"
                        : "proofing-viewer-favourite"
                    }
                    aria-pressed={favouriteSet.has(
                      viewerImage.id,
                    )}
                    disabled={
                      updatingImageId === viewerImage.id ||
                      isSubmitting
                    }
                    onClick={() =>
                      toggleFavourite(viewerImage.id)
                    }
                  >
                    <span aria-hidden="true">
                      {favouriteSet.has(viewerImage.id)
                        ? "♥"
                        : "♡"}
                    </span>

                    {favouriteSet.has(viewerImage.id)
                      ? "Favourite"
                      : "Add to favourites"}
                  </button>

                  {downloadPermission === "web" ||
                  (downloadPermission === "selected" &&
                    favouriteSet.has(viewerImage.id)) ? (
                    <a
                      className="proofing-viewer-download"
                      href={`/api/proofing/download?gallery=${encodeURIComponent(
                        gallerySlug,
                      )}&image=${encodeURIComponent(
                        viewerImage.id,
                      )}`}
                    >
                      Download
                    </a>
                  ) : null}
                </div>

              </div>
            </div>

            {nextViewerImage ? (
              <button
                type="button"
                className="proofing-viewer-nav proofing-viewer-next"
                aria-label="Next photograph"
                onClick={() =>
                  setViewerImageId(nextViewerImage.id)
                }
              >
                ›
              </button>
            ) : null}
          </div>
        ) : null}

    </>
  );
}