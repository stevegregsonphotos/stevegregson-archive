type GalleryLayout =
  | "wide"
  | "left"
  | "right"
  | "medium"
  | "full"
  | "left-small"
  | "right-small"
  | "wide-left"
  | "wide-right";

type ProductionImage = {
  src: string;
  alt: string;
  layout: GalleryLayout;
};

type HeroEditorProps = {
  slug: string;
  publishedHero: string;
  publishedHeroAlt: string;
  images: ProductionImage[];
  selectedHero: string;
  hasUnsavedHeroChange: boolean;
  onSelectHero: (src: string) => void;
};

export default function HeroEditor({
  slug,
  publishedHero,
  publishedHeroAlt,
  images,
  selectedHero,
  hasUnsavedHeroChange,
  onSelectHero,
}: HeroEditorProps) {
  const allImages: ProductionImage[] = [
    {
      src: publishedHero,
      alt: publishedHeroAlt,
      layout: "wide",
    },
    ...images,
  ];

  const selectedImage =
    allImages.find((image) => image.src === selectedHero) ??
    allImages[0];

  if (!selectedImage) {
    return null;
  }

  return (
    <>
      <section
        style={{
          maxWidth: "90rem",
          margin: "4rem auto 0",
          borderTop:
            "1px solid rgba(242, 238, 230, 0.18)",
          paddingTop: "2rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "2rem",
            alignItems: "baseline",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                color: "#c7a369",
                fontSize: "0.55rem",
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              Selected hero
            </p>

            <p
              style={{
                margin: "0.65rem 0 0",
                color: "rgba(242, 238, 230, 0.58)",
              }}
            >
              Click any photograph below to try it as the hero.
            </p>
          </div>

          <p
            style={{
              margin: 0,
              color: hasUnsavedHeroChange
                ? "#c7a369"
                : "rgba(242, 238, 230, 0.4)",
              fontSize: "0.55rem",
              fontWeight: hasUnsavedHeroChange ? 700 : 400,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {hasUnsavedHeroChange
              ? "Unsaved hero change"
              : "Current published hero"}
          </p>
        </div>

        <div
          style={{
            marginTop: "2rem",
            background: "#080808",
          }}
        >
          <img
            src={`/images/productions/${slug}/${selectedImage.src}`}
            alt={selectedImage.alt}
            style={{
              display: "block",
              width: "100%",
              maxHeight: "72vh",
              objectFit: "contain",
              objectPosition: "center",
            }}
          />
        </div>

        <p
          style={{
            margin: "1rem 0 0",
            color: "rgba(242, 238, 230, 0.42)",
            fontSize: "0.65rem",
          }}
        >
          {selectedImage.src}
        </p>
      </section>

      <section
        style={{
          maxWidth: "90rem",
          margin: "4rem auto 0",
          borderTop:
            "1px solid rgba(242, 238, 230, 0.18)",
          paddingTop: "2rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "2rem",
            alignItems: "baseline",
            flexWrap: "wrap",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily:
                '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
              fontSize: "clamp(2.2rem, 4vw, 4rem)",
              fontWeight: 400,
            }}
          >
            Photographs
          </h2>

          <p
            style={{
              margin: 0,
              color: "rgba(242, 238, 230, 0.45)",
              fontSize: "0.55rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {allImages.length} images
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(13rem, 1fr))",
            gap: "1rem",
            marginTop: "2rem",
          }}
        >
          {allImages.map((image) => {
            const isSelected = image.src === selectedHero;
            const isPublishedHero = image.src === publishedHero;

            return (
              <button
                key={image.src}
                type="button"
                onClick={() => onSelectHero(image.src)}
                aria-pressed={isSelected}
                style={{
                  padding: 0,
                  overflow: "hidden",
                  border: isSelected
                    ? "2px solid #c7a369"
                    : "1px solid rgba(242, 238, 230, 0.16)",
                  background: "#080808",
                  color: "inherit",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    aspectRatio: "4 / 3",
                    background: "#080808",
                  }}
                >
                  <img
                    src={`/images/productions/${slug}/${image.src}`}
                    alt={image.alt}
                    loading="lazy"
                    style={{
                      display: "block",
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                </div>

                <div style={{ padding: "0.85rem" }}>
                  <p
                    style={{
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: "0.68rem",
                    }}
                  >
                    {image.src}
                  </p>

                  <p
                    style={{
                      margin: "0.4rem 0 0",
                      color: isSelected
                        ? "#c7a369"
                        : "rgba(242, 238, 230, 0.42)",
                      fontSize: "0.48rem",
                      fontWeight: 700,
                      letterSpacing: "0.13em",
                      textTransform: "uppercase",
                    }}
                  >
                    {isSelected
                      ? "Selected hero"
                      : isPublishedHero
                        ? "Published hero"
                        : "Gallery image"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
