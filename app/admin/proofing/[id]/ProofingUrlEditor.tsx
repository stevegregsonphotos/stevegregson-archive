"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ProofingUrlEditorProps = {
  galleryId: string;
  initialSlug: string;
};

export default function ProofingUrlEditor({
  galleryId,
  initialSlug,
}: ProofingUrlEditorProps) {
  const router = useRouter();

  const [slug, setSlug] = useState(initialSlug);
  const [savedSlug, setSavedSlug] =
    useState(initialSlug);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const hasChanges = slug !== savedSlug;

  async function saveUrl() {
    if (!slug.trim() || isSaving) {
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/proofing/url",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            galleryId,
            slug,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(
          result.error ??
            "The gallery URL could not be updated.",
        );
        return;
      }

      setSlug(result.slug);
      setSavedSlug(result.slug);
      setMessage("Gallery URL updated.");

      router.refresh();
    } catch {
      setMessage(
        "The gallery URL could not be updated.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="proofing-url-editor">
      <div className="proofing-url-editor-field">
        <span>/proofing/</span>

        <input
          type="text"
          value={slug}
          onChange={(event) => {
            setSlug(event.target.value);
            setMessage("");
          }}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Gallery URL"
        />

        <button
          type="button"
          onClick={saveUrl}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>

      {message ? (
        <p className="proofing-url-editor-message">
          {message}
        </p>
      ) : null}
    </div>
  );
}
