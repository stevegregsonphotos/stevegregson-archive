"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import ProofingWatermarkOverlay from "./ProofingWatermarkOverlay";

type ProofingClientImage = {
  id: string;
  originalFilename: string;
  alt: string;
  width: number;
  height: number;
};

type ProofingView =
  | "all"
  | "favourites"
  | "consolidated";

type ConsolidatedClientSelection = {
  title: string;
  participantCount: number;
  definitiveImageIds: string[];
  images: Array<{
    imageId: string;
    labels: string[];
    participantCount: number;
    selectedByAll: boolean;
  }>;
};

type OrientationFilter =
  | "all"
  | "landscape"
  | "portrait";

type ProofingGalleryClientProps = {
  gallerySlug: string;
  introMessage?: string;
  showIntroOnLoad?: boolean;
  downloadPermission:
    | "none"
    | "web"
    | "selected";
  showFilenames?: boolean;
  watermarkUrl?: string;
  watermarkPosition?:
    | "top-left"
    | "top-center"
    | "top-right"
    | "center-left"
    | "center"
    | "center-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right";
  watermarkSize?: number;
  watermarkOpacity?: number;
  images: ProofingClientImage[];
  initialFavourites: string[];
  initialSelectionStatus?: string;
  initialSubmittedAt?: string;
  initialSubmittedFavourites: string[];
  consolidatedSelection?: ConsolidatedClientSelection;
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

type ConsolidatedFavouriteResponse = {
  ok: boolean;
  selected?: boolean;
  definitiveImageIds?: string[];
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
  showFilenames = false,
  watermarkUrl,
  watermarkPosition,
  watermarkSize,
  watermarkOpacity,
  images,
  initialFavourites,
  initialSelectionStatus = "not-started",
  initialSubmittedAt,
  initialSubmittedFavourites,
  consolidatedSelection,
}: ProofingGalleryClientProps) {
  const [favourites, setFavourites] =
    useState<string[]>(initialFavourites);

  const [
    definitiveImageIds,
    setDefinitiveImageIds,
  ] = useState<string[]>(
    consolidatedSelection
      ?.definitiveImageIds ?? [],
  );

  const [
    updatingDefinitiveImageId,
    setUpdatingDefinitiveImageId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    submittedFavourites,
    setSubmittedFavourites,
  ] = useState<string[]>(
    initialSubmittedFavourites,
  );

  const [updatingImageId, setUpdatingImageId] =
    useState<string | null>(null);

  const [view, setView] =
    useState<ProofingView>("all");

  const [
    orientationFilter,
    setOrientationFilter,
  ] = useState<OrientationFilter>("all");

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search,
    );

    if (params.get("view") === "favourites") {
      setView("favourites");
    } else if (
      params.get("view") === "consolidated" &&
      consolidatedSelection
    ) {
      setView("consolidated");
    }
  }, [consolidatedSelection]);

  useEffect(() => {
    if (
      view !== "consolidated" ||
      !consolidatedSelection ||
      updatingDefinitiveImageId
    ) {
      return;
    }

    const controller =
      new AbortController();

    async function refreshDefinitiveSelection() {
      try {
        const response =
          await fetch(
            `/api/proofing/consolidated-favourite?gallerySlug=${encodeURIComponent(
              gallerySlug,
            )}`,
            {
              method: "GET",
              signal:
                controller.signal,
              cache: "no-store",
            },
          );

        if (!response.ok) {
          return;
        }

        const data =
          (await response.json()) as
            ConsolidatedFavouriteResponse;

        if (
          !data.ok ||
          !Array.isArray(
            data.definitiveImageIds,
          )
        ) {
          return;
        }

        setDefinitiveImageIds(
          (current) =>
            sameSelection(
              current,
              data.definitiveImageIds ?? [],
            )
              ? current
              : data.definitiveImageIds ?? [],
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Definitive selection refresh failed.",
          error,
        );
      }
    }

    void refreshDefinitiveSelection();

    const intervalId =
      window.setInterval(
        () => {
          void refreshDefinitiveSelection();
        },
        3000,
      );

    return () => {
      controller.abort();
      window.clearInterval(
        intervalId,
      );
    };
  }, [
    view,
    consolidatedSelection,
    gallerySlug,
    updatingDefinitiveImageId,
  ]);

  function changeView(
    nextView: ProofingView,
  ) {
    setView(nextView);

    const url = new URL(window.location.href);

    if (nextView === "favourites") {
      url.searchParams.set(
        "view",
        "favourites",
      );
    } else if (
      nextView === "consolidated"
    ) {
      url.searchParams.set(
        "view",
        "consolidated",
      );
    } else {
      url.searchParams.delete("view");
    }

    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }

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

  const [isDownloadingArchive, setIsDownloadingArchive] =
    useState(false);

  const [downloadError, setDownloadError] =
    useState<string | null>(null);

  const [viewerImageId, setViewerImageId] =
    useState<string | null>(null);

  const viewerTouchStartX =
    useRef<number | null>(null);

  const viewerTouchStartY =
    useRef<number | null>(null);

  const viewerDialogRef =
    useRef<HTMLDivElement | null>(null);

  const viewerPreviousFocusRef =
    useRef<HTMLElement | null>(null);

  function handleViewerTouchStart(
    event: React.TouchEvent<HTMLDivElement>,
  ) {
    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    viewerTouchStartX.current =
      touch.clientX;
    viewerTouchStartY.current =
      touch.clientY;
  }

  function handleViewerTouchEnd(
    event: React.TouchEvent<HTMLDivElement>,
  ) {
    const touch = event.changedTouches[0];

    if (
      !touch ||
      viewerTouchStartX.current === null ||
      viewerTouchStartY.current === null
    ) {
      return;
    }

    const distanceX =
      touch.clientX -
      viewerTouchStartX.current;

    const distanceY =
      touch.clientY -
      viewerTouchStartY.current;

    viewerTouchStartX.current = null;
    viewerTouchStartY.current = null;

    const minimumSwipeDistance = 40;

    if (
      Math.abs(distanceX) <=
      Math.abs(distanceY)
    ) {
      return;
    }

    if (
      distanceX <= -minimumSwipeDistance &&
      nextViewerImage
    ) {
      setViewerImageId(nextViewerImage.id);
      return;
    }

    if (
      distanceX >= minimumSwipeDistance &&
      previousViewerImage
    ) {
      setViewerImageId(
        previousViewerImage.id,
      );
    }
  }

  function handleViewerTouchCancel() {
    viewerTouchStartX.current = null;
    viewerTouchStartY.current = null;
  }

  const [showIntro, setShowIntro] =
    useState(
      Boolean(
        showIntroOnLoad &&
        introMessage,
      ),
    );

  const introDialogRef =
    useRef<HTMLElement | null>(null);

  const firstGalleryControlRef =
    useRef<HTMLButtonElement | null>(null);

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

  useEffect(() => {
    if (!showIntro || !introMessage) {
      return;
    }

    const introButton =
      introDialogRef.current?.querySelector<HTMLButtonElement>(
        "button",
      );

    introButton?.focus();

    function handleIntroKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setShowIntro(false);
        return;
      }

      if (
        event.key === "Tab" &&
        introDialogRef.current
      ) {
        const focusableElements = Array.from(
          introDialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
          ),
        );

        if (focusableElements.length > 0) {
          const firstElement = focusableElements[0];
          const lastElement =
            focusableElements[focusableElements.length - 1];

          if (
            event.shiftKey &&
            document.activeElement === firstElement
          ) {
            event.preventDefault();
            lastElement.focus();
          } else if (
            !event.shiftKey &&
            document.activeElement === lastElement
          ) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    }

    window.addEventListener(
      "keydown",
      handleIntroKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleIntroKeyDown,
      );

      window.setTimeout(() => {
        firstGalleryControlRef.current?.focus();
      }, 0);
    };
  }, [showIntro, introMessage]);


  const isViewerOpen =
    viewerImageId !== null;

  useEffect(() => {
    if (!isViewerOpen) {
      return;
    }

    viewerPreviousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const closeButton =
      viewerDialogRef.current?.querySelector<HTMLButtonElement>(
        ".proofing-viewer-close",
      );

    closeButton?.focus();

    const scrollY = window.scrollY;

    const previousBodyPosition =
      document.body.style.position;
    const previousBodyTop =
      document.body.style.top;
    const previousBodyWidth =
      document.body.style.width;
    const previousBodyOverflow =
      document.body.style.overflow;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.position =
        previousBodyPosition;
      document.body.style.top =
        previousBodyTop;
      document.body.style.width =
        previousBodyWidth;
      document.body.style.overflow =
        previousBodyOverflow;

      window.scrollTo(0, scrollY);
      viewerPreviousFocusRef.current?.focus();
    };
  }, [isViewerOpen]);

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

  const consolidatedImageIdSet =
    useMemo(
      () =>
        new Set(
          consolidatedSelection?.images.map(
            (image) =>
              image.imageId,
          ) ?? [],
        ),
      [consolidatedSelection],
    );

  const consolidatedImages =
    useMemo(
      () =>
        images.filter((image) =>
          consolidatedImageIdSet.has(
            image.id,
          ),
        ),
      [
        images,
        consolidatedImageIdSet,
      ],
    );

  const consolidatedMetadataByImageId =
    useMemo(
      () =>
        new Map(
          consolidatedSelection
            ?.images.map(
              (image) => [
                image.imageId,
                image,
              ],
            ) ?? [],
        ),
      [consolidatedSelection],
    );

  const definitiveImageIdSet =
    useMemo(
      () =>
        new Set(
          definitiveImageIds,
        ),
      [definitiveImageIds],
    );

  const definitiveImages =
    useMemo(
      () =>
        images.filter((image) =>
          definitiveImageIdSet.has(
            image.id,
          ),
        ),
      [
        images,
        definitiveImageIdSet,
      ],
    );

  const orientationMatches = (
    image: ProofingClientImage,
  ) => {
    if (orientationFilter === "all") {
      return true;
    }

    const isPortrait =
      image.height > image.width;

    return orientationFilter === "portrait"
      ? isPortrait
      : !isPortrait;
  };

  const activeViewImages =
    view === "favourites"
      ? favouriteImages
      : view === "consolidated"
        ? consolidatedImages
        : images;

  const visibleImages =
    activeViewImages.filter(
      orientationMatches,
    );

  const landscapeCount =
    activeViewImages.filter(
      (image) =>
        image.width >= image.height,
    ).length;

  const portraitCount =
    activeViewImages.length -
    landscapeCount;

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
        event.preventDefault();
        setViewerImageId(null);
        return;
      }

      if (
        event.key === "ArrowLeft" &&
        previousViewerImage
      ) {
        event.preventDefault();
        setViewerImageId(previousViewerImage.id);
        return;
      }

      if (
        event.key === "ArrowRight" &&
        nextViewerImage
      ) {
        event.preventDefault();
        setViewerImageId(nextViewerImage.id);
        return;
      }

      if (
        event.key === "Tab" &&
        viewerDialogRef.current
      ) {
        const focusableElements = Array.from(
          viewerDialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
          ),
        );

        if (focusableElements.length > 0) {
          const firstElement = focusableElements[0];
          const lastElement =
            focusableElements[focusableElements.length - 1];

          if (
            event.shiftKey &&
            document.activeElement === firstElement
          ) {
            event.preventDefault();
            lastElement.focus();
          } else if (
            !event.shiftKey &&
            document.activeElement === lastElement
          ) {
            event.preventDefault();
            firstElement.focus();
          }
        }
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

    const previousFavourites =
      favourites;

    const wasFavourite =
      previousFavourites.includes(
        imageId,
      );

    const optimisticFavourites =
      wasFavourite
        ? previousFavourites.filter(
            (id) => id !== imageId,
          )
        : [
            ...previousFavourites,
            imageId,
          ];

    setFavourites(
      optimisticFavourites,
    );

    setSelectionStatus(
      optimisticFavourites.length > 0
        ? "in-progress"
        : "not-started",
    );

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
      setFavourites(
        previousFavourites,
      );

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

  async function toggleDefinitiveSelection(
    imageId: string,
  ) {
    if (
      updatingDefinitiveImageId
    ) {
      return;
    }

    const previous =
      definitiveImageIds;

    const alreadySelected =
      previous.includes(
        imageId,
      );

    const optimistic =
      alreadySelected
        ? previous.filter(
            (id) =>
              id !== imageId,
          )
        : [
            ...previous,
            imageId,
          ];

    setDefinitiveImageIds(
      optimistic,
    );

    setUpdatingDefinitiveImageId(
      imageId,
    );

    try {
      const response =
        await fetch(
          "/api/proofing/consolidated-favourite",
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
        (await response.json()) as
          ConsolidatedFavouriteResponse;

      if (
        !response.ok ||
        !data.ok
      ) {
        throw new Error(
          data.message ??
            "Definitive selection could not be updated.",
        );
      }

      setDefinitiveImageIds(
        data.definitiveImageIds ??
          [],
      );
    } catch (error) {
      setDefinitiveImageIds(
        previous,
      );

      alert(
        error instanceof Error
          ? error.message
          : "Definitive selection could not be updated.",
      );
    } finally {
      setUpdatingDefinitiveImageId(
        null,
      );
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

  async function downloadArchive() {
    if (isDownloadingArchive) {
      return;
    }

    setIsDownloadingArchive(true);
    setDownloadError(null);

    try {
      const response = await fetch(
        `/api/proofing/download-all?gallery=${encodeURIComponent(
          gallerySlug,
        )}`,
        {
          cache: "no-store",
        },
      );

      const result =
        (await response.json()) as {
          ok?: boolean;
          message?: string;
          archiveFilename?: string;
          files?: Array<{
            filename: string;
            url: string;
          }>;
        };

      if (
        !response.ok ||
        !result.ok ||
        !result.archiveFilename ||
        !Array.isArray(result.files)
      ) {
        throw new Error(
          result.message ||
            "The photographs could not be prepared for download.",
        );
      }

      const { default: JSZip } =
        await import("jszip");

      const zip = new JSZip();
      const concurrency = 4;

      for (
        let index = 0;
        index < result.files.length;
        index += concurrency
      ) {
        const batch = result.files.slice(
          index,
          index + concurrency,
        );

        const downloaded = await Promise.all(
          batch.map(async (file) => {
            const fileResponse =
              await fetch(file.url);

            if (!fileResponse.ok) {
              throw new Error(
                `Could not download ${file.filename}.`,
              );
            }

            return {
              filename: file.filename,
              blob: await fileResponse.blob(),
            };
          }),
        );

        for (const file of downloaded) {
          zip.file(
            file.filename,
            file.blob,
          );
        }
      }

      const archive =
        await zip.generateAsync({
          type: "blob",
          compression: "STORE",
        });

      const objectUrl =
        URL.createObjectURL(archive);

      try {
        const link =
          document.createElement("a");
        link.href = objectUrl;
        link.download =
          result.archiveFilename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : "The photographs could not be downloaded.",
      );
    } finally {
      setIsDownloadingArchive(false);
    }
  }

  const toolbarAction =
    favourites.length === 0
      ? null
      : hasPendingChanges
        ? {
            label: "Send changes",
            status: "Changes not sent",
          }
        : isSelectionCurrent
          ? {
              label: null,
              status: `✓ ${submittedFavourites.length} favourite${
                submittedFavourites.length === 1
                  ? ""
                  : "s"
              } sent`,
            }
          : {
              label: "Send favourites",
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
            ref={introDialogRef}
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
  <div className="proofing-client-toolbar-primary">
    <span
      className="proofing-client-toolbar-rule"
      aria-hidden="true"
    />

    <div className="proofing-client-view-controls">
    <button
      ref={firstGalleryControlRef}
      type="button"
      className={
        view === "all"
          ? "is-active"
          : ""
      }
      aria-pressed={view === "all"}
      onClick={() => changeView("all")}
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
      aria-pressed={view === "favourites"}
      onClick={() =>
        changeView("favourites")
      }
    >
      Favourites
      <span>
        ♥ {favourites.length}
      </span>
    </button>

    {consolidatedSelection ? (
      <button
        type="button"
        className={
          view === "consolidated"
            ? "is-active"
            : ""
        }
        aria-pressed={
          view === "consolidated"
        }
        onClick={() =>
          changeView(
            "consolidated",
          )
        }
      >
        Consolidated
        <span>
          {
            consolidatedImages.length
          }
        </span>
      </button>
    ) : null}
    </div>

    <span
      className="proofing-client-toolbar-rule"
      aria-hidden="true"
    />
  </div>

  <div className="proofing-client-toolbar-secondary">
    <div
      className="proofing-client-orientation-controls"
    aria-label="Filter photographs by orientation"
  >
    <button
      type="button"
      className={
        orientationFilter === "all"
          ? "is-active"
          : ""
      }
      aria-pressed={
        orientationFilter === "all"
      }
      onClick={() =>
        setOrientationFilter("all")
      }
    >
      All
      <span>{images.length}</span>
    </button>

    <button
      type="button"
      className={
        orientationFilter === "landscape"
          ? "is-active"
          : ""
      }
      aria-pressed={
        orientationFilter === "landscape"
      }
      onClick={() =>
        setOrientationFilter(
          "landscape",
        )
      }
    >
      Landscape
      <span>{landscapeCount}</span>
    </button>

    <button
      type="button"
      className={
        orientationFilter === "portrait"
          ? "is-active"
          : ""
      }
      aria-pressed={
        orientationFilter === "portrait"
      }
      onClick={() =>
        setOrientationFilter(
          "portrait",
        )
      }
    >
      Portrait
      <span>{portraitCount}</span>
    </button>
    </div>
  </div>

    {(downloadPermission === "web" && view === "all") ||
    (view === "favourites" &&
      (toolbarAction ||
        (downloadPermission === "selected" &&
          favourites.length > 0))) ? (
    <div className="proofing-client-toolbar-submit">
      {downloadPermission === "web" && view === "all" ? (
        <button
          type="button"
          className="proofing-toolbar-download-button"
          disabled={isDownloadingArchive}
          onClick={() => void downloadArchive()}
        >
          {isDownloadingArchive
            ? "Preparing download…"
            : `Download all ${images.length} photo${
                images.length === 1 ? "" : "s"
              }`}
        </button>
      ) : null}

      {downloadPermission === "selected" &&
      view === "favourites" &&
      favourites.length > 0 ? (
        <button
          type="button"
          className="proofing-toolbar-download-button"
          disabled={isDownloadingArchive}
          onClick={() => void downloadArchive()}
        >
          {isDownloadingArchive
            ? "Preparing download…"
            : `Download ${favourites.length} selected photo${
                favourites.length === 1 ? "" : "s"
              }`}
        </button>
      ) : null}

      {toolbarAction?.status ? (
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

      {toolbarAction?.label ? (
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
              : `Send ${favourites.length} favourite${
                    favourites.length === 1
                      ? ""
                      : "s"
                  }`}
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

      {downloadError ? (
        <p
          className="proofing-submit-error proofing-toolbar-submit-error"
          role="alert"
        >
          {downloadError}
        </p>
      ) : null}

      {view === "favourites" ? (
        <section className="proofing-review-header">
          <div>
            <p className="proofing-client-eyebrow">
              Your selection
            </p>

            <h2>
              Selected photographs
              <span className="proofing-review-count">
                {favourites.length}
              </span>
            </h2>

            <p className="proofing-review-copy">
              Review your chosen photographs below.
              You can add or remove images until you
              are happy with your selection.
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
                ✓ Favourites sent
              </strong>

              <span>
                {submittedFavourites.length} photograph
                {submittedFavourites.length === 1
                  ? ""
                  : "s"}{" "}
                sent
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

      {view === "consolidated" &&
      consolidatedSelection ? (
        <section className="proofing-review-header">
          <div>
            <p className="proofing-client-eyebrow">
              Consolidated selection
            </p>

            <h2>
              {consolidatedSelection.title}
              <span className="proofing-review-count">
                {
                  consolidatedImages.length
                }
              </span>
            </h2>

            <p className="proofing-review-copy">
              This view combines the selections
              from the participants chosen for
              this gallery. Photographs selected
              by more than one participant are
              highlighted. Use the hearts to
              create the final shared selection
              — changes are visible to everyone
              with access to this gallery.
            </p>
          </div>

          <div className="proofing-consolidated-definitive-summary">
            <strong>
              {definitiveImageIds.length}
            </strong>

            <span>
              definitive selection
              {definitiveImageIds.length ===
              1
                ? ""
                : "s"}
            </span>

          </div>
        </section>
      ) : null}

      {view === "favourites" &&
      favouriteImages.length === 0 ? (
        <div className="proofing-review-empty">
          <p>
            You haven't selected any
            photographs yet.
          </p>

          <button
            type="button"
            onClick={() => changeView("all")}
          >
            View photographs
          </button>
        </div>
      ) : null}

      <section
        className="proofing-client-grid"
        aria-label={
          view === "favourites"
            ? "Favourite photographs"
            : view === "consolidated"
              ? "Consolidated photographs"
              : "Proofing photographs"
        }
        hidden={
          view === "favourites" &&
          favouriteImages.length === 0
        }
      >
        {images.map((image) => {
          const isFavourite =
            favouriteSet.has(image.id);

          const consolidatedMetadata =
            consolidatedMetadataByImageId.get(
              image.id,
            );

          const isDefinitive =
            definitiveImageIdSet.has(
              image.id,
            );

          const hiddenFromView =
            (
              view === "favourites" &&
              !isFavourite
            ) ||
            (
              view === "consolidated" &&
              !consolidatedImageIdSet.has(
                image.id,
              )
            ) ||
            !orientationMatches(image);

          return (
            <figure
              key={image.id}
              className="proofing-client-card"
              hidden={hiddenFromView}
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

                  <ProofingWatermarkOverlay
                    url={watermarkUrl}
                    position={watermarkPosition}
                    size={watermarkSize}
                    opacity={watermarkOpacity}
                  />

                  {view === "consolidated" ? (
                    <button
                      type="button"
                      className={
                        isDefinitive
                          ? "proofing-favourite-button is-favourite"
                          : "proofing-favourite-button"
                      }
                      aria-pressed={
                        isDefinitive
                      }
                      aria-label={
                        isDefinitive
                          ? `Remove ${image.originalFilename} from definitive selection`
                          : `Add ${image.originalFilename} to definitive selection`
                      }
                      disabled={
                        updatingDefinitiveImageId !==
                        null
                      }
                      onClick={() =>
                        void toggleDefinitiveSelection(
                          image.id,
                        )
                      }
                    >
                      {isDefinitive ? (
                        <>
                          <span
                            className="proofing-selected-check"
                            aria-hidden="true"
                          >
                            ✓
                          </span>

                          <span className="proofing-selected-label">
                            Definitive
                          </span>
                        </>
                      ) : (
                        <span aria-hidden="true">
                          ♡
                        </span>
                      )}
                    </button>
                  ) : (
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
                        isSubmitting
                      }
                      onClick={() =>
                        toggleFavourite(
                          image.id,
                        )
                      }
                    >
                        {isFavourite ? (
                          <>
                            <span
                              className="proofing-selected-check"
                              aria-hidden="true"
                            >
                              ✓
                            </span>

                            <span className="proofing-selected-label">
                              Selected
                            </span>
                          </>
                        ) : (
                          <span aria-hidden="true">
                            ♡
                          </span>
                        )}
                    </button>
                  )}
                </div>

                {view === "consolidated" &&
                consolidatedMetadata ? (
                  <div className="proofing-consolidated-meta">
                    {consolidatedMetadata
                      .selectedByAll ? (
                      <strong className="proofing-consolidated-all">
                        Selected by all
                      </strong>
                    ) : (
                      <span>
                        Selected by{" "}
                        {
                          consolidatedMetadata
                            .participantCount
                        }{" "}
                        participant
                        {consolidatedMetadata
                          .participantCount ===
                        1
                          ? ""
                          : "s"}
                      </span>
                    )}

                    {consolidatedMetadata
                      .labels.length > 0 ? (
                      <span className="proofing-consolidated-labels">
                        {consolidatedMetadata.labels.join(
                          " · ",
                        )}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {(showFilenames ||
                  view ===
                    "consolidated") ? (
                  <figcaption className="proofing-client-filename">
                    {image.originalFilename}
                  </figcaption>
                ) : null}
              </figure>
            );
        })}
      </section>
        {viewerImage ? (
          <div
            ref={viewerDialogRef}
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

            <div
              className="proofing-viewer-stage"
              onTouchStart={handleViewerTouchStart}
              onTouchEnd={handleViewerTouchEnd}
              onTouchCancel={handleViewerTouchCancel}
            >
              <div className="proofing-viewer-image-wrap">
                <img
                  src={`/api/proofing/image?gallery=${encodeURIComponent(
                    gallerySlug,
                  )}&image=${encodeURIComponent(
                    viewerImage.id,
                  )}`}
                  alt={viewerImage.alt}
                  className="proofing-viewer-image"
                />

                <ProofingWatermarkOverlay
                  url={watermarkUrl}
                  position={watermarkPosition}
                  size={watermarkSize}
                  opacity={watermarkOpacity}
                />
              </div>

              <div className="proofing-viewer-actions">
                <div className="proofing-viewer-meta">
                  {(showFilenames ||
                    view ===
                      "consolidated") ? (
                    <span className="proofing-viewer-filename">
                      {viewerImage.originalFilename}
                    </span>
                  ) : null}

                  <span className="proofing-viewer-position">
                    {viewerImageIndex + 1}
                    {" / "}
                    {visibleImages.length}
                  </span>
                </div>

                <div className="proofing-viewer-action-buttons">
                  {view === "consolidated" ? (
                    <button
                      type="button"
                      className={
                        definitiveImageIdSet.has(
                          viewerImage.id,
                        )
                          ? "proofing-viewer-favourite is-favourite"
                          : "proofing-viewer-favourite"
                      }
                      aria-pressed={
                        definitiveImageIdSet.has(
                          viewerImage.id,
                        )
                      }
                      disabled={
                        updatingDefinitiveImageId !==
                        null
                      }
                      onClick={() =>
                        void toggleDefinitiveSelection(
                          viewerImage.id,
                        )
                      }
                    >
                      <span aria-hidden="true">
                        {definitiveImageIdSet.has(
                          viewerImage.id,
                        )
                          ? "♥"
                          : "♡"}
                      </span>

                      {definitiveImageIdSet.has(
                        viewerImage.id,
                      )
                        ? "Definitive selection"
                        : "Add to definitive selection"}
                    </button>
                  ) : (
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
                  )}

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
                      {downloadPermission === "selected"
                        ? "Download selected photo"
                        : "Download photo"}
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