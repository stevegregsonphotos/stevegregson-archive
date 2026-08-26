"use client";

import {
  useState,
} from "react";

type PresentationImage = {
  id: string;
  filename: string;
  imageUrl: string;
};

type ProofingPresentationEditorProps = {
  galleryId: string;
  initialIntroMessage: string;
  initialCoverImageId: string | null;
  images: PresentationImage[];
};

type SaveResponse = {
  ok: boolean;
  message?: string;
};

export default function ProofingPresentationEditor({
  galleryId,
  initialIntroMessage,
  initialCoverImageId,
  images,
}: ProofingPresentationEditorProps) {
  const [introMessage, setIntroMessage] =
    useState(initialIntroMessage);

  const [coverImageId, setCoverImageId] =
    useState<string | null>(
      initialCoverImageId,
    );

  const [isSaving, setIsSaving] =
    useState(false);

  const [saveState, setSaveState] =
    useState<
      "idle" | "saved" | "error"
    >("idle");

  const [errorMessage, setErrorMessage] =
    useState("");

  async function savePresentation() {
    setIsSaving(true);
    setSaveState("idle");
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
            coverImageId,
          }),
        },
      );

      const data =
        (await response.json()) as SaveResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.message ??
            "Gallery presentation could not be saved.",
        );
      }

      setSaveState("saved");
    } catch (error) {
      setSaveState("error");

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gallery presentation could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="proofing-presentation-editor">
      <div className="proofing-presentation-field">
        <label htmlFor="proofing-intro-message">
          Gallery introduction
        </label>

        <p className="proofing-presentation-help">
          This message is shown to clients when
          they first open the gallery.
        </p>

        <textarea
          id="proofing-intro-message"
          value={introMessage}
          onChange={(event) => {
            setIntroMessage(
              event.target.value,
            );

            setSaveState("idle");
          }}
          rows={5}
          placeholder="Add a welcome message for your client…"
        />
      </div>

      <div className="proofing-presentation-field">
        <div className="proofing-presentation-field-heading">
          <div>
            <p className="proofing-presentation-label">
              Gallery cover
            </p>

            <p className="proofing-presentation-help">
              Choose one of the uploaded
              photographs as the client gallery
              cover.
            </p>
          </div>

          {coverImageId ? (
            <button
              type="button"
              className="proofing-cover-clear"
              onClick={() => {
                setCoverImageId(null);
                setSaveState("idle");
              }}
            >
              Remove cover
            </button>
          ) : null}
        </div>

        {images.length === 0 ? (
          <p className="proofing-empty">
            Upload photographs before choosing a
            gallery cover.
          </p>
        ) : (
          <div className="proofing-cover-grid">
            {images.map((image) => {
              const isSelected =
                image.id === coverImageId;

              return (
                <button
                  key={image.id}
                  type="button"
                  className={
                    isSelected
                      ? "proofing-cover-option proofing-cover-option-selected"
                      : "proofing-cover-option"
                  }
                  onClick={() => {
                    setCoverImageId(image.id);
                    setSaveState("idle");
                  }}
                  aria-pressed={isSelected}
                >
                  <span className="proofing-cover-image">
                    <img
                      src={image.imageUrl}
                      alt=""
                      loading="lazy"
                    />

                    {isSelected ? (
                      <span className="proofing-cover-selected-badge">
                        Cover
                      </span>
                    ) : null}
                  </span>

                  <span className="proofing-cover-filename">
                    {image.filename}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="proofing-presentation-save">
        <button
          type="button"
          onClick={savePresentation}
          disabled={isSaving}
          className="proofing-presentation-save-button"
        >
          {isSaving
            ? "Saving…"
            : saveState === "saved"
              ? "Saved ✓"
              : "Save gallery presentation"}
        </button>

        {saveState === "saved" ? (
          <p className="proofing-presentation-success">
            Gallery presentation saved.
          </p>
        ) : null}

        {saveState === "error" ? (
          <p
            className="proofing-presentation-error"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}