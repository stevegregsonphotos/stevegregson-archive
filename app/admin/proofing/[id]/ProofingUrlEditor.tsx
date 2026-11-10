"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SITE_ORIGIN = "https://www.stevegregson.com";

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
  const [copied, setCopied] = useState(false);

  const hasChanges = slug !== savedSlug;
  // The full link clients use (always the saved address, never a draft).
  const fullUrl = `${SITE_ORIGIN}/proofing/${encodeURIComponent(savedSlug)}`;

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(fullUrl);
    } catch {
      // Older browsers: fall back to a hidden text box.
      const box = document.createElement("textarea");
      box.value = fullUrl;
      box.setAttribute("readonly", "");
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.appendChild(box);
      box.select();
      document.execCommand("copy");
      box.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

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
        <span>stevegregson.com/proofing/</span>

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

        <button
          type="button"
          className={
            copied
              ? "proofing-url-editor-copy is-copied"
              : "proofing-url-editor-copy"
          }
          onClick={() => void copyUrl()}
          disabled={hasChanges}
          title={
            hasChanges
              ? "Save the new address first"
              : fullUrl
          }
        >
          {copied ? "Copied ✓" : "Copy link"}
        </button>
      </div>

      {hasChanges ? (
        <p className="proofing-url-editor-message">
          Save the new address before copying it.
        </p>
      ) : null}

      {message ? (
        <p className="proofing-url-editor-message">
          {message}
        </p>
      ) : null}
    </div>
  );
}
