"use client";

import {
  FormEvent,
  useState,
} from "react";

type ProofingGalleryEntryProps = {
  gallerySlug: string;
};

type EntryResponse = {
  ok: boolean;
  message?: string;
};

export default function ProofingGalleryEntry({
  gallerySlug,
}: ProofingGalleryEntryProps) {
  const [email, setEmail] =
    useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(
        "/api/proofing/enter",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            gallerySlug,
            email,
          }),
        },
      );

      const data =
        (await response.json()) as EntryResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.message ??
            "Gallery access could not be created.",
        );
      }

      /*
       * Reload the server page.
       * The new visitor cookie will now be
       * available to the Server Component.
       */
      window.location.reload();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Gallery access could not be created.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="proofing-entry">
      <div className="proofing-entry-inner">
        <p className="proofing-client-eyebrow">
          Private Client Gallery
        </p>

        <h1>Enter gallery</h1>

        <p className="proofing-entry-copy">
          Please enter your email address to
          view and select photographs.
        </p>

        <form
          className="proofing-entry-form"
          onSubmit={handleSubmit}
        >
          <label htmlFor="proofing-email">
            Email address
          </label>

          <input
            id="proofing-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            autoComplete="email"
            required
            placeholder="name@company.com"
          />

          {error ? (
            <p
              className="proofing-entry-error"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Entering…"
              : "Enter gallery"}
          </button>
        </form>
      </div>
    </div>
  );
}