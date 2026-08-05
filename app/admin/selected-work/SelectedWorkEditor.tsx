"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

type CategoryId =
  | "production"
  | "rehearsal"
  | "campaign";

type SelectedWorkImage = {
  filename: string;
  suggestedFilename?: string;
  alt: string;
  uploadedAt: string;
};

type SelectedWorkData = Record<
  CategoryId,
  SelectedWorkImage[]
>;

type ApiResponse = {
  ok: boolean;
  data?: SelectedWorkData;
  message?: string;
};

type VisionMetadata = {
  alt: string;
  filename: string;
  layout: string;
};

type VisionResponse = {
  ok: boolean;
  image?: string;
  metadata?: VisionMetadata;
  message?: string;
};

const EMPTY_DATA: SelectedWorkData = {
  production: [],
  rehearsal: [],
  campaign: [],
};

const CATEGORIES: Array<{
  id: CategoryId;
  number: string;
  title: string;
  description: string;
}> = [
  {
    id: "production",
    number: "01",
    title: "Production Photography",
    description:
      "Your principal performance and production images.",
  },
  {
    id: "rehearsal",
    number: "02",
    title: "Rehearsal & Backstage",
    description:
      "The rehearsal process, preparation and work off stage.",
  },
  {
    id: "campaign",
    number: "03",
    title: "Campaign & PR",
    description:
      "Press, marketing, publicity and campaign imagery.",
  },
];

export default function SelectedWorkEditor() {
  const [data, setData] =
    useState<SelectedWorkData>(EMPTY_DATA);

  const [pendingFiles, setPendingFiles] = useState<
    Partial<Record<CategoryId, FileList>>
  >({});

  const [loading, setLoading] = useState(true);

  const [busyCategory, setBusyCategory] =
    useState<CategoryId | null>(null);

  const [analysingCategory, setAnalysingCategory] =
    useState<CategoryId | null>(null);

  const [analysisProgress, setAnalysisProgress] =
    useState<{
      current: number;
      total: number;
    } | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/admin/selected-work",
        {
          cache: "no-store",
        },
      );

      const result =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !result.ok ||
        !result.data
      ) {
        throw new Error(
          result.message ??
            "Selected Work could not be loaded.",
        );
      }

      setData(result.data);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Selected Work could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  function updateImage(
    category: CategoryId,
    index: number,
    changes: Partial<SelectedWorkImage>,
  ) {
    setData((current) => ({
      ...current,
      [category]: current[category].map(
        (image, imageIndex) =>
          imageIndex === index
            ? { ...image, ...changes }
            : image,
      ),
    }));

    setMessage(null);
  }

  function moveImage(
    category: CategoryId,
    index: number,
    direction: -1 | 1,
  ) {
    const nextIndex = index + direction;
    const images = data[category];

    if (
      nextIndex < 0 ||
      nextIndex >= images.length
    ) {
      return;
    }

    const nextImages = [...images];
    const [image] = nextImages.splice(index, 1);
    nextImages.splice(nextIndex, 0, image);

    setData((current) => ({
      ...current,
      [category]: nextImages,
    }));

    setMessage(null);
  }

  async function uploadImages(
    category: CategoryId,
  ) {
    const files = pendingFiles[category];

    if (
      !files ||
      files.length === 0 ||
      busyCategory ||
      analysingCategory
    ) {
      return;
    }

    setBusyCategory(category);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.set("category", category);

      Array.from(files).forEach((file) => {
        formData.append("images", file);
      });

      const response = await fetch(
        "/api/admin/selected-work",
        {
          method: "POST",
          body: formData,
        },
      );

      const result =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !result.ok ||
        !result.data
      ) {
        throw new Error(
          result.message ??
            "The photographs could not be uploaded.",
        );
      }

      setData(result.data);

      setPendingFiles((current) => ({
        ...current,
        [category]: undefined,
      }));

      setMessage(
        "Photographs uploaded successfully.",
      );

      const input = document.getElementById(
        `selected-work-upload-${category}`,
      ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The photographs could not be uploaded.",
      );
    } finally {
      setBusyCategory(null);
    }
  }

  async function analyseNewImages(
    category: CategoryId,
  ) {
    if (busyCategory || analysingCategory) {
      return;
    }

    const imagesToAnalyse = data[category]
      .map((image, index) => ({
        image,
        index,
      }))
      .filter(({ image }) => !image.alt.trim());

    if (imagesToAnalyse.length === 0) {
      setMessage(
        `${categoryLabel(category)} has no images with blank alt text.`,
      );
      setError(null);
      return;
    }

    setAnalysingCategory(category);
    setAnalysisProgress({
      current: 0,
      total: imagesToAnalyse.length,
    });
    setError(null);
    setMessage(null);

    try {
      for (
        let itemIndex = 0;
        itemIndex < imagesToAnalyse.length;
        itemIndex += 1
      ) {
        const { image, index } =
          imagesToAnalyse[itemIndex];

        setAnalysisProgress({
          current: itemIndex + 1,
          total: imagesToAnalyse.length,
        });

        const response = await fetch(
          "/api/admin/vision/analyse-image",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              selectedWorkCategory: category,
              image: image.filename,
            }),
          },
        );

        const result =
          (await response.json()) as VisionResponse;

        if (
          !response.ok ||
          !result.ok ||
          !result.metadata
        ) {
          throw new Error(
            result.message ??
              `Vision AI could not analyse ${image.filename}.`,
          );
        }

        setData((current) => ({
          ...current,
          [category]: current[category].map(
            (currentImage, currentIndex) =>
              currentIndex === index
                ? {
  ...currentImage,
  alt: result.metadata?.alt ?? "",
  suggestedFilename:
    result.metadata?.filename ?? "",
}
                : currentImage,
          ),
        }));
      }

      setMessage(
        `${categoryLabel(category)} AI analysis completed. Review the alt text, then save the collection.`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Vision AI analysis failed.",
      );
    } finally {
      setAnalysingCategory(null);
      setAnalysisProgress(null);
    }
  }

  async function saveCategory(
    category: CategoryId,
  ) {
    if (busyCategory || analysingCategory) {
      return;
    }

    setBusyCategory(category);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/admin/selected-work",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            category,
            images: data[category],
          }),
        },
      );

      const result =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !result.ok ||
        !result.data
      ) {
        throw new Error(
          result.message ??
            "The collection could not be saved.",
        );
      }

      setData(result.data);

      setMessage(
        `${categoryLabel(category)} saved successfully.`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The collection could not be saved.",
      );
    } finally {
      setBusyCategory(null);
    }
  }

  async function deleteImage(
    category: CategoryId,
    filename: string,
  ) {
    const confirmed = window.confirm(
      `Permanently remove ${filename} from Selected Work?`,
    );

    if (
      !confirmed ||
      busyCategory ||
      analysingCategory
    ) {
      return;
    }

    setBusyCategory(category);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/admin/selected-work",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            category,
            filename,
          }),
        },
      );

      const result =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        !result.ok ||
        !result.data
      ) {
        throw new Error(
          result.message ??
            "The photograph could not be removed.",
        );
      }

      setData(result.data);
      setMessage(
        "Photograph removed successfully.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The photograph could not be removed.",
      );
    } finally {
      setBusyCategory(null);
    }
  }

  const totalImages = useMemo(
    () =>
      Object.values(data).reduce(
        (total, images) =>
          total + images.length,
        0,
      ),
    [data],
  );

  if (loading) {
    return (
      <p style={{ marginTop: "4rem" }}>
        Loading Selected Work…
      </p>
    );
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "2rem",
          alignItems: "baseline",
          marginTop: "5rem",
          borderBottom:
            "1px solid rgba(242, 238, 230, 0.18)",
          paddingBottom: "1rem",
        }}
      >
        <p
          className="backstage-eyebrow"
          style={{ margin: 0 }}
        >
          Portfolio collections
        </p>

        <p
          style={{
            margin: 0,
            color: "rgba(242, 238, 230, 0.48)",
            fontSize: "0.55rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {totalImages} images
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          style={{
            color: "#ffb3a7",
            marginTop: "1.5rem",
          }}
        >
          {error}
        </p>
      ) : null}

      {message ? (
        <p
          role="status"
          style={{
            color: "#c7a369",
            marginTop: "1.5rem",
          }}
        >
          {message}
        </p>
      ) : null}

      {CATEGORIES.map((category) => {
        const images = data[category.id];

        const isBusy =
          busyCategory === category.id;

        const isAnalysing =
          analysingCategory === category.id;

        const selectedFiles =
          pendingFiles[category.id];

        const blankAltCount = images.filter(
          (image) => !image.alt.trim(),
        ).length;

        const controlsDisabled =
          Boolean(busyCategory) ||
          Boolean(analysingCategory);

        return (
          <section
            key={category.id}
            style={{
              borderBottom:
                "1px solid rgba(242, 238, 230, 0.18)",
              padding: "4rem 0 5rem",
            }}
          >
            <header
              style={{
                display: "grid",
                gridTemplateColumns:
                  "3rem minmax(0, 1fr)",
                gap: "2rem",
              }}
            >
              <p
                className="backstage-eyebrow"
                style={{ marginTop: "0.75rem" }}
              >
                {category.number}
              </p>

              <div>
                <h2
                  style={{
                    margin: 0,
                    fontFamily:
                      '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
                    fontSize:
                      "clamp(2.4rem, 5vw, 5rem)",
                    fontWeight: 400,
                    lineHeight: 0.95,
                  }}
                >
                  {category.title}
                </h2>

                <p
                  style={{
                    maxWidth: "42rem",
                    margin: "1rem 0 0",
                    color:
                      "rgba(242, 238, 230, 0.58)",
                    lineHeight: 1.7,
                  }}
                >
                  {category.description}
                </p>
              </div>
            </header>

            <div
              className="backstage-panel"
              style={{
                padding: "1.5rem",
                marginTop: "2.5rem",
              }}
            >
              <label className="backstage-field">
                <span className="backstage-field-label">
                  Add JPEG photographs
                </span>

                <input
                  id={`selected-work-upload-${category.id}`}
                  type="file"
                  accept="image/jpeg,.jpg,.jpeg"
                  multiple
                  disabled={controlsDisabled}
                  onChange={(
                    event: ChangeEvent<HTMLInputElement>,
                  ) => {
                    if (event.target.files) {
                      setPendingFiles((current) => ({
                        ...current,
                        [category.id]:
                          event.target.files ??
                          undefined,
                      }));
                    }
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    border:
                      "1px solid rgba(242, 238, 230, 0.2)",
                    padding: "1rem",
                    background:
                      "rgba(255, 255, 255, 0.025)",
                    color: "inherit",
                  }}
                />
              </label>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                  marginTop: "1rem",
                }}
              >
                <button
                  type="button"
                  className="backstage-button"
                  disabled={
                    !selectedFiles?.length ||
                    controlsDisabled
                  }
                  onClick={() =>
                    void uploadImages(category.id)
                  }
                >
                  {isBusy
                    ? "Working…"
                    : "Upload photographs"}
                </button>

                <button
                  type="button"
                  className="backstage-button"
                  disabled={
                    blankAltCount === 0 ||
                    controlsDisabled
                  }
                  onClick={() =>
                    void analyseNewImages(
                      category.id,
                    )
                  }
                >
                  {isAnalysing &&
                  analysisProgress
                    ? `Analysing ${analysisProgress.current} of ${analysisProgress.total}…`
                    : `Analyse new images (${blankAltCount})`}
                </button>
              </div>

              <p
                style={{
                  margin: "0.9rem 0 0",
                  color:
                    "rgba(242, 238, 230, 0.45)",
                  fontSize: "0.72rem",
                  lineHeight: 1.6,
                }}
              >
                Vision AI analyses only images whose
                alt-text field is blank.
              </p>
            </div>

            {images.length === 0 ? (
              <p
                style={{
                  margin: "2rem 0 0",
                  color:
                    "rgba(242, 238, 230, 0.45)",
                }}
              >
                No photographs uploaded to this
                collection yet.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(min(100%, 20rem), 1fr))",
                  gap: "1rem",
                  marginTop: "2rem",
                }}
              >
                {images.map((image, index) => (
                  <article
                    key={image.filename}
                    style={{
                      overflow: "hidden",
                      border:
                        "1px solid rgba(242, 238, 230, 0.14)",
                      background:
                        "rgba(255, 255, 255, 0.02)",
                    }}
                  >
                    <div
                      style={{
                        aspectRatio: "4 / 3",
                        background: "#080808",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/images/selected-work/${category.id}/${image.filename}`}
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

                    <div style={{ padding: "1rem" }}>
                      <p className="backstage-field-label">
                        Filename
                      </p>

                      <p
                        title={image.filename}
                        style={{
                          overflow: "hidden",
                          margin: "0.4rem 0 0",
                          textOverflow:
                            "ellipsis",
                          whiteSpace: "nowrap",
                          fontSize: "0.68rem",
                        }}
                      >
                        {image.filename}
                      </p>
                      <label
  className="backstage-field"
  style={{ marginTop: "1rem" }}
>
  <span className="backstage-field-label">
    Suggested filename
  </span>

  <input
    className="backstage-input"
    value={image.suggestedFilename ?? ""}
    placeholder="AI filename"
    onChange={(event) =>
      updateImage(category.id, index, {
        suggestedFilename: event.target.value,
      })
    }
  />
</label>

                      <label
                        className="backstage-field"
                        style={{
                          marginTop: "1rem",
                        }}
                      >
                        <span className="backstage-field-label">
                          Alt text
                        </span>

                        <textarea
                          className="backstage-textarea"
                          rows={4}
                          value={image.alt}
                          onChange={(event) =>
                            updateImage(
                              category.id,
                              index,
                              {
                                alt: event.target
                                  .value,
                              },
                            )
                          }
                        />
                      </label>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(2, minmax(0, 1fr))",
                          gap: "0.6rem",
                          marginTop: "1rem",
                        }}
                      >
                        <button
                          type="button"
                          className="backstage-button"
                          disabled={
                            index === 0 ||
                            controlsDisabled
                          }
                          onClick={() =>
                            moveImage(
                              category.id,
                              index,
                              -1,
                            )
                          }
                        >
                          Move earlier
                        </button>

                        <button
                          type="button"
                          className="backstage-button"
                          disabled={
                            index ===
                              images.length - 1 ||
                            controlsDisabled
                          }
                          onClick={() =>
                            moveImage(
                              category.id,
                              index,
                              1,
                            )
                          }
                        >
                          Move later
                        </button>
                      </div>

                      <button
                        type="button"
                        className="backstage-button"
                        disabled={controlsDisabled}
                        onClick={() =>
                          void deleteImage(
                            category.id,
                            image.filename,
                          )
                        }
                        style={{
                          width: "100%",
                          marginTop: "0.6rem",
                        }}
                      >
                        Remove image
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "2rem",
              }}
            >
              <button
                type="button"
                className="backstage-button backstage-button-primary"
                disabled={controlsDisabled}
                onClick={() =>
                  void saveCategory(category.id)
                }
              >
                {isBusy
                  ? "Saving…"
                  : `Save ${category.title}`}
              </button>
            </div>
          </section>
        );
      })}
    </>
  );
}

function categoryLabel(category: CategoryId) {
  switch (category) {
    case "production":
      return "Production Photography";

    case "rehearsal":
      return "Rehearsal & Backstage";

    case "campaign":
      return "Campaign & PR";
  }
}