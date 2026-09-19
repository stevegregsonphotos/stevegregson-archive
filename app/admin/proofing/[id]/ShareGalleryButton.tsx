"use client";

import { useState } from "react";

type ShareGalleryButtonProps = {
  galleryId: string;
  recipientCount: number;
};

export default function ShareGalleryButton({
  galleryId,
  recipientCount,
}: ShareGalleryButtonProps) {
  const [sending, setSending] =
    useState(false);

  const [message, setMessage] =
    useState("");

  async function shareGallery() {
    if (sending || recipientCount === 0) {
      return;
    }

    if (
      !window.confirm(
        `Send this gallery to ${recipientCount} recipient${
          recipientCount === 1 ? "" : "s"
        } now?`,
      )
    ) {
      return;
    }

    setSending(true);
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/proofing/share",
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
          sent?: number;
        };

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ||
            "Gallery could not be shared.",
        );
      }

      setMessage(
        result.message ||
          `Sent to ${result.sent ?? recipientCount} recipient${
            (result.sent ?? recipientCount) === 1
              ? ""
              : "s"
          }.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Gallery could not be shared.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="sp-gallery-share-link"
        disabled={
          sending ||
          recipientCount === 0
        }
        onClick={() =>
          void shareGallery()
        }
      >
        {sending
          ? "Sending…"
          : "Share Gallery"}
      </button>

      {message ? (
        <p
          style={{
            margin: "0.45rem 0 0",
            fontSize: "0.65rem",
          }}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
