"use client";

import { useMemo, useState } from "react";
import type { GalleryEditorImage, GalleryLayout } from "./GalleryEditor";

type VisionMetadata = { alt: string; filename: string; layout: GalleryLayout };
type VisionResult = { ok: boolean; metadata?: VisionMetadata; message?: string };

type Props = {
  productionSlug: string;
  images: GalleryEditorImage[];
  onApplyMetadata: (image: string, metadata: VisionMetadata) => void;
};

export default function VisionMetadataPanel({ productionSlug, images, onApplyMetadata }: Props) {
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const remainingImages = useMemo(
    () => images.filter((image) => !image.suggestedFilename),
    [images],
  );

  async function analyseImages() {
    if (isAnalysing || remainingImages.length === 0) return;
    setIsAnalysing(true);
    setError(null);
    setCurrentIndex(0);
    setTotal(remainingImages.length);

    try {
      for (let index = 0; index < remainingImages.length; index += 1) {
        const image = remainingImages[index];
        setCurrentIndex(index + 1);
        const response = await fetch("/api/admin/vision/analyse-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: productionSlug, image: image.src }),
        });
        const data = (await response.json()) as VisionResult;
        if (!response.ok || !data.ok || !data.metadata) {
          throw new Error(data.message ?? `Vision AI could not analyse ${image.src}.`);
        }
        onApplyMetadata(image.src, data.metadata);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Vision AI analysis failed.");
    } finally {
      setIsAnalysing(false);
    }
  }

  const progress = total > 0 ? Math.round((currentIndex / total) * 100) : 0;

  return (
    <section style={{ maxWidth: "90rem", margin: "4rem auto 0", borderTop: "1px solid rgba(242,238,230,0.18)", paddingTop: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, color: "#c7a369", fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" }}>Vision AI</p>
          <h2 style={{ margin: "0.65rem 0 0", fontFamily: '"Iowan Old Style", "Palatino Linotype", Georgia, serif', fontSize: "clamp(2rem,4vw,3.5rem)", fontWeight: 400 }}>Describe gallery images</h2>
          <p style={{ maxWidth: "48rem", margin: "0.8rem 0 0", color: "rgba(242,238,230,0.58)", lineHeight: 1.7 }}>Generate editable alt text, suggested filenames and layouts. Suggestions remain visible on each gallery card and are saved with the production.</p>
        </div>
        <button type="button" className="backstage-button backstage-button-primary" disabled={isAnalysing || remainingImages.length === 0} onClick={analyseImages}>
          {isAnalysing ? `Analysing ${currentIndex} of ${total}…` : remainingImages.length === 0 ? "All images analysed" : `Analyse ${remainingImages.length} images`}
        </button>
      </div>
      {isAnalysing ? <div style={{ marginTop: "1.5rem" }}><div aria-label={`Analysis progress ${progress}%`} style={{ height: "0.35rem", background: "rgba(242,238,230,0.12)", overflow: "hidden" }}><div style={{ width: `${progress}%`, height: "100%", background: "#c7a369", transition: "width 180ms ease" }} /></div></div> : null}
      {error ? <p role="alert" style={{ margin: "1rem 0 0", color: "#ffb3a7" }}>{error}</p> : null}
    </section>
  );
}
