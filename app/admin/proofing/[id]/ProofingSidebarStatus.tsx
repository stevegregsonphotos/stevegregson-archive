"use client";

import {
  useState,
} from "react";

import { useRouter } from "next/navigation";

type GalleryStatus =
  | "draft"
  | "live"
  | "expired"
  | "archived";

type ProofingSidebarStatusProps = {
  galleryId: string;
  initialStatus: GalleryStatus;
};

export default function ProofingSidebarStatus({
  galleryId,
  initialStatus,
}: ProofingSidebarStatusProps) {
  const router = useRouter();

  const [status, setStatus] =
    useState<GalleryStatus>(
      initialStatus,
    );

  const [isSaving, setIsSaving] =
    useState(false);

  async function changeStatus(
    nextStatus: GalleryStatus,
  ) {
    if (
      nextStatus === status ||
      isSaving
    ) {
      return;
    }

    const previousStatus =
      status;

    setStatus(nextStatus);
    setIsSaving(true);

    try {
      const response =
        await fetch(
          "/api/admin/proofing/status",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              galleryId,
              status: nextStatus,
            }),
          },
        );

      const data =
        (await response.json()) as {
          ok?: boolean;
          status?: GalleryStatus;
          message?: string;
        };

      if (
        !response.ok ||
        !data.ok ||
        !data.status
      ) {
        throw new Error(
          data.message ??
            "Gallery status could not be updated.",
        );
      }

      setStatus(
        data.status,
      );

      router.refresh();
    } catch (error) {
      setStatus(
        previousStatus,
      );

      alert(
        error instanceof Error
          ? error.message
          : "Gallery status could not be updated.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="sp-gallery-sidebar-status">
      <label
        htmlFor="proofing-sidebar-status"
      >
        Status
      </label>

      <select
        id="proofing-sidebar-status"
        value={status}
        disabled={isSaving}
        onChange={(event) =>
          void changeStatus(
            event.target
              .value as GalleryStatus,
          )
        }
        aria-label="Gallery status"
      >
        <option value="draft">
          Draft
        </option>
        <option value="live">
          Live
        </option>
        <option value="expired">
          Expired
        </option>
        <option value="archived">
          Archived
        </option>
      </select>
    </div>
  );
}
