"use client";

import {
  FormEvent,
  useState,
} from "react";

type ProofingGalleryEntryProps = {
  gallerySlug: string;
  title: string;
  clientName?: string;
  venue?: string;
  coverImageUrl?: string;
};

type EntryResponse = {
  ok: boolean;
  message?: string;
};

export default function ProofingGalleryEntry({
  gallerySlug,
  title,
  clientName,
  venue,
  coverImageUrl,
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

      window.location.assign(
        `/proofing/${encodeURIComponent(
          gallerySlug,
        )}?welcome=1`,
      );
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
    <section className="proofing-entry">
      {coverImageUrl ? (
        <img
          src={coverImageUrl}
          alt=""
          className="proofing-entry-cover"
        />
      ) : null}

      <div className="proofing-entry-overlay" />

      <div className="proofing-entry-content">
        <div className="proofing-entry-copy-block">
          <p className="proofing-client-eyebrow">
            Private Client Gallery
          </p>

          <h1>{title}</h1>

          <p className="proofing-entry-meta">
            {clientName ?? "Client gallery"}

            {venue ? (
              <>
                <span aria-hidden="true">
                  {" "}
                  ·{" "}
                </span>

                {venue}
              </>
            ) : null}
          </p>
        </div>

        <form
          className="proofing-entry-form"
          onSubmit={handleSubmit}
        >
          <div>
            <label htmlFor="proofing-email">
              Email address
            </label>

            <p className="proofing-entry-form-help">
              Enter your email address to view the
              gallery and save your selections.
            </p>
          </div>

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
              : "Continue"}
          </button>
        </form>
      </div>
    </section>
  );
}