"use client";

/* eslint-disable @next/next/no-img-element -- previews of our own proofing photos */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { prepareProofUpload } from "./ProofingUpload";

type CoverPhoto = {
  id: string;
  filename: string;
  imageUrl: string;
};

type Props = {
  galleryId: string;
  /** The chosen cover, if any. */
  cover: CoverPhoto | null;
  /** The gallery's photos to choose from (may be empty). */
  images: CoverPhoto[];
  /** A photo uploaded just for the cover, if there is one. */
  uploadedCover: CoverPhoto | null;
  variant?: "sidebar" | "panel";
};

async function coverApi<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/admin/proofing/cover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string } & T;
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "The cover couldn't be saved.");
  }
  return data;
}

/**
 * The gallery cover. Works before any photos are uploaded: the "+" offers
 * "Choose from gallery" or "Upload an image" (a photo just for the cover,
 * which isn't added to the gallery itself).
 */
export default function ProofingCoverPicker({
  galleryId,
  cover,
  images,
  uploadedCover,
  variant = "sidebar",
}: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);

  // Close the little menu when clicking elsewhere.
  useEffect(() => {
    if (!menuOpen) return;
    function close(event: MouseEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  async function choose(coverImageId: string | null) {
    setChooserOpen(false);
    setMenuOpen(false);
    setBusy("Saving…");
    setMessage("");
    try {
      await coverApi({ action: "set", galleryId, coverImageId });
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The cover couldn't be saved.");
    } finally {
      setBusy("");
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setMessage("Please choose a JPEG, PNG or WebP photo.");
      return;
    }
    setMenuOpen(false);
    setBusy("Uploading cover…");
    setMessage("");
    try {
      const prepared = await prepareProofUpload(file);
      const { coverId, uploadUrl } = await coverApi<{ coverId: string; uploadUrl: string }>({
        action: "presign",
        galleryId,
      });
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/webp" },
        body: prepared.file,
      });
      if (!put.ok) throw new Error("The cover couldn't be uploaded. Please try again.");
      await coverApi({
        action: "commit",
        galleryId,
        coverId,
        originalFilename: file.name,
        width: prepared.width,
        height: prepared.height,
      });
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The cover couldn't be uploaded.");
    } finally {
      setBusy("");
    }
  }

  // The uploaded cover is offered alongside the gallery's photos.
  const options = uploadedCover && !images.some((image) => image.id === uploadedCover.id)
    ? [uploadedCover, ...images]
    : images;

  return (
    <div className={`proofing-cover-picker proofing-cover-picker-${variant}`} ref={wrapper}>
      <div className="proofing-cover-frame">
        {cover ? (
          <>
            <img src={cover.imageUrl} alt="Gallery cover" />
            <button
              type="button"
              className="proofing-cover-change"
              disabled={Boolean(busy)}
              onClick={() => setMenuOpen((open) => !open)}
            >
              Change cover
            </button>
          </>
        ) : (
          <button
            type="button"
            className="proofing-cover-add"
            disabled={Boolean(busy)}
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="proofing-cover-plus" aria-hidden="true">+</span>
            <span>Add cover photo</span>
          </button>
        )}

        {busy ? <div className="proofing-cover-busy">{busy}</div> : null}

        {menuOpen ? (
          <div className="proofing-cover-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              disabled={options.length === 0}
              onClick={() => {
                setMenuOpen(false);
                setChooserOpen(true);
              }}
            >
              Choose from gallery
              {options.length === 0 ? <small>No photos uploaded yet</small> : null}
            </button>
            <button type="button" role="menuitem" onClick={() => fileInput.current?.click()}>
              Upload an image
              <small>Just for the cover, not added to the gallery</small>
            </button>
            {cover ? (
              <button type="button" role="menuitem" className="proofing-cover-menu-remove" onClick={() => void choose(null)}>
                Remove cover
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          void upload(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {message ? <p className="proofing-cover-message" role="alert">{message}</p> : null}

      {chooserOpen ? (
        <div className="proofing-dup-backdrop" role="presentation" onClick={() => setChooserOpen(false)}>
          <div
            className="proofing-cover-chooser"
            role="dialog"
            aria-modal="true"
            aria-label="Choose a cover photo"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="proofing-cover-chooser-head">
              <h2>Choose a cover photo</h2>
              <button type="button" aria-label="Close" onClick={() => setChooserOpen(false)}>×</button>
            </div>
            <div className="proofing-cover-chooser-grid">
              {options.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  className={image.id === cover?.id ? "is-current" : ""}
                  onClick={() => void choose(image.id)}
                  title={image.filename}
                >
                  <img src={image.imageUrl} alt="" loading="lazy" />
                  <span>{image.id === uploadedCover?.id ? "Uploaded cover" : image.filename}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
