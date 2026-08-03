"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type ProductionImage = {
  src: string;
  alt: string;
  layout:
    | "wide"
    | "left"
    | "right"
    | "medium"
    | "full"
    | "left-small"
    | "right-small"
    | "wide-left"
    | "wide-right";
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

export default function EditProductionPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [production, setProduction] =
    useState<Production | null>(null);

  const [selectedHero, setSelectedHero] =
    useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProduction() {
      setIsLoading(true);
      setMessage(null);

      try {
        const response = await fetch(
          `/api/admin/edit-production?slug=${encodeURIComponent(
            slug,
          )}`,
        );

        const data =
          (await response.json()) as LoadResult;

        if (!response.ok || !data.ok || !data.production) {
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
      } catch (error) {
        if (cancelled) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "The production could not be loaded.",
        );
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

  const allImages = useMemo(() => {
    if (!production) {
      return [];
    }

    return [
      {
        src: production.hero,
        alt: production.heroAlt,
        layout: "wide" as const,
      },
      ...production.images,
    ];
  }, [production]);

  async function saveHero() {
    if (
      !production ||
      !selectedHero ||
      selectedHero === production.hero
    ) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

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
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.message ??
            "The hero image could not be updated.",
        );
      }

      setProduction((current) => {
        if (!current) {
          return current;
        }

        const chosenImage = current.images.find(
          (image) => image.src === selectedHero,
        );

        if (!chosenImage) {
          return current;
        }

        return {
          ...current,
          hero: chosenImage.src,
          heroAlt: chosenImage.alt,
          images: [
            {
              src: current.hero,
              alt: current.heroAlt,
              layout: "wide",
            },
            ...current.images.filter(
              (image) => image.src !== chosenImage.src,
            ),
          ],
        };
      });

      setMessage("Hero image updated.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The hero image could not be updated.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main style={{ padding: "3rem" }}>
        <p>Loading production…</p>
      </main>
    );
  }

  if (!production) {
    return (
      <main style={{ padding: "3rem" }}>
        <p>{message ?? "Production not found."}</p>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: "3rem",
        color: "#f2eee6",
      }}
    >
      <p
        style={{
          margin: 0,
          color: "#c7a369",
          fontSize: "0.55rem",
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        Edit production
      </p>

      <h1
        style={{
          marginTop: "0.75rem",
          fontFamily:
            '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
          fontSize: "clamp(2.5rem, 6vw, 5.5rem)",
          fontWeight: 400,
        }}
      >
        {production.title}
      </h1>

      <p
        style={{
          color: "rgba(242, 238, 230, 0.62)",
        }}
      >
        Click any photograph to make it the new hero.
      </p>

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

          return (
            <button
              key={image.src}
              type="button"
              onClick={() =>
                setSelectedHero(image.src)
              }
              aria-pressed={isSelected}
              style={{
                padding: 0,
                overflow: "hidden",
                border: isSelected
                  ? "2px solid #c7a369"
                  : "1px solid rgba(242, 238, 230, 0.18)",
                background: "#080808",
                color: "inherit",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <img
                src={`/images/productions/${production.slug}/${image.src}`}
                alt={image.alt}
                style={{
                  display: "block",
                  width: "100%",
                  aspectRatio: "4 / 3",
                  objectFit: "contain",
                }}
              />

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
                      : "rgba(242, 238, 230, 0.45)",
                    fontSize: "0.48rem",
                    fontWeight: 700,
                    letterSpacing: "0.13em",
                    textTransform: "uppercase",
                  }}
                >
                  {isSelected
                    ? "Selected hero"
                    : image.src === production.hero
                      ? "Current hero"
                      : "Gallery image"}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          marginTop: "2rem",
        }}
      >
        <button
          type="button"
          className="backstage-button backstage-button-primary"
          onClick={saveHero}
          disabled={
            isSaving ||
            !selectedHero ||
            selectedHero === production.hero
          }
        >
          {isSaving
            ? "Saving changes…"
            : "Save new hero"}
        </button>

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
      </div>

      {message ? (
        <p
          role="status"
          style={{
            marginTop: "1.25rem",
            color: "#c7a369",
          }}
        >
          {message}
        </p>
      ) : null}
    </main>
  );
}