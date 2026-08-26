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
};

type FavouriteResponse = {
  ok: boolean;
  favourite?: boolean;
  favourites?: string[];
  message?: string;
};

export default function ProofingGalleryClient({
  gallerySlug,
  images,
  initialFavourites,
}: ProofingGalleryClientProps) {
  const [favourites, setFavourites] =
    useState<string[]>(initialFavourites);

  const [updatingImageId, setUpdatingImageId] =
    useState<string | null>(null);

  const favouriteSet = useMemo(
    () => new Set(favourites),
    [favourites],
  );

  async function toggleFavourite(
    imageId: string,
  ) {
    if (updatingImageId) {
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

  return (
    <>
      <div className="proofing-client-live-summary">
        <span>
          {images.length} photograph
          {images.length === 1 ? "" : "s"}
        </span>

        <span>
          ♥ {favourites.length} favourite
          {favourites.length === 1 ? "" : "s"}
        </span>
      </div>

      <section
        className="proofing-client-grid"
        aria-label="Proofing photographs"
      >
        {images.map((image) => {
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
                  aria-pressed={isFavourite}
                  aria-label={
                    isFavourite
                      ? `Remove ${image.originalFilename} from favourites`
                      : `Add ${image.originalFilename} to favourites`
                  }
                  disabled={isUpdating}
                  onClick={() =>
                    toggleFavourite(image.id)
                  }
                >
                  <span aria-hidden="true">
                    {isFavourite ? "♥" : "♡"}
                  </span>
                </button>
              </div>

              <figcaption className="proofing-client-filename">
                {image.originalFilename}
              </figcaption>
            </figure>
          );
        })}
      </section>
    </>
  );
}