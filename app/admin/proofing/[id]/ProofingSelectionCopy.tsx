"use client";

import { useState } from "react";

type ProofingSelectionCopyProps = {
  filenames: string[];
};

export default function ProofingSelectionCopy({
  filenames,
}: ProofingSelectionCopyProps) {
  const [copied, setCopied] = useState<
    "lightroom" | "list" | null
  >(null);

  async function copy(
    format: "lightroom" | "list",
  ) {
    const text =
      format === "lightroom"
        ? filenames.join(", ")
        : filenames.join("\n");

    try {
      await navigator.clipboard.writeText(text);

      setCopied(format);

      window.setTimeout(() => {
        setCopied(null);
      }, 1800);
    } catch {
      setCopied(null);
    }
  }

  if (filenames.length === 0) {
    return null;
  }

  return (
    <div className="proofing-selection-copy">
      <button
        type="button"
        onClick={() => copy("lightroom")}
        className="proofing-copy-primary"
      >
        {copied === "lightroom"
          ? "Copied for Lightroom ✓"
          : "Copy for Lightroom"}
      </button>

      <button
        type="button"
        onClick={() => copy("list")}
        className="proofing-copy-secondary"
      >
        {copied === "list"
          ? "Copied ✓"
          : "Copy as list"}
      </button>
    </div>
  );
}