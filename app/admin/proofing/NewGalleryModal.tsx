"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";


import type { ProofingContact } from "@/lib/proofing/types";
type Props = {
  createGallery: (
    formData: FormData,
  ) => Promise<void>;
  contacts: ProofingContact[];
};

function todayForInput() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1,
  ).padStart(2, "0");
  const day = String(
    now.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function NewGalleryModal({
  createGallery,
  contacts,
}: Props) {
  const [open, setOpen] = useState(false);

  const dialogRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="sp-galleries-new"
        onClick={() => setOpen(true)}
      >
        New Gallery
      </button>

      {open ? (
        <div
          className="sp-create-gallery-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setOpen(false);
            }
          }}
        >
          <div
            ref={dialogRef}
            className="sp-create-gallery-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sp-create-gallery-title"
          >
            <div className="sp-create-gallery-heading">
              <h2 id="sp-create-gallery-title">
                Create Gallery
              </h2>

              <button
                type="button"
                className="sp-create-gallery-close"
                aria-label="Close"
                onClick={() =>
                  setOpen(false)
                }
              >
                ×
              </button>
            </div>

            <form
              action={createGallery}
              className="sp-create-gallery-form"
            >
              <div className="sp-create-gallery-row">
                <div className="sp-create-gallery-field">
                  <label htmlFor="modal-title">
                    Gallery Name
                    <span>*</span>
                  </label>

                  <input
                    id="modal-title"
                    name="title"
                    type="text"
                    autoFocus
                    required
                  />
                </div>

                <div className="sp-create-gallery-field">
                  <label htmlFor="modal-shoot-date">
                    Shoot Date
                    <span>*</span>
                  </label>

                  <input
                    id="modal-shoot-date"
                    name="shootDate"
                    type="date"
                    defaultValue={todayForInput()}
                    required
                  />
                </div>
              </div>

              <div className="sp-create-gallery-field">
                <label htmlFor="modal-client">
                  Client
                </label>

                <input
                  id="modal-client"
                  name="clientName"
                  type="text"
                />
              </div>

              <p className="sp-create-gallery-note">
                Gallery URL, presentation,
                watermark and delivery settings
                can be adjusted after creation.
              </p>

              <div className="sp-create-gallery-actions">
                <button
                  type="button"
                  className="sp-create-gallery-cancel"
                  onClick={() =>
                    setOpen(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="sp-create-gallery-submit"
                >
                  Create Gallery
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
