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
};

type GalleryEditorProps = {
  productionSlug: string;
  images: GalleryEditorImage[];
  selectedHero: string;
  onSelectHero: (src: string) => void;
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
  onChange,
}: GalleryEditorProps) {
  function updateImage(index: number, changes: Partial<GalleryEditorImage>) {
    onChange(images.map((image, imageIndex) =>
      imageIndex === index ? { ...image, ...changes } : image,
    ));
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
              <button type="button" onClick={() => onSelectHero(image.src)} aria-pressed={isSelectedHero} style={{ display: "block", width: "100%", padding: 0, border: 0, background: "#080808", cursor: "pointer" }}>
                <div style={{ aspectRatio: "4 / 3", background: "#080808" }}>
                  <img src={`/images/productions/${productionSlug}/${image.src}`} alt={image.alt} loading="lazy" style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
              </button>

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

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "0.6rem", marginTop: "1rem" }}>
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
