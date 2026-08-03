"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

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

type Production = {
  slug: string;
  title: string;
  venue: string;
  year: number;
  description: string;
  hero: string;
  heroAlt: string;
  credits: {
    role: string;
    name: string;
    website?: string;
  }[];
  images: ProductionImage[];
};

type LoadResult = {
  ok: boolean;
  message?: string;
  production?: Production;
};

type SaveResult = {
  ok: boolean;
  message?: string;
  hero?: string;
};

export default function EditProductionPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [production, setProduction] =
    useState<Production | null>(null);

  const [selectedHero, setSelectedHero] =
    useState<string | null>(null);
    const [title, setTitle] = useState("");

const [venue, setVenue] = useState("");

const [year, setYear] = useState("");

const [description, setDescription] =
  useState("");
  const [credits, setCredits] = useState<
  Production["credits"]
>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const [messageType, setMessageType] =
    useState<"success" | "error" | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProduction() {
      setIsLoading(true);
      setMessage(null);
      setMessageType(null);

      try {
        const response = await fetch(
          `/api/admin/edit-production?slug=${encodeURIComponent(
            slug,
          )}`,
        );

        const data =
          (await response.json()) as LoadResult;

        if (
          !response.ok ||
          !data.ok ||
          !data.production
        ) {
          throw new Error(
            data.message ??
              "The production could not be loaded.",
          );
        }

        if (cancelled) {
          return;
        }

        setProduction(data.production);
        setSelectedHero(data.production.hero);
        setTitle(data.production.title);
setVenue(data.production.venue);
setYear(String(data.production.year));
setDescription(data.production.description);
setCredits(data.production.credits);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "The production could not be loaded.",
        );
        setMessageType("error");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadProduction();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const allImages = useMemo<ProductionImage[]>(() => {
    if (!production) {
      return [];
    }

    return [
      {
        src: production.hero,
        alt: production.heroAlt,
        layout: "wide",
      },
      ...production.images,
    ];
  }, [production]);

  const selectedImage = useMemo(() => {
    if (!selectedHero) {
      return null;
    }

    return (
      allImages.find(
        (image) => image.src === selectedHero,
      ) ?? null
    );
  }, [allImages, selectedHero]);

  const hasHeroChanges =
  Boolean(
    production &&
      selectedHero &&
      selectedHero !== production.hero,
  );

const parsedYear = Number.parseInt(year, 10);

const hasDetailChanges =
  Boolean(
    production &&
      (
        title.trim() !== production.title ||
        venue.trim() !== production.venue ||
        parsedYear !== production.year ||
        description.trim() !==
          production.description ||
        JSON.stringify(credits) !==
          JSON.stringify(production.credits)
      ),
  );

const hasUnsavedChanges =
  hasHeroChanges || hasDetailChanges;
function updateCredit(
  index: number,
  field: "role" | "name" | "website",
  value: string,
) {
  setCredits((current) =>
    current.map((credit, creditIndex) =>
      creditIndex === index
        ? {
            ...credit,
            [field]: value,
          }
        : credit,
    ),
  );

  setMessage(null);
  setMessageType(null);
}

function addCredit() {
  setCredits((current) => [
    ...current,
    {
      role: "",
      name: "",
    },
  ]);

  setMessage(null);
  setMessageType(null);
}

function removeCredit(index: number) {
  setCredits((current) =>
    current.filter(
      (_, creditIndex) => creditIndex !== index,
    ),
  );

  setMessage(null);
  setMessageType(null);
}
 async function saveChanges() {
  if (
    !production ||
    !selectedHero ||
    !hasUnsavedChanges
  ) {
    return;
  }

  if (!title.trim()) {
    setMessage("A production title is required.");
    setMessageType("error");
    return;
  }

  if (!venue.trim()) {
    setMessage("A venue is required.");
    setMessageType("error");
    return;
  }

  if (!Number.isInteger(parsedYear)) {
    setMessage("A valid production year is required.");
    setMessageType("error");
    return;
  }

  setIsSaving(true);
  setMessage(null);
  setMessageType(null);

  try {
    const response = await fetch(
      "/api/admin/edit-production",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug: production.slug,
          hero: selectedHero,
          title: title.trim(),
          venue: venue.trim(),
          year: parsedYear,
          description: description.trim(),
          credits,
        }),
      },
    );

    const data =
      (await response.json()) as SaveResult & {
        production?: Production;
      };

    if (
      !response.ok ||
      !data.ok ||
      !data.production
    ) {
      throw new Error(
        data.message ??
          "The production could not be updated.",
      );
    }

    setProduction(data.production);
    setSelectedHero(data.production.hero);
    setTitle(data.production.title);
    setVenue(data.production.venue);
    setYear(String(data.production.year));
    setDescription(data.production.description);
    setCredits(data.production.credits);

    setMessage(
      data.message ??
        "Production updated successfully.",
    );
    setMessageType("success");
  } catch (error) {
    setMessage(
      error instanceof Error
        ? error.message
        : "The production could not be updated.",
    );
    setMessageType("error");
  } finally {
    setIsSaving(false);
  }
}

  if (isLoading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: "4rem clamp(1.5rem, 5vw, 5rem)",
          color: "#f2eee6",
        }}
      >
        <p>Loading production…</p>
      </main>
    );
  }

  if (!production || !selectedImage) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: "4rem clamp(1.5rem, 5vw, 5rem)",
          color: "#f2eee6",
        }}
      >
        <p>
          {message ?? "Production not found."}
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding:
          "4rem clamp(1.5rem, 5vw, 5rem) 6rem",
        color: "#f2eee6",
      }}
    >
      <header
        style={{
          maxWidth: "90rem",
          margin: "0 auto",
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
          Production editor
        </p>

        <h1
          style={{
            margin: "0.75rem 0 0",
            fontFamily:
              '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
            fontSize:
              "clamp(3rem, 7vw, 7rem)",
            fontWeight: 400,
            lineHeight: 0.95,
          }}
        >
          {production.title}
        </h1>

        <p
          style={{
            margin: "1rem 0 0",
            color:
              "rgba(242, 238, 230, 0.58)",
            fontSize: "0.75rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {production.venue} · {production.year}
        </p>
      </header>
<section
  style={{
    maxWidth: "90rem",
    margin: "4rem auto 0",
    borderTop:
      "1px solid rgba(242, 238, 230, 0.18)",
    paddingTop: "2rem",
  }}
>
  <h2
    style={{
      margin: 0,
      fontFamily:
        '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
      fontSize: "2rem",
      fontWeight: 400,
    }}
  >
    Production Details
  </h2>

  <div
    style={{
      display: "grid",
      gridTemplateColumns:
        "repeat(auto-fit, minmax(18rem, 1fr))",
      gap: "1.5rem",
      marginTop: "2rem",
    }}
  >
    <label className="backstage-field">
      <span className="backstage-field-label">
        Title
      </span>

      <input
        className="backstage-input"
        value={title}
        onChange={(event) =>
          setTitle(event.target.value)
        }
      />
    </label>

    <label className="backstage-field">
      <span className="backstage-field-label">
        Venue
      </span>

      <input
        className="backstage-input"
        value={venue}
        onChange={(event) =>
          setVenue(event.target.value)
        }
      />
    </label>

    <label className="backstage-field">
      <span className="backstage-field-label">
        Year
      </span>

      <input
        className="backstage-input"
        value={year}
        onChange={(event) =>
          setYear(event.target.value)
        }
      />
    </label>
  </div>

  <label
    className="backstage-field"
    style={{
      marginTop: "1.5rem",
    }}
  >
    <span className="backstage-field-label">
      Description
    </span>

    <textarea
      className="backstage-textarea"
      rows={5}
      value={description}
      onChange={(event) =>
        setDescription(event.target.value)
      }
    />
  </label>
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
      gap: "1rem",
      alignItems: "center",
      flexWrap: "wrap",
    }}
  >
    <div>
      <h2
        style={{
          margin: 0,
          fontFamily:
            '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
          fontSize: "2rem",
          fontWeight: 400,
        }}
      >
        Credits
      </h2>

      <p
        style={{
          margin: "0.65rem 0 0",
          color:
            "rgba(242, 238, 230, 0.55)",
        }}
      >
        Edit the production team shown on the website.
      </p>
    </div>

    <button
      type="button"
      className="backstage-button"
      onClick={addCredit}
    >
      Add credit
    </button>
  </div>

  <div
    style={{
      display: "grid",
      gap: "1rem",
      marginTop: "2rem",
    }}
  >
    {credits.map((credit, index) => (
      <div
        key={index}
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(10rem, 0.8fr) minmax(14rem, 1fr) minmax(14rem, 1fr) auto",
          gap: "1rem",
          alignItems: "end",
          border:
            "1px solid rgba(242, 238, 230, 0.14)",
          padding: "1rem",
          background:
            "rgba(255, 255, 255, 0.02)",
        }}
      >
        <label className="backstage-field">
          <span className="backstage-field-label">
            Role
          </span>

          <input
            className="backstage-input"
            value={credit.role}
            onChange={(event) =>
              updateCredit(
                index,
                "role",
                event.target.value,
              )
            }
          />
        </label>

        <label className="backstage-field">
          <span className="backstage-field-label">
            Name
          </span>

          <input
            className="backstage-input"
            value={credit.name}
            onChange={(event) =>
              updateCredit(
                index,
                "name",
                event.target.value,
              )
            }
          />
        </label>

        <label className="backstage-field">
          <span className="backstage-field-label">
            Website
          </span>

          <input
            className="backstage-input"
            value={credit.website ?? ""}
            onChange={(event) =>
              updateCredit(
                index,
                "website",
                event.target.value,
              )
            }
            placeholder="Optional"
          />
        </label>

        <button
          type="button"
          className="backstage-button"
          onClick={() => removeCredit(index)}
        >
          Remove
        </button>
      </div>
    ))}
  </div>
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
                color:
                  "rgba(242, 238, 230, 0.58)",
              }}
            >
              Click any photograph below to try it
              as the hero.
            </p>
          </div>

          {hasUnsavedChanges ? (
            <p
              style={{
                margin: 0,
                color: "#c7a369",
                fontSize: "0.55rem",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Unsaved hero change
            </p>
          ) : (
            <p
              style={{
                margin: 0,
                color:
                  "rgba(242, 238, 230, 0.4)",
                fontSize: "0.55rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Current published hero
            </p>
          )}
        </div>

        <div
          style={{
            marginTop: "2rem",
            background: "#080808",
          }}
        >
          <img
            src={`/images/productions/${production.slug}/${selectedImage.src}`}
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
            color:
              "rgba(242, 238, 230, 0.42)",
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
              fontSize:
                "clamp(2.2rem, 4vw, 4rem)",
              fontWeight: 400,
            }}
          >
            Photographs
          </h2>

          <p
            style={{
              margin: 0,
              color:
                "rgba(242, 238, 230, 0.45)",
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
            const isSelected =
              image.src === selectedHero;

            const isPublishedHero =
              image.src === production.hero;

            return (
              <button
                key={image.src}
                type="button"
                onClick={() => {
                  setSelectedHero(image.src);
                  setMessage(null);
                  setMessageType(null);
                }}
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
                    src={`/images/productions/${production.slug}/${image.src}`}
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

                <div
                  style={{
                    padding: "0.85rem",
                  }}
                >
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

      <section
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 10,
          maxWidth: "90rem",
          margin: "3rem auto 0",
          border:
            "1px solid rgba(242, 238, 230, 0.16)",
          padding: "1rem",
          background:
            "rgba(8, 8, 8, 0.94)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            {message ? (
              <p
                role="status"
                style={{
                  margin: 0,
                  color:
                    messageType === "error"
                      ? "#ffb3a7"
                      : "#c7a369",
                }}
              >
                {message}
              </p>
            ) : (
              <p
                style={{
                  margin: 0,
                  color:
                    "rgba(242, 238, 230, 0.48)",
                }}
              >
                {hasUnsavedChanges
  ? "Your changes have not been saved yet."
  : "No unsaved changes."}
              </p>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <a
              href={`/productions/${production.slug}`}
              target="_blank"
              rel="noreferrer"
              className="backstage-button"
              style={{
                display: "inline-flex",
                textDecoration: "none",
              }}
            >
              View production
            </a>

            <a
              href="/archive"
              className="backstage-button"
              style={{
                display: "inline-flex",
                textDecoration: "none",
              }}
            >
              Back to archive
            </a>

            <button
              type="button"
              className="backstage-button backstage-button-primary"
              onClick={saveChanges}
              disabled={
                isSaving || !hasUnsavedChanges
              }
            >
              {isSaving
  ? "Saving changes…"
  : "Save changes"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}