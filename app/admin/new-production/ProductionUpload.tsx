"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";

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
  };
};

type EditableProductionFields = ExtractedProductionFields;

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
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] =
    useState<UploadResult | null>(null);

  const [
    selectedHeroPath,
    setSelectedHeroPath,
  ] = useState<string | null>(null);

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
    setProductionFields({
      ...EMPTY_PRODUCTION_FIELDS,
    });

    const formData = new FormData(
      event.currentTarget,
    );

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
                  {result.contents.images.map(
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
                                : image.orientation}
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
    </section>
  );
}