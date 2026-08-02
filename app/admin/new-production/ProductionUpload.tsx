"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";

import ProductionWebsitePreview from "../../../components/admin/ProductionWebsitePreview";

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

type ImageMetrics = {
  resolutionScore: number;
  sharpness: number;
  brightness: number;
  contrast: number;
  entropy: number;
  technicalScore: number;
  duplicateScore: number;
  galleryScore: number;
};

type PreviewImage = {
  filename: string;
  filepath: string;
  previewUrl: string;
  width: number | null;
  height: number | null;
  orientation:
    | "landscape"
    | "portrait"
    | "square"
    | "unknown";
  heroScore: number;
  fingerprint: string;
  metrics: ImageMetrics;
  suggestion: {
    include: boolean;
    order: number | null;
    layout: GalleryLayout;
    duplicateOf: string | null;
    explanation: string[];
  };
};

type ExtractedProductionFields = {
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

type ExtractedProductionDetails = {
  sourceFile: string | null;
  fields: ExtractedProductionFields;
  plainText: string;
};

type UploadResult = {
  ok: boolean;
  message: string;
  archive?: {
    name: string;
    size: number;
    type: string;
    suggestedSlug: string;
  };
  contents?: {
    imageCount: number;
    previewCount: number;
    previewLimitReached: boolean;
    images: PreviewImage[];
    detailsFiles: string[];
    otherFiles: string[];
    suggestedHeroPath: string | null;
    extractedDetails: ExtractedProductionDetails;
    curation: {
      selectedCount: number;
      excludedCount: number;
      duplicateCount: number;
      selectedPaths: string[];
    };
  };
};

type EditableProductionFields = ExtractedProductionFields;

type VisionReview = {
  hero: string;
  heroReason: string;
  keep: string[];
  remove: string[];
  sequence: string[];
  editorialSummary: string;
};

type PublishResult = {
  ok: boolean;
  message: string;
  production?: {
    slug: string;
    title: string;
    url: string;
    imageCount: number;
    hero: string;
    productionFile: string;
    imageDirectory: string;
  };
};

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function filenameOnly(filepath: string) {
  return filepath.split("/").at(-1) ?? filepath;
}

function scoreLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 72) return "Strong";
  if (score >= 58) return "Good";
  if (score >= 42) return "Fair";
  return "Weak";
}

function starRating(score: number) {
  if (score >= 88) return "★★★★★";
  if (score >= 74) return "★★★★☆";
  if (score >= 58) return "★★★☆☆";
  if (score >= 42) return "★★☆☆☆";
  return "★☆☆☆☆";
}

function imageStatus(image: PreviewImage) {
  if (image.suggestion.duplicateOf) {
    return "Near duplicate";
  }

  if (image.suggestion.include) {
    return "Gallery selection";
  }

  return "Alternative";
}

function editorialAssessment(image: PreviewImage) {
  const assessment: string[] = [];

  if (image.heroScore >= 85) {
    assessment.push("Excellent hero candidate");
  } else if (image.heroScore >= 70) {
    assessment.push("Strong hero potential");
  }

  if (image.metrics.sharpness >= 70) {
    assessment.push("Excellent sharpness");
  } else if (image.metrics.sharpness >= 55) {
    assessment.push("Good technical sharpness");
  }

  if (
    image.metrics.brightness >= 30 &&
    image.metrics.brightness <= 70
  ) {
    assessment.push("Balanced exposure");
  }

  if (image.metrics.contrast >= 60) {
    assessment.push("Strong tonal separation");
  }

  if (image.orientation === "landscape") {
    assessment.push("Suitable for wide presentation");
  }

  if (image.suggestion.include) {
    assessment.push("Included in the suggested edit");
  }

  return assessment.slice(0, 5);
}

const EMPTY_PRODUCTION_FIELDS: EditableProductionFields = {
  title: "",
  venue: "",
  year: "",
  director: "",
  associateDirector: "",
  musicalDirector: "",
  choreographer: "",
  lightingDesign: "",
  setDesign: "",
  costumeDesign: "",
  setCostumeDesign: "",
  soundDesign: "",
  commissionedBy: "",
  description: "",
};

export default function ProductionUpload() {
  const [isUploading, setIsUploading] =
    useState(false);

  const [result, setResult] =
    useState<UploadResult | null>(null);

  const [
    selectedHeroPath,
    setSelectedHeroPath,
  ] = useState<string | null>(null);

  const [showWebsitePreview, setShowWebsitePreview] =
    useState(false);

  const [isReviewing, setIsReviewing] =
    useState(false);

  const [visionReview, setVisionReview] =
    useState<VisionReview | null>(null);

  const [productionArchive, setProductionArchive] =
    useState<File | null>(null);

  const [isPublishing, setIsPublishing] =
    useState(false);

  const [publishResult, setPublishResult] =
    useState<PublishResult | null>(null);

  const [productionFields, setProductionFields] =
    useState<EditableProductionFields>({
      ...EMPTY_PRODUCTION_FIELDS,
    });

  const selectedHero = useMemo(() => {
    return (
      result?.contents?.images.find(
        (image) =>
          image.filepath === selectedHeroPath,
      ) ?? null
    );
  }, [result, selectedHeroPath]);

  const aiHeroImage = useMemo(() => {
    if (!visionReview) {
      return null;
    }

    return (
      result?.contents?.images.find(
        (image) =>
          image.filename === visionReview.hero,
      ) ?? null
    );
  }, [result, visionReview]);

  const aiKeepImages = useMemo(() => {
    if (!visionReview) {
      return [];
    }

    const keep = new Set(visionReview.keep);

    return (
      result?.contents?.images.filter((image) =>
        keep.has(image.filename),
      ) ?? []
    );
  }, [result, visionReview]);

  const aiRemoveImages = useMemo(() => {
    if (!visionReview) {
      return [];
    }

    const remove = new Set(visionReview.remove);

    return (
      result?.contents?.images.filter((image) =>
        remove.has(image.filename),
      ) ?? []
    );
  }, [result, visionReview]);

  const curatedImages = useMemo(() => {
    const images = result?.contents?.images ?? [];

    return images
      .filter((image) => image.suggestion.include)
      .sort(
        (first, second) =>
          (first.suggestion.order ??
            Number.MAX_SAFE_INTEGER) -
          (second.suggestion.order ??
            Number.MAX_SAFE_INTEGER),
      );
  }, [result]);

  const excludedImages = useMemo(() => {
    const images = result?.contents?.images ?? [];

    return images
      .filter((image) => !image.suggestion.include)
      .sort(
        (first, second) =>
          second.metrics.galleryScore -
          first.metrics.galleryScore,
      );
  }, [result]);

  const displayedImages = useMemo(() => {
    return [...curatedImages, ...excludedImages];
  }, [curatedImages, excludedImages]);

  const editorialSummary = useMemo(() => {
    if (!result?.contents) {
      return null;
    }

    const selected = curatedImages;
    const landscapes = selected.filter(
      (image) => image.orientation === "landscape",
    ).length;
    const portraits = selected.filter(
      (image) => image.orientation === "portrait",
    ).length;
    const averageTechnical =
      selected.length > 0
        ? Math.round(
            selected.reduce(
              (total, image) =>
                total + image.metrics.technicalScore,
              0,
            ) / selected.length,
          )
        : 0;

    return {
      landscapes,
      portraits,
      averageTechnical,
      recommendation:
        averageTechnical >= 75
          ? "Excellent upload. Only a light manual review is recommended."
          : averageTechnical >= 60
            ? "Strong upload. Review the alternatives before publishing."
            : "A useful first edit. A closer manual review is recommended.",
    };
  }, [result, curatedImages]);

  function updateProductionField(
    field: keyof EditableProductionFields,
    value: string,
  ) {
    setProductionFields((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setIsUploading(true);
    setResult(null);
    setSelectedHeroPath(null);
    setShowWebsitePreview(false);
    setVisionReview(null);
    setPublishResult(null);
    setProductionArchive(null);
    setProductionFields({
      ...EMPTY_PRODUCTION_FIELDS,
    });

    const formData = new FormData(
      event.currentTarget,
    );

    const archive = formData.get(
      "productionArchive",
    );

    if (!(archive instanceof File)) {
      setResult({
        ok: false,
        message: "Please choose a ZIP archive.",
      });
      setIsUploading(false);
      return;
    }

    setProductionArchive(archive);

    try {
      const response = await fetch(
        "/api/admin/production-preview",
        {
          method: "POST",
          body: formData,
        },
      );

      const data =
        (await response.json()) as UploadResult;

      setResult(data);

      if (data.contents?.extractedDetails.fields) {
        setProductionFields({
          ...data.contents.extractedDetails.fields,
        });
      }

      if (data.contents?.suggestedHeroPath) {
        setSelectedHeroPath(
          data.contents.suggestedHeroPath,
        );
      }
    } catch {
      setResult({
        ok: false,
        message: "The upload request failed.",
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function runVisionReview() {
  if (!result?.contents) {
    return;
  }

  setIsReviewing(true);
  setVisionReview(null);

  try {
    const response = await fetch(
      "/api/admin/vision-review",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          production: {
            title: productionFields.title,
            venue: productionFields.venue,
            year: productionFields.year,
            description:
              productionFields.description,
          },

          images: curatedImages.map((image) => ({
            filename: image.filename,
            previewUrl: image.previewUrl,
            heroScore: image.heroScore,
            technicalScore:
              image.metrics.technicalScore,
            width: image.width,
            height: image.height,
            orientation: image.orientation,
          })),
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ??
          "Vision AI review failed.",
      );
    }

    setVisionReview(data.review);

    const suggestedHero =
      curatedImages.find(
        (image) =>
          image.filename ===
          data.review.hero,
      );

    if (suggestedHero) {
      setSelectedHeroPath(
        suggestedHero.filepath,
      );
    }
  } catch (error) {
    console.error(error);

    alert(
      error instanceof Error
        ? error.message
        : "Vision AI review failed.",
    );
  } finally {
    setIsReviewing(false);
  }
}

  async function publishProduction() {
    if (
      !result?.archive ||
      !result.contents ||
      !productionArchive ||
      !selectedHero
    ) {
      setPublishResult({
        ok: false,
        message:
          "Upload a production ZIP and select a hero before publishing.",
      });
      return;
    }

    const year = Number.parseInt(
      productionFields.year,
      10,
    );

    if (
      !productionFields.title.trim() ||
      !productionFields.venue.trim() ||
      !Number.isInteger(year)
    ) {
      setPublishResult({
        ok: false,
        message:
          "Production title, venue and a valid year are required.",
      });
      return;
    }

    const imageByFilename = new Map(
      curatedImages.map((image) => [
        image.filename,
        image,
      ]),
    );

    const requestedOrder =
      visionReview?.sequence.length
        ? visionReview.sequence
        : visionReview?.keep.length
          ? visionReview.keep
          : curatedImages.map(
              (image) => image.filename,
            );

    const orderedImages: PreviewImage[] = [];
    const usedFilenames = new Set<string>();

    for (const filename of requestedOrder) {
      const image = imageByFilename.get(filename);

      if (
        !image ||
        image.filename === selectedHero.filename ||
        usedFilenames.has(image.filename)
      ) {
        continue;
      }

      orderedImages.push(image);
      usedFilenames.add(image.filename);
    }

    for (const image of curatedImages) {
      if (
        image.filename === selectedHero.filename ||
        usedFilenames.has(image.filename)
      ) {
        continue;
      }

      orderedImages.push(image);
      usedFilenames.add(image.filename);
    }

    if (orderedImages.length === 0) {
      setPublishResult({
        ok: false,
        message:
          "At least one gallery image is required in addition to the hero.",
      });
      return;
    }

    const credits = [
      {
        role: "Venue",
        name: productionFields.venue.trim(),
      },
      {
        role: "Director",
        name: productionFields.director.trim(),
      },
      {
        role: "Associate Director",
        name:
          productionFields.associateDirector.trim(),
      },
      {
        role: "Musical Director",
        name:
          productionFields.musicalDirector.trim(),
      },
      {
        role: "Choreographer",
        name: productionFields.choreographer.trim(),
      },
      {
        role: "Lighting Design",
        name:
          productionFields.lightingDesign.trim(),
      },
      {
        role: "Set Design",
        name: productionFields.setDesign.trim(),
      },
      {
        role: "Costume Design",
        name:
          productionFields.costumeDesign.trim(),
      },
      {
        role: "Set & Costume Design",
        name:
          productionFields.setCostumeDesign.trim(),
      },
      {
        role: "Sound Design",
        name: productionFields.soundDesign.trim(),
      },
      {
        role: "Commissioned by",
        name:
          productionFields.commissionedBy.trim(),
      },
      {
        role: "Photography",
        name: "Steve Gregson",
      },
    ].filter((credit) => credit.name);

    const genericAlt = `${productionFields.title.trim()} at ${productionFields.venue.trim()}, photographed by Steve Gregson`;

    const productionData = {
      slug: result.archive.suggestedSlug,
      title: productionFields.title.trim(),
      venue: productionFields.venue.trim(),
      year,
      description:
        productionFields.description.trim(),
      hero: {
        filepath: selectedHero.filepath,
        filename: selectedHero.filename,
        alt: genericAlt,
      },
      credits,
      images: orderedImages.map((image) => ({
        filepath: image.filepath,
        filename: image.filename,
        alt: genericAlt,
        layout: image.suggestion.layout,
      })),
    };

    const confirmed = window.confirm(
      `Publish "${productionData.title}" with ${productionData.images.length} gallery images?`,
    );

    if (!confirmed) {
      return;
    }

    setIsPublishing(true);
    setPublishResult(null);

    try {
      const formData = new FormData();
      formData.set(
        "productionArchive",
        productionArchive,
      );
      formData.set(
        "productionData",
        JSON.stringify(productionData),
      );

      const response = await fetch(
        "/api/admin/publish-production",
        {
          method: "POST",
          body: formData,
        },
      );

      const data =
        (await response.json()) as PublishResult;

      setPublishResult(data);

      if (!response.ok || !data.ok) {
        return;
      }

      setShowWebsitePreview(false);
    } catch (error) {
      console.error(error);

      setPublishResult({
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "The production could not be published.",
      });
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <section
      style={{
        borderTop:
          "1px solid rgba(242, 238, 230, 0.22)",
        paddingTop: "2rem",
      }}
    >
      <form onSubmit={handleSubmit}>
        <label
          htmlFor="productionArchive"
          style={{
            display: "block",
            marginBottom: "1rem",
            color: "#c7a369",
            fontSize: "0.55rem",
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          Production ZIP
        </label>

        <input
          id="productionArchive"
          name="productionArchive"
          type="file"
          accept=".zip,application/zip"
          required
          style={{
            display: "block",
            width: "100%",
            border:
              "1px solid rgba(242, 238, 230, 0.25)",
            padding: "1.25rem",
            background:
              "rgba(255, 255, 255, 0.03)",
            color: "inherit",
          }}
        />

        <button
          type="submit"
          disabled={isUploading}
          style={{
            marginTop: "1.5rem",
            border:
              "1px solid rgba(242, 238, 230, 0.5)",
            padding: "1rem 1.4rem",
            background: "transparent",
            color: "inherit",
            cursor: isUploading
              ? "wait"
              : "pointer",
            fontSize: "0.58rem",
            fontWeight: 700,
            letterSpacing: "0.17em",
            textTransform: "uppercase",
            opacity: isUploading ? 0.55 : 1,
          }}
        >
          {isUploading
            ? "Creating thumbnails…"
            : "Create preview"}
        </button>
      </form>

      {result ? (
        <div
          role="status"
          style={{
            marginTop: "3rem",
            borderTop:
              "1px solid rgba(242, 238, 230, 0.18)",
            paddingTop: "2rem",
          }}
        >
          <p
            style={{
              margin: 0,
              color: result.ok
                ? "#c7a369"
                : "#ffb3a7",
            }}
          >
            {result.message}
          </p>

          {result.archive &&
          result.contents ? (
            <>
              <dl
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "11rem minmax(0, 1fr)",
                  gap: "0.8rem 1.5rem",
                  marginTop: "2rem",
                }}
              >
                <dt>Filename</dt>
                <dd style={{ margin: 0 }}>
                  {result.archive.name}
                </dd>

                <dt>Size</dt>
                <dd style={{ margin: 0 }}>
                  {formatBytes(
                    result.archive.size,
                  )}
                </dd>

                <dt>Suggested slug</dt>
                <dd style={{ margin: 0 }}>
                  {
                    result.archive
                      .suggestedSlug
                  }
                </dd>

                <dt>Photographs found</dt>
                <dd style={{ margin: 0 }}>
                  {
                    result.contents
                      .imageCount
                  }
                </dd>

                <dt>Thumbnails created</dt>
                <dd style={{ margin: 0 }}>
                  {
                    result.contents
                      .previewCount
                  }
                </dd>

                <dt>Details files found</dt>
                <dd style={{ margin: 0 }}>
                  {
                    result.contents
                      .detailsFiles.length
                  }
                </dd>

                <dt>Archive status</dt>
                <dd style={{ margin: 0 }}>
                  Preview only — nothing has
                  been published
                </dd>
              </dl>

              {result.contents
                .previewLimitReached ? (
                <p
                  style={{
                    marginTop: "1.5rem",
                    color:
                      "rgba(242, 238, 230, 0.58)",
                  }}
                >
                  This archive contains more
                  than 120 images. The first
                  120 are shown in this
                  preview.
                </p>
              ) : null}

              {editorialSummary ? (
                <section className="backstage-section">
                  <div className="backstage-section-heading">
                    <h2>Editorial review</h2>

                    <p>Backstage picture edit</p>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(4, minmax(0, 1fr))",
                      gap: "1rem",
                    }}
                  >
                    {[
                      {
                        label: "Suggested edit",
                        value:
                          result.contents.curation
                            .selectedCount,
                      },
                      {
                        label: "Alternatives",
                        value:
                          result.contents.curation
                            .excludedCount,
                      },
                      {
                        label: "Near duplicates",
                        value:
                          result.contents.curation
                            .duplicateCount,
                      },
                      {
                        label: "Average quality",
                        value: `${editorialSummary.averageTechnical}%`,
                      },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        style={{
                          border:
                            "1px solid rgba(242, 238, 230, 0.16)",
                          padding: "1.25rem",
                          background:
                            "rgba(255, 255, 255, 0.025)",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            color: "#c7a369",
                            fontSize: "0.5rem",
                            fontWeight: 700,
                            letterSpacing: "0.15em",
                            textTransform: "uppercase",
                          }}
                        >
                          {label}
                        </p>

                        <p
                          style={{
                            margin: "0.55rem 0 0",
                            fontFamily:
                              '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
                            fontSize: "2rem",
                            lineHeight: 1,
                          }}
                        >
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(0, 1fr) minmax(16rem, 0.7fr)",
                      gap: "2rem",
                      marginTop: "1.5rem",
                      borderTop:
                        "1px solid rgba(242, 238, 230, 0.14)",
                      paddingTop: "1.5rem",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          margin: 0,
                          color: "#c7a369",
                          fontSize: "0.5rem",
                          fontWeight: 700,
                          letterSpacing: "0.15em",
                          textTransform: "uppercase",
                        }}
                      >
                        Recommendation
                      </p>

                      <p
                        style={{
                          maxWidth: "42rem",
                          margin: "0.65rem 0 0",
                          fontFamily:
                            '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
                          fontSize: "1.45rem",
                          lineHeight: 1.35,
                        }}
                      >
                        {editorialSummary.recommendation}
                      </p>
                    </div>

                    <dl
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(2, minmax(0, 1fr))",
                        gap: "1rem",
                        margin: 0,
                      }}
                    >
                      <div>
                        <dt
                          style={{
                            color:
                              "rgba(242, 238, 230, 0.45)",
                            fontSize: "0.48rem",
                            fontWeight: 700,
                            letterSpacing: "0.13em",
                            textTransform: "uppercase",
                          }}
                        >
                          Landscape
                        </dt>
                        <dd
                          style={{
                            margin: "0.3rem 0 0",
                          }}
                        >
                          {editorialSummary.landscapes}
                        </dd>
                      </div>

                      <div>
                        <dt
                          style={{
                            color:
                              "rgba(242, 238, 230, 0.45)",
                            fontSize: "0.48rem",
                            fontWeight: 700,
                            letterSpacing: "0.13em",
                            textTransform: "uppercase",
                          }}
                        >
                          Portrait
                        </dt>
                        <dd
                          style={{
                            margin: "0.3rem 0 0",
                          }}
                        >
                          {editorialSummary.portraits}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </section>
              ) : null}

              <section
                style={{
                  marginTop: "4rem",
                  borderTop:
                    "1px solid rgba(242, 238, 230, 0.18)",
                  paddingTop: "2rem",
                }}
              >
                <p
                  style={{
                    margin: "0 0 1rem",
                    color: "#c7a369",
                    fontSize: "0.55rem",
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                  }}
                >
                  Selected hero
                </p>

                {selectedHero ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(0, 2fr) minmax(14rem, 1fr)",
                      gap: "2rem",
                      alignItems: "end",
                    }}
                  >
                    <img
                      src={
                        selectedHero.previewUrl
                      }
                      alt={`Preview of ${selectedHero.filename}`}
                      style={{
                        display: "block",
                        width: "100%",
                        maxHeight: "68vh",
                        objectFit: "contain",
                        objectPosition:
                          "left bottom",
                        background: "#080808",
                      }}
                    />

                    <div>
                      <h2
                        style={{
                          margin: 0,
                          fontFamily:
                            '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
                          fontSize:
                            "clamp(2rem, 4vw, 4rem)",
                          fontWeight: 400,
                          lineHeight: 1,
                        }}
                      >
                        {
                          selectedHero.filename
                        }
                      </h2>

                      <p
                        style={{
                          color:
                            "rgba(242, 238, 230, 0.62)",
                          lineHeight: 1.6,
                        }}
                      >
                        {selectedHero.width &&
                        selectedHero.height
                          ? `${selectedHero.width} × ${selectedHero.height} · `
                          : ""}
                        {
                          selectedHero.orientation
                        }
                      </p>

                      <p
                        style={{
                          color: "#c7a369",
                          fontSize: "0.55rem",
                          fontWeight: 700,
                          letterSpacing: "0.16em",
                          textTransform:
                            "uppercase",
                        }}
                      >
                        {selectedHero.filepath ===
                        result.contents
                          .suggestedHeroPath
                          ? "Automatic suggestion"
                          : "Your selection"}
                      </p>

                      <div
                        style={{
                          marginTop: "1.5rem",
                          borderTop:
                            "1px solid rgba(242, 238, 230, 0.14)",
                          paddingTop: "1.25rem",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            color: "#c7a369",
                            fontSize: "0.5rem",
                            fontWeight: 700,
                            letterSpacing: "0.15em",
                            textTransform: "uppercase",
                          }}
                        >
                          {starRating(
                            selectedHero.heroScore,
                          )}{" "}
                          {scoreLabel(
                            selectedHero.heroScore,
                          )} hero candidate
                        </p>

                        <ul
                          style={{
                            margin: "0.9rem 0 0",
                            paddingLeft: "1.1rem",
                            color:
                              "rgba(242, 238, 230, 0.68)",
                            lineHeight: 1.65,
                          }}
                        >
                          {editorialAssessment(
                            selectedHero,
                          ).map((reason) => (
                            <li key={reason}>
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p>
                    No hero image is currently
                    selected.
                  </p>
                )}
              </section>

              <section
                style={{
                  marginTop: "4rem",
                  borderTop:
                    "1px solid rgba(242, 238, 230, 0.18)",
                  paddingTop: "2rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    gap: "2rem",
                    alignItems: "baseline",
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontFamily:
                        '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
                      fontSize:
                        "clamp(2rem, 4vw, 4rem)",
                      fontWeight: 400,
                    }}
                  >
                    Photographs
                  </h2>

                  <p
                    style={{
                      margin: 0,
                      color:
                        "rgba(242, 238, 230, 0.5)",
                      fontSize: "0.55rem",
                      letterSpacing: "0.14em",
                      textTransform:
                        "uppercase",
                    }}
                  >
                    Select an image to use as
                    the hero
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
                  {displayedImages.map(
                    (image) => {
                      const isSelected =
                        image.filepath ===
                        selectedHeroPath;

                      return (
                        <button
                          type="button"
                          key={image.filepath}
                          onClick={() =>
                            setSelectedHeroPath(
                              image.filepath,
                            )
                          }
                          aria-pressed={
                            isSelected
                          }
                          style={{
                            padding: 0,
                            overflow:
                              "hidden",
                            border:
                              isSelected
                                ? "2px solid #c7a369"
                                : "1px solid rgba(242, 238, 230, 0.16)",
                            background:
                              "#080808",
                            color: "inherit",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <div
                            style={{
                              aspectRatio:
                                "4 / 3",
                              background:
                                "#080808",
                            }}
                          >
                            <img
                              src={
                                image.previewUrl
                              }
                              alt={`Preview of ${image.filename}`}
                              loading="lazy"
                              style={{
                                display:
                                  "block",
                                width: "100%",
                                height: "100%",
                                objectFit:
                                  "contain",
                              }}
                            />
                          </div>

                          <div
                            style={{
                              padding:
                                "0.85rem",
                            }}
                          >
                            <p
                              style={{
                                margin: 0,
                                overflow:
                                  "hidden",
                                fontSize:
                                  "0.68rem",
                                lineHeight:
                                  1.35,
                                textOverflow:
                                  "ellipsis",
                                whiteSpace:
                                  "nowrap",
                              }}
                            >
                              {
                                image.filename
                              }
                            </p>

                            <p
                              style={{
                                margin:
                                  "0.4rem 0 0",
                                color:
                                  isSelected
                                    ? "#c7a369"
                                    : "rgba(242, 238, 230, 0.42)",
                                fontSize:
                                  "0.48rem",
                                fontWeight:
                                  700,
                                letterSpacing:
                                  "0.13em",
                                textTransform:
                                  "uppercase",
                              }}
                            >
                              {isSelected
                                ? "Selected hero"
                                : imageStatus(image)}
                            </p>

                            <p
                              style={{
                                margin: "0.45rem 0 0",
                                color:
                                  "rgba(242, 238, 230, 0.55)",
                                fontSize: "0.52rem",
                                lineHeight: 1.45,
                              }}
                            >
                              {image.suggestion.include
                                ? `Position #${image.suggestion.order ?? "—"} · ${image.suggestion.layout}`
                                : image.suggestion.duplicateOf
                                  ? `Similar to ${filenameOnly(
                                      image.suggestion.duplicateOf,
                                    )}`
                                  : "Available as an alternative"}
                            </p>

                            <p
                              style={{
                                margin: "0.45rem 0 0",
                                color:
                                  "rgba(242, 238, 230, 0.42)",
                                fontSize: "0.5rem",
                                lineHeight: 1.45,
                              }}
                            >
                              {scoreLabel(
                                image.metrics.galleryScore,
                              )}{" "}
                              gallery potential ·{" "}
                              {
                                image.metrics
                                  .galleryScore
                              }
                              /100
                            </p>
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              </section>

              <section className="backstage-section">
                <div className="backstage-section-heading">
                  <h2>Production information</h2>

                  <p>
                    {result.contents.extractedDetails.sourceFile
                      ? `Read from ${filenameOnly(
                          result.contents.extractedDetails.sourceFile,
                        )}`
                      : "Enter production details"}
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap: "1.5rem",
                  }}
                >
                  {[
                    {
                      label: "Production title",
                      field: "title",
                    },
                    {
                      label: "Venue",
                      field: "venue",
                    },
                    {
                      label: "Year",
                      field: "year",
                    },
                    {
                      label: "Director",
                      field: "director",
                    },
                    {
                      label: "Associate Director",
                      field: "associateDirector",
                    },
                    {
                      label: "Musical Director",
                      field: "musicalDirector",
                    },
                    {
                      label: "Choreographer",
                      field: "choreographer",
                    },
                    {
                      label: "Lighting Design",
                      field: "lightingDesign",
                    },
                    {
                      label: "Set Design",
                      field: "setDesign",
                    },
                    {
                      label: "Costume Design",
                      field: "costumeDesign",
                    },
                    {
                      label: "Set & Costume Design",
                      field: "setCostumeDesign",
                    },
                    {
                      label: "Sound Design",
                      field: "soundDesign",
                    },
                    {
                      label: "Commissioned by",
                      field: "commissionedBy",
                    },
                  ].map(({ label, field }) => {
                    const fieldName =
                      field as keyof EditableProductionFields;

                    return (
                      <label
                        key={field}
                        style={{
                          display: "grid",
                          gap: "0.55rem",
                        }}
                      >
                        <span
                          style={{
                            color: "#c7a369",
                            fontSize: "0.52rem",
                            fontWeight: 700,
                            letterSpacing: "0.15em",
                            textTransform: "uppercase",
                          }}
                        >
                          {label}
                        </span>

                        <input
                          type={
                            field === "year"
                              ? "number"
                              : "text"
                          }
                          value={
                            productionFields[fieldName]
                          }
                          onChange={(event) =>
                            updateProductionField(
                              fieldName,
                              event.target.value,
                            )
                          }
                          style={{
                            width: "100%",
                            border:
                              "1px solid rgba(242, 238, 230, 0.2)",
                            padding: "0.95rem 1rem",
                            background:
                              "rgba(255, 255, 255, 0.025)",
                            color: "#f2eee6",
                            font: "inherit",
                          }}
                        />
                      </label>
                    );
                  })}
                </div>

                <label
                  style={{
                    display: "grid",
                    gap: "0.55rem",
                    marginTop: "1.5rem",
                  }}
                >
                  <span
                    style={{
                      color: "#c7a369",
                      fontSize: "0.52rem",
                      fontWeight: 700,
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                    }}
                  >
                    Description
                  </span>

                  <textarea
                    value={productionFields.description}
                    onChange={(event) =>
                      updateProductionField(
                        "description",
                        event.target.value,
                      )
                    }
                    rows={5}
                    style={{
                      width: "100%",
                      resize: "vertical",
                      border:
                        "1px solid rgba(242, 238, 230, 0.2)",
                      padding: "1rem",
                      background:
                        "rgba(255, 255, 255, 0.025)",
                      color: "#f2eee6",
                      font: "inherit",
                      lineHeight: 1.6,
                    }}
                  />
                </label>
              </section>
              <section className="backstage-section">
  <div className="backstage-section-heading">
    <h2>Review</h2>

    <p>Preview before publishing</p>
  </div>

  <div
  style={{
    display: "flex",
    gap: "1rem",
    flexWrap: "wrap",
  }}
>
  <button
    type="button"
    className="backstage-button"
    disabled={!result?.contents || isReviewing}
    onClick={runVisionReview}
  >
    {isReviewing
      ? "Vision AI reviewing..."
      : "Vision AI Review"}
  </button>

  <button
  type="button"
  className="backstage-button backstage-button-primary"
  disabled={!selectedHero}
  onClick={() => setShowWebsitePreview(true)}
>
  Preview website
  <span aria-hidden="true">→</span>
</button>

<button
  type="button"
  className="backstage-button backstage-button-primary"
  disabled={isPublishing}
  onClick={publishProduction}
>
  {isPublishing
    ? "Publishing production…"
    : "Publish production"}
  <span aria-hidden="true">→</span>
</button>

</div>

{visionReview ? (
  <div
    style={{
      marginTop: "2rem",
      border: "1px solid rgba(242,238,230,.15)",
      padding: "1.5rem",
    }}
  >

    <h3>Vision AI Editorial Review</h3>

    <div style={{ marginTop: "1.25rem" }}>
      <p
        style={{
          margin: "0 0 0.75rem",
          color: "#c7a369",
          fontSize: "0.55rem",
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        ★ Vision AI hero
      </p>

      {aiHeroImage ? (
        <img
          src={aiHeroImage.previewUrl}
          alt={`Vision AI hero recommendation: ${aiHeroImage.filename}`}
          style={{
            display: "block",
            width: "100%",
            maxWidth: "760px",
            maxHeight: "65vh",
            objectFit: "contain",
            objectPosition: "left center",
            background: "#080808",
          }}
        />
      ) : (
        <p>{visionReview.hero}</p>
      )}

      <p
        style={{
          maxWidth: "48rem",
          margin: "1.25rem 0 0",
          fontFamily:
            '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
          fontSize: "1.25rem",
          lineHeight: 1.5,
        }}
      >
        {visionReview.heroReason}
      </p>
    </div>

    <p>
      <strong>Editorial Summary</strong><br />
      {visionReview.editorialSummary}
    </p>

    <div style={{ marginTop: "2rem" }}>
      <p
        style={{
          margin: "0 0 0.85rem",
          color: "#c7a369",
          fontSize: "0.55rem",
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        Keep
      </p>

      {aiKeepImages.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(9rem, 1fr))",
            gap: "0.8rem",
          }}
        >
          {aiKeepImages.map((image) => (
            <div
              key={image.filepath}
              style={{
                overflow: "hidden",
                border:
                  "1px solid rgba(199, 163, 105, 0.45)",
                background: "#080808",
              }}
            >
              <div
                style={{
                  aspectRatio: "4 / 3",
                  background: "#080808",
                }}
              >
                <img
                  src={image.previewUrl}
                  alt={`Vision AI keep recommendation: ${image.filename}`}
                  loading="lazy"
                  style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p
          style={{
            margin: 0,
            color:
              "rgba(242, 238, 230, 0.55)",
          }}
        >
          No matching keep images were found.
        </p>
      )}
    </div>

    <div style={{ marginTop: "2rem" }}>
      <p
        style={{
          margin: "0 0 0.85rem",
          color: "#ffb3a7",
          fontSize: "0.55rem",
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        Remove
      </p>

      {aiRemoveImages.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(9rem, 1fr))",
            gap: "0.8rem",
          }}
        >
          {aiRemoveImages.map((image) => (
            <div
              key={image.filepath}
              style={{
                overflow: "hidden",
                border:
                  "1px solid rgba(255, 179, 167, 0.38)",
                background: "#080808",
                opacity: 0.72,
              }}
            >
              <div
                style={{
                  aspectRatio: "4 / 3",
                  background: "#080808",
                }}
              >
                <img
                  src={image.previewUrl}
                  alt={`Vision AI remove recommendation: ${image.filename}`}
                  loading="lazy"
                  style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p
          style={{
            margin: 0,
            color:
              "rgba(242, 238, 230, 0.55)",
          }}
        >
          Vision AI did not recommend removing any images.
        </p>
      )}
    </div>
  </div>
) : null}

{publishResult ? (
  <div
    role="status"
    style={{
      marginTop: "1.5rem",
      border: `1px solid ${
        publishResult.ok
          ? "rgba(199, 163, 105, 0.55)"
          : "rgba(255, 179, 167, 0.45)"
      }`,
      padding: "1.5rem",
      background: publishResult.ok
        ? "rgba(199, 163, 105, 0.06)"
        : "rgba(255, 179, 167, 0.04)",
    }}
  >
    <p
      style={{
        margin: 0,
        color: publishResult.ok
          ? "#c7a369"
          : "#ffb3a7",
        fontFamily:
          '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
        fontSize: "1.35rem",
        lineHeight: 1.4,
      }}
    >
      {publishResult.message}
    </p>

    {publishResult.ok &&
    publishResult.production ? (
      <div style={{ marginTop: "1.25rem" }}>
        <p
          style={{
            margin: 0,
            color:
              "rgba(242, 238, 230, 0.62)",
            lineHeight: 1.7,
          }}
        >
          {publishResult.production.imageCount} gallery
          images copied · Hero:{" "}
          {publishResult.production.hero}
        </p>

        <a
          href={publishResult.production.url}
          target="_blank"
          rel="noreferrer"
          className="backstage-button backstage-button-primary"
          style={{
            display: "inline-flex",
            marginTop: "1.25rem",
            textDecoration: "none",
          }}
        >
          View production
          <span aria-hidden="true">→</span>
        </a>
      </div>
    ) : null}
  </div>
) : null}

  {!selectedHero ? (
    <p
      style={{
        marginTop: "1rem",
        color: "rgba(242, 238, 230, 0.55)",
      }}
    >
      Select a hero image before opening the website preview.
    </p>
    
  ) : null}
</section>

              <section
                style={{
                  marginTop: "4rem",
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
                    fontSize:
                      "clamp(2rem, 4vw, 4rem)",
                    fontWeight: 400,
                  }}
                >
                  Details files
                </h2>

                {result.contents
                  .detailsFiles.length > 0 ? (
                  <ul>
                    {result.contents.detailsFiles.map(
                      (filepath) => (
                        <li key={filepath}>
                          {filenameOnly(
                            filepath,
                          )}
                        </li>
                      ),
                    )}
                  </ul>
                ) : (
                  <p>
                    No text, RTF, Word or PDF
                    details file was found.
                  </p>
                )}
              </section>
            </>
          ) : null}
        </div>
      ) : null}
      {showWebsitePreview &&
selectedHero &&
result?.contents ? (
  <ProductionWebsitePreview
    fields={productionFields}
    hero={selectedHero}
    images={curatedImages}
    onClose={() =>
      setShowWebsitePreview(false)
    }
  />
) : null}
    </section>
  );
}