import { useState } from "react";
import { getProductionImageUrl } from "../../../lib/production-image-url";

export type GalleryLayout =
  | "wide"
  | "left"
  | "right"
  | "medium"
  | "full"
  | "left-small"
  | "right-small"
  | "wide-left"
  | "wide-right";

export type GalleryEditorImage = {
  src: string;
  alt: string;
  layout: GalleryLayout;
  suggestedFilename?: string;
  analysisStatus?: "pending" | "complete";
  analysedAt?: string;
};

type VisionResult = {
  ok: boolean;
  metadata?: {
    alt: string;
    filename: string;
    layout: GalleryLayout;
  };
  message?: string;
};

type GalleryEditorProps = {
  productionSlug: string;
  images: GalleryEditorImage[];
  selectedHero: string;
  onSelectHero: (src: string) => void;
  onEditImage: (image: GalleryEditorImage) => void;
  onChange: (images: GalleryEditorImage[]) => void;
};

const LAYOUT_OPTIONS: Array<{ value: GalleryLayout; label: string }> = [
  { value: "wide", label: "Wide" },
  { value: "full", label: "Full" },
  { value: "medium", label: "Medium" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "left-small", label: "Left small" },
  { value: "right-small", label: "Right small" },
  { value: "wide-left", label: "Wide left" },
  { value: "wide-right", label: "Wide right" },
];

export default function GalleryEditor({
  productionSlug,
  images,
  selectedHero,
  onSelectHero,
  onEditImage,
  onChange,
}: GalleryEditorProps) {
  const [analysingImage, setAnalysingImage] =
    useState<string | null>(null);

  const [analysisError, setAnalysisError] =
    useState<{
      src: string;
      message: string;
    } | null>(null);

  function updateImage(index: number, changes: Partial<GalleryEditorImage>) {
    onChange(images.map((image, imageIndex) =>
      imageIndex === index ? { ...image, ...changes } : image,
    ));
  }

  async function analyseImage(
    image: GalleryEditorImage,
    index: number,
  ) {
    if (analysingImage) {
      return;
    }

    setAnalysingImage(image.src);
    setAnalysisError(null);

    try {
      const response =
        await fetch(
          "/api/admin/vision/analyse-image",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              slug:
                productionSlug,
              image:
                image.src,
            }),
          },
        );

      let result:
        | VisionResult
        | null = null;

      try {
        result =
          (await response.json()) as
            VisionResult;
      } catch {
        result = null;
      }

      if (
        !response.ok ||
        !result?.ok ||
        !result.metadata
      ) {
        throw new Error(
          result?.message ??
            `Vision AI could not analyse ${image.src}.`,
        );
      }

      updateImage(
        index,
        {
          alt:
            result.metadata.alt,
          suggestedFilename:
            result.metadata.filename,
          layout:
            result.metadata.layout,
          analysisStatus:
            "complete",
          analysedAt:
            new Date().toISOString(),
        },
      );
    } catch (error) {
      setAnalysisError({
        src:
          image.src,
        message:
          error instanceof Error
            ? error.message
            : "Vision AI analysis failed.",
      });
    } finally {
      setAnalysingImage(null);
    }
  }

  function moveImage(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= images.length) return;
    const nextImages = [...images];
    const [image] = nextImages.splice(index, 1);
    nextImages.splice(nextIndex, 0, image);
    onChange(nextImages);
  }

  function removeImage(index: number) {
    onChange(images.filter((_, imageIndex) => imageIndex !== index));
  }

  return (
    <section style={{ maxWidth: "90rem", margin: "4rem auto 0", borderTop: "1px solid rgba(242, 238, 230, 0.18)", paddingTop: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: '"Iowan Old Style", "Palatino Linotype", Georgia, serif', fontSize: "clamp(2.2rem, 4vw, 4rem)", fontWeight: 400 }}>Gallery editor</h2>
          <p style={{ margin: "0.65rem 0 0", color: "rgba(242, 238, 230, 0.55)" }}>Review AI metadata, reorder photographs, change layouts, remove images, or select a new hero.</p>
        </div>
        <p style={{ margin: 0, color: "rgba(242, 238, 230, 0.45)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>{images.length} gallery images</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 20rem), 1fr))", gap: "1rem", marginTop: "2rem" }}>
        {images.map((image, index) => {
          const isSelectedHero = image.src === selectedHero;
          return (
            <article key={image.src} style={{ border: isSelectedHero ? "1px solid rgba(199, 163, 105, 0.8)" : "1px solid rgba(242, 238, 230, 0.14)", background: "rgba(255,255,255,0.02)", overflow: "hidden" }}>
              <div style={{ display: "block", width: "100%", padding: 0, border: 0, background: "#080808" }}>
                <div style={{ aspectRatio: "4 / 3", background: "#080808" }}>
                  <img src={getProductionImageUrl(productionSlug, image.src)} alt={image.alt} loading="lazy" style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
              </div>

              <div style={{ padding: "1rem" }}>
                <p className="backstage-field-label">Current filename</p>
                <p title={image.src} style={{ margin: "0.4rem 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.68rem" }}>{image.src}</p>

                <label className="backstage-field" style={{ marginTop: "1rem" }}>
                  <span className="backstage-field-label">Suggested filename</span>
                  <input className="backstage-input" value={image.suggestedFilename ?? ""} onChange={(event) => updateImage(index, { suggestedFilename: event.target.value })} placeholder="AI suggestion appears here" />
                </label>

                <label className="backstage-field" style={{ marginTop: "1rem" }}>
                  <span className="backstage-field-label">Alt text</span>
                  <textarea className="backstage-textarea" rows={4} value={image.alt} onChange={(event) => updateImage(index, { alt: event.target.value })} placeholder="Describe what is visually important" />
                </label>

                <label className="backstage-field" style={{ marginTop: "1rem" }}>
                  <span className="backstage-field-label">Layout</span>
                  <select className="backstage-input" value={image.layout} onChange={(event) => updateImage(index, { layout: event.target.value as GalleryLayout })}>
                    {LAYOUT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>

                <p style={{ margin: "0.6rem 0 0", color: isSelectedHero ? "#c7a369" : "rgba(242,238,230,0.42)", fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase" }}>{isSelectedHero ? "Selected as new hero" : "Click image to select hero"}</p>

                <button
                  type="button"
                  className="backstage-button"
                  disabled={
                    analysingImage !== null
                  }
                  onClick={() =>
                    void analyseImage(
                      image,
                      index,
                    )
                  }
                  style={{
                    width: "100%",
                    marginTop: "1rem",
                  }}
                >
                  {analysingImage === image.src
                    ? "Analysing…"
                    : image.alt.trim() &&
                      !/production photograph/i.test(
                        image.alt,
                      )
                      ? "Reanalyse image"
                      : "Analyse image"}
                </button>

                {analysisError?.src === image.src ? (
                  <p
                    role="alert"
                    style={{
                      margin: "0.65rem 0 0",
                      color: "#ffb3a7",
                      fontSize: "0.72rem",
                      lineHeight: 1.5,
                    }}
                  >
                    {analysisError.message}
                  </p>
                ) : null}

                <button
                  type="button"
                  className="backstage-button backstage-button-primary"
                  onClick={() => onEditImage(image)}
                  style={{
                    width: "100%",
                    marginTop: "0.6rem",
                  }}
                >
                  Edit image
                </button>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "0.6rem", marginTop: "0.6rem" }}>
                  <button type="button" className="backstage-button" disabled={index === 0} onClick={() => moveImage(index, -1)}>Move earlier</button>
                  <button type="button" className="backstage-button" disabled={index === images.length - 1} onClick={() => moveImage(index, 1)}>Move later</button>
                </div>
                <button type="button" className="backstage-button" disabled={isSelectedHero} onClick={() => removeImage(index)} style={{ width: "100%", marginTop: "0.6rem" }}>{isSelectedHero ? "Selected hero" : "Remove image"}</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
