"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import CreditsEditor from "../../../../components/admin/editor/CreditsEditor";
import GalleryEditor from "../../../../components/admin/editor/GalleryEditor";
import HeroEditor from "../../../../components/admin/editor/HeroEditor";
import ProductionDetailsEditor from "../../../../components/admin/editor/ProductionDetailsEditor";
import VisionMetadataPanel from "../../../../components/admin/editor/VisionMetadataPanel";

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
  suggestedFilename?: string;
};

type ProductionCredit = {
  role: string;
  name: string;
  website?: string;
};

type Production = {
  slug: string;
  title: string;
  venue: string;
  year: number;
  description: string;
  hero: string;
  heroAlt: string;
  credits: ProductionCredit[];
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
  production?: Production;
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
  const [description, setDescription] = useState("");
  const [credits, setCredits] = useState<ProductionCredit[]>([]);
  const [galleryImages, setGalleryImages] = useState<ProductionImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
          `/api/admin/edit-production?slug=${encodeURIComponent(slug)}`,
        );
        const data = (await response.json()) as LoadResult;

        if (!response.ok || !data.ok || !data.production) {
          throw new Error(
            data.message ?? "The production could not be loaded.",
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
        setGalleryImages(data.production.images);
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

    void loadProduction();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const parsedYear = Number.parseInt(year, 10);

  const hasHeroChanges = Boolean(
    production &&
      selectedHero &&
      selectedHero !== production.hero,
  );

  const hasDetailChanges = Boolean(
    production &&
      (title.trim() !== production.title ||
        venue.trim() !== production.venue ||
        parsedYear !== production.year ||
        description.trim() !== production.description ||
        JSON.stringify(credits) !==
          JSON.stringify(production.credits)),
  );

  const hasGalleryChanges = Boolean(
    production &&
      JSON.stringify(galleryImages) !==
        JSON.stringify(production.images),
  );

  const hasUnsavedChanges =
    hasHeroChanges || hasDetailChanges || hasGalleryChanges;

  function clearMessage() {
    setMessage(null);
    setMessageType(null);
  }

  async function saveChanges() {
    if (!production || !selectedHero || !hasUnsavedChanges) {
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
    clearMessage();

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
            images: galleryImages,
          }),
        },
      );

      const data = (await response.json()) as SaveResult;

      if (!response.ok || !data.ok || !data.production) {
        throw new Error(
          data.message ?? "The production could not be updated.",
        );
      }

      setProduction(data.production);
      setSelectedHero(data.production.hero);
      setTitle(data.production.title);
      setVenue(data.production.venue);
      setYear(String(data.production.year));
      setDescription(data.production.description);
      setCredits(data.production.credits);
      setGalleryImages(data.production.images);
      setMessage(
        data.message ?? "Production updated successfully.",
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

  if (!production || !selectedHero) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: "4rem clamp(1.5rem, 5vw, 5rem)",
          color: "#f2eee6",
        }}
      >
        <p>{message ?? "Production not found."}</p>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "4rem clamp(1.5rem, 5vw, 5rem) 6rem",
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
            fontSize: "clamp(3rem, 7vw, 7rem)",
            fontWeight: 400,
            lineHeight: 0.95,
          }}
        >
          {production.title}
        </h1>

        <p
          style={{
            margin: "1rem 0 0",
            color: "rgba(242, 238, 230, 0.58)",
            fontSize: "0.75rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {production.venue} · {production.year}
        </p>
      </header>

      <ProductionDetailsEditor
        title={title}
        venue={venue}
        year={year}
        description={description}
        onTitleChange={(value) => {
          setTitle(value);
          clearMessage();
        }}
        onVenueChange={(value) => {
          setVenue(value);
          clearMessage();
        }}
        onYearChange={(value) => {
          setYear(value);
          clearMessage();
        }}
        onDescriptionChange={(value) => {
          setDescription(value);
          clearMessage();
        }}
      />

      <CreditsEditor
        credits={credits}
        onChange={(nextCredits) => {
          setCredits(nextCredits);
          clearMessage();
        }}
      />

      <HeroEditor
        slug={production.slug}
        publishedHero={production.hero}
        publishedHeroAlt={production.heroAlt}
        images={galleryImages}
        selectedHero={selectedHero}
        hasUnsavedHeroChange={hasHeroChanges}
        onSelectHero={(src) => {
          setSelectedHero(src);
          clearMessage();
        }}
      />

      <VisionMetadataPanel
        productionSlug={production.slug}
        images={galleryImages}
        onApplyMetadata={(imageSrc, metadata) => {
          setGalleryImages((current) =>
            current.map((image) =>
              image.src === imageSrc
                ? {
                    ...image,
                    alt: metadata.alt,
                    layout: metadata.layout,
                    suggestedFilename: metadata.filename,
                  }
                : image,
            ),
          );
          clearMessage();
        }}
      />

      <GalleryEditor
        productionSlug={production.slug}
        images={galleryImages}
        selectedHero={selectedHero}
        onSelectHero={(src) => {
          setSelectedHero(src);
          clearMessage();
        }}
        onChange={(nextImages) => {
          setGalleryImages(nextImages);

          if (
            selectedHero !== production.hero &&
            !nextImages.some(
              (image) => image.src === selectedHero,
            )
          ) {
            setSelectedHero(production.hero);
          }

          clearMessage();
        }}
      />

      <section
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 10,
          maxWidth: "90rem",
          margin: "3rem auto 0",
          border: "1px solid rgba(242, 238, 230, 0.16)",
          padding: "1rem",
          background: "rgba(8, 8, 8, 0.94)",
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
                  color: "rgba(242, 238, 230, 0.48)",
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
              disabled={isSaving || !hasUnsavedChanges}
            >
              {isSaving ? "Saving changes…" : "Save changes"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
