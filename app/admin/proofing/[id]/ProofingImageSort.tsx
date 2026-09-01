"use client";

import {
  useState,
} from "react";
import { useRouter } from "next/navigation";

type SortImage = {
  id: string;
  originalFilename: string;
  createdAt?: string;
  sortOrder: number;
};

type ProofingImageSortProps = {
  galleryId: string;
  images: SortImage[];
};

type SortOption =
  | "filename-asc"
  | "filename-desc"
  | "created-asc"
  | "created-desc";

type SortResponse = {
  ok: boolean;
  message?: string;
};

export default function ProofingImageSort({
  galleryId,
  images,
}: ProofingImageSortProps) {
  const router = useRouter();

  const [isSaving, setIsSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  async function sortImages(
    option: SortOption,
  ) {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    const sortedImages = [...images];

    if (option === "filename-asc") {
      sortedImages.sort((a, b) =>
        a.originalFilename.localeCompare(
          b.originalFilename,
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          },
        ),
      );
    }

    if (option === "filename-desc") {
      sortedImages.sort((a, b) =>
        b.originalFilename.localeCompare(
          a.originalFilename,
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          },
        ),
      );
    }

    if (
      option === "created-asc" ||
      option === "created-desc"
    ) {
      sortedImages.sort((a, b) => {
        const aTime = a.createdAt
          ? new Date(a.createdAt).getTime()
          : Number.NaN;

        const bTime = b.createdAt
          ? new Date(b.createdAt).getTime()
          : Number.NaN;

        const aHasDate =
          Number.isFinite(aTime);

        const bHasDate =
          Number.isFinite(bTime);

        if (!aHasDate && !bHasDate) {
          return a.sortOrder - b.sortOrder;
        }

        if (!aHasDate) {
          return 1;
        }

        if (!bHasDate) {
          return -1;
        }

        return option === "created-asc"
          ? aTime - bTime
          : bTime - aTime;
      });
    }

    try {
      const response = await fetch(
        "/api/admin/proofing/reorder-images",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            galleryId,
            imageIds: sortedImages.map(
              (image) => image.id,
            ),
          }),
        },
      );

      const data =
        (await response.json()) as SortResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.message ??
            "The photograph order could not be saved.",
        );
      }

      const scrollPosition = window.scrollY;

router.refresh();

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    window.scrollTo({
      top: scrollPosition,
      behavior: "instant",
    });
  });
});
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The photograph order could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="proofing-image-sort">
      <label htmlFor="proofing-image-sort">
        Sort photographs
      </label>

      <select
        id="proofing-image-sort"
        defaultValue=""
        disabled={
          isSaving || images.length < 2
        }
        onChange={(event) => {
          const value =
            event.target
              .value as SortOption;

          if (value) {
            void sortImages(value);
          }

          event.target.value = "";
        }}
      >
        <option value="" disabled>
          {isSaving
            ? "Saving order..."
            : "Choose order"}
        </option>

        <option value="filename-asc">
          Filename — A to Z
        </option>

        <option value="filename-desc">
          Filename — Z to A
        </option>

        <option value="created-asc">
          Date / time — oldest first
        </option>

        <option value="created-desc">
          Date / time — newest first
        </option>
      </select>

      {errorMessage ? (
        <p
          className="proofing-image-sort-error"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
