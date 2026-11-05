"use client";

/* eslint-disable @next/next/no-img-element -- previews of our own photos at their real size */

import { useRef, useState } from "react";

import ImageEditor from "@/components/admin/image-editor/ImageEditor";
import type { ImageEditorSettings } from "@/lib/client-image-editor";
import { getSelectedWorkImageUrl } from "@/lib/selected-work-image-url";

type Portrait = {
  original: string;
  display: string;
  width: number;
  height: number;
  settings: ImageEditorSettings;
  updatedAt: string;
};

const DEFAULT_SRC = "/images/portrait/steve-gregson.webp";
const url = (filename: string) => getSelectedWorkImageUrl("about", filename);

async function api<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/admin/about-portrait", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({ ok: false, message: "Unexpected response." }));
  if (!data.ok) throw new Error(data.message || "Something went wrong.");
  return data as T;
}

async function upload(blob: Blob, kind: "original" | "display") {
  const contentType = blob.type || "image/jpeg";
  const { filename, uploadUrl } = await api<{ filename: string; uploadUrl: string }>({
    action: "presign",
    kind,
    contentType,
  });
  const response = await fetch(uploadUrl, {
    method: "PUT",
    // Must match the upload link exactly (it is signed with both).
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
    body: blob,
  });
  if (!response.ok) throw new Error("The photo couldn't be uploaded. Please try again.");
  return filename;
}

export default function AboutPhotoEditor({ initial }: { initial: Portrait | null }) {
  const [portrait, setPortrait] = useState<Portrait | null>(initial);
  // What the editor is working on: the saved original, or a newly chosen file.
  const [editing, setEditing] = useState<{ source: string | File; file?: File } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const shown = portrait ? url(portrait.display) : DEFAULT_SRC;

  function editCurrent() {
    setMessage("");
    setEditing({ source: portrait ? `${url(portrait.original)}?editor=1` : DEFAULT_SRC });
  }

  function chooseNew(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setMessage("Please choose a JPEG, PNG or WebP photo.");
      return;
    }
    setMessage("");
    setEditing({ source: file, file });
  }

  async function apply(result: { blob: Blob; width: number; height: number; settings: ImageEditorSettings }) {
    if (!editing) return;
    setBusy(true);
    setMessage("Saving…");
    try {
      // Keep an untouched original, so the photo can always be re-edited from scratch.
      let original = portrait && !editing.file ? portrait.original : "";
      if (!original) {
        const source = editing.file ?? (await (await fetch(DEFAULT_SRC)).blob());
        original = await upload(source, "original");
      }
      const display = await upload(result.blob, "display");
      const saved = await api<{ portrait: Portrait }>({
        action: "save",
        portrait: { original, display, width: result.width, height: result.height, settings: result.settings },
      });
      setPortrait(saved.portrait);
      setEditing(null);
      setMessage("Saved. The About page now shows this photo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't save the photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="about-photo-editor">
      <div className="about-photo-preview">
        <div className="about-photo-frame">
          <img src={shown} alt="The photo currently on the About page" />
        </div>
        <p className="about-photo-note">
          How it sits on the About page (black and white, like the page). On phones the frame is a little shorter.
        </p>
      </div>

      <div className="about-photo-actions">
        <button type="button" className="about-photo-primary" disabled={busy} onClick={editCurrent}>
          Edit this photo
        </button>
        <button type="button" className="about-photo-secondary" disabled={busy} onClick={() => fileInput.current?.click()}>
          Upload a new photo
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => {
            chooseNew(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <a className="about-photo-link" href="/about" target="_blank" rel="noreferrer">
          View the About page ↗
        </a>
        {message ? <p className="about-photo-message">{message}</p> : null}
        <p className="about-photo-help">
          Crop, zoom, auto and brightness work the same as in your galleries. Edits always start from the
          original photo, so you can come back and change them any time.
        </p>
      </div>

      {editing ? (
        <ImageEditor
          source={editing.source}
          filename={editing.file?.name ?? "steve-gregson.jpg"}
          initialSettings={!editing.file && portrait ? portrait.settings : { aspect: "4:5" }}
          onCancel={() => setEditing(null)}
          onApply={apply}
        />
      ) : null}
    </div>
  );
}
