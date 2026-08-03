"use client";

import { useState } from "react";

type DeleteProductionPanelProps = {
  slug: string;
  title: string;
  hasUnsavedChanges: boolean;
};

type DeleteResult = {
  ok: boolean;
  message?: string;
  redirectTo?: string;
};

export default function DeleteProductionPanel({
  slug,
  title,
  hasUnsavedChanges,
}: DeleteProductionPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] =
    useState("");
  const [isDeleting, setIsDeleting] =
    useState(false);
  const [error, setError] = useState<string | null>(
    null,
  );

  async function deleteProduction() {
    if (
      confirmation !== "DELETE" ||
      isDeleting ||
      !slug
    ) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/admin/delete-production",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slug,
            confirmation,
          }),
        },
      );

      const data =
        (await response.json()) as DeleteResult;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.message ??
            "The production could not be deleted.",
        );
      }

      window.location.assign(
        data.redirectTo ?? "/archive",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The production could not be deleted.",
      );
      setIsDeleting(false);
    }
  }

  return (
    <section
      style={{
        maxWidth: "90rem",
        margin: "4rem auto 0",
        borderTop:
          "1px solid rgba(213, 164, 154, 0.45)",
        paddingTop: "2rem",
      }}
    >
      <p
        style={{
          margin: 0,
          color: "#d5a49a",
          fontSize: "0.55rem",
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        Danger zone
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "2rem",
          flexWrap: "wrap",
          marginTop: "1rem",
        }}
      >
        <div style={{ maxWidth: "48rem" }}>
          <h2
            style={{
              margin: 0,
              fontFamily:
                '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
              fontSize: "clamp(2rem, 4vw, 3.5rem)",
              fontWeight: 400,
            }}
          >
            Delete production
          </h2>

          <p
            style={{
              margin: "0.9rem 0 0",
              color: "rgba(242, 238, 230, 0.58)",
              lineHeight: 1.7,
            }}
          >
            Permanently delete {title}, its production
            file and every photograph in its image
            folder. This cannot be undone.
          </p>

          {hasUnsavedChanges ? (
            <p
              style={{
                margin: "0.8rem 0 0",
                color: "#d5a49a",
              }}
            >
              Unsaved editor changes will also be lost.
            </p>
          ) : null}
        </div>

        {!isOpen ? (
          <button
            type="button"
            className="backstage-button"
            onClick={() => {
              setIsOpen(true);
              setError(null);
            }}
            style={{
              borderColor:
                "rgba(213, 164, 154, 0.7)",
              color: "#d5a49a",
            }}
          >
            Delete production
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div
          style={{
            marginTop: "2rem",
            border:
              "1px solid rgba(213, 164, 154, 0.38)",
            padding: "1.25rem",
            background:
              "rgba(213, 164, 154, 0.04)",
          }}
        >
          <label className="backstage-field">
            <span className="backstage-field-label">
              Type DELETE to confirm
            </span>

            <input
              className="backstage-input"
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value);
                setError(null);
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          {error ? (
            <p
              role="alert"
              style={{
                margin: "1rem 0 0",
                color: "#ffb3a7",
              }}
            >
              {error}
            </p>
          ) : null}

          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
              marginTop: "1rem",
            }}
          >
            <button
              type="button"
              className="backstage-button"
              disabled={isDeleting}
              onClick={() => {
                setIsOpen(false);
                setConfirmation("");
                setError(null);
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              className="backstage-button"
              disabled={
                isDeleting || confirmation !== "DELETE"
              }
              onClick={deleteProduction}
              style={{
                borderColor:
                  "rgba(213, 164, 154, 0.8)",
                color: "#d5a49a",
              }}
            >
              {isDeleting
                ? "Deleting production…"
                : "Delete permanently"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
