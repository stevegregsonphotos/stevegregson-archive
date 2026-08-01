"use client";

type PreviewImage = {
  filename: string;
  filepath: string;
  previewUrl: string;
};

type ProductionFields = {
  title: string;
  venue: string;
  year: string;
  director: string;
  associateDirector: string;
  musicalDirector: string;
  choreographer: string;
  lightingDesign: string;
  setDesign: string;
  costumeDesign: string;
  setCostumeDesign: string;
  soundDesign: string;
  commissionedBy: string;
  description: string;
};

type ProductionWebsitePreviewProps = {
  fields: ProductionFields;
  hero: PreviewImage;
  images: PreviewImage[];
  onClose: () => void;
};

export default function ProductionWebsitePreview({
  fields,
  hero,
  images,
  onClose,
}: ProductionWebsitePreviewProps) {
  const credits = [
    ["Director", fields.director],
    ["Associate Director", fields.associateDirector],
    ["Musical Director", fields.musicalDirector],
    ["Choreographer", fields.choreographer],
    ["Lighting Design", fields.lightingDesign],
    ["Set Design", fields.setDesign],
    ["Costume Design", fields.costumeDesign],
    ["Set & Costume Design", fields.setCostumeDesign],
    ["Sound Design", fields.soundDesign],
    ["Commissioned by", fields.commissionedBy],
    ["Photography", "Steve Gregson"],
  ].filter(([, value]) => value.trim());

  const galleryImages = images.filter(
    (image) => image.filepath !== hero.filepath,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Production website preview"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        overflowY: "auto",
        background: "#11100f",
        color: "#f2eee6",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "2rem",
          padding: "1rem 2rem",
          borderBottom:
            "1px solid rgba(242, 238, 230, 0.2)",
          background: "rgba(17, 16, 15, 0.96)",
          backdropFilter: "blur(12px)",
        }}
      >
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
          Preview — not published
        </p>

        <button
          type="button"
          onClick={onClose}
          style={{
            border:
              "1px solid rgba(242, 238, 230, 0.4)",
            padding: "0.8rem 1rem",
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
            fontSize: "0.54rem",
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          Close preview
        </button>
      </div>

      <main>
        <section
          style={{
            position: "relative",
            minHeight: "92vh",
            overflow: "hidden",
          }}
        >
          <img
            src={hero.previewUrl}
            alt={`Preview hero for ${fields.title || "production"}`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(0deg, rgba(8,7,6,0.9) 0%, rgba(8,7,6,0.08) 55%, rgba(8,7,6,0.2) 100%)",
            }}
          />

          <div
            style={{
              position: "absolute",
              right: "6vw",
              bottom: "7vh",
              left: "6vw",
            }}
          >
            <p
              style={{
                margin: "0 0 1rem",
                color: "#c7a369",
                fontSize: "0.58rem",
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              {[fields.venue, fields.year]
                .filter(Boolean)
                .join(" · ")}
            </p>

            <h1
              style={{
                maxWidth: "75rem",
                margin: 0,
                fontFamily:
                  '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
                fontSize: "clamp(4rem, 8vw, 8rem)",
                fontWeight: 400,
                letterSpacing: "-0.055em",
                lineHeight: 0.9,
              }}
            >
              {fields.title || "Untitled production"}
            </h1>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1fr) minmax(22rem, 34rem)",
            gap: "7vw",
            width: "min(100%, 88rem)",
            margin: "0 auto",
            padding: "5.5rem 4rem 6rem",
            borderBottom:
              "1px solid rgba(242, 238, 230, 0.18)",
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 1.3rem",
                color: "#c7a369",
                fontSize: "0.54rem",
                fontWeight: 700,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
              }}
            >
              The Production
            </p>

            <p
              style={{
                maxWidth: "38rem",
                margin: 0,
                color: "rgba(242, 238, 230, 0.74)",
                fontSize: "1rem",
                lineHeight: 1.75,
              }}
            >
              {fields.description ||
                "No production description has been entered."}
            </p>
          </div>

          <dl
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: "1.6rem 3rem",
              margin: 0,
            }}
          >
            {credits.map(([role, name]) => (
              <div
                key={role}
                style={{
                  borderTop:
                    "1px solid rgba(242, 238, 230, 0.16)",
                  paddingTop: "0.9rem",
                }}
              >
                <dt
                  style={{
                    color: "#c7a369",
                    fontSize: "0.48rem",
                    fontWeight: 700,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                  }}
                >
                  {role}
                </dt>

                <dd
                  style={{
                    margin: "0.4rem 0 0",
                    fontFamily:
                      '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
                    fontSize: "1rem",
                    lineHeight: 1.35,
                  }}
                >
                  {name}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(12, minmax(0, 1fr))",
            gap: "10vh 2vw",
            padding: "7rem 3vw",
          }}
        >
          {galleryImages.map((image, index) => {
            const patterns = [
              "2 / 12",
              "1 / 8",
              "7 / 13",
              "3 / 11",
              "1 / 13",
            ];

            return (
              <figure
                key={image.filepath}
                style={{
                  gridColumn:
                    patterns[index % patterns.length],
                  margin: 0,
                }}
              >
                <img
                  src={image.previewUrl}
                  alt={`Preview of ${image.filename}`}
                  style={{
                    display: "block",
                    width: "100%",
                    maxHeight: "88vh",
                    objectFit: "contain",
                  }}
                />
              </figure>
            );
          })}
        </section>
      </main>
    </div>
  );
}