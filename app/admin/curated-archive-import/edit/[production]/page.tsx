"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";

import CreditsEditor from "../../../../../components/admin/editor/CreditsEditor";

type Credit = {
  role: string;
  name: string;
  website?: string;
};

type CuratedImage = {
  sequence: number | null;
  index: number;
  hero: boolean;
  stagedFile: string;
  sourceName: string;
};

type CuratedProduction = {
  production: string;
  folder: string;
  title: string;
  venue: string;
  month: number | null;
  year: number | null;
  description: string;
  credits: Credit[];
  edited: boolean;
  metadataEdited: boolean;
  imageEdited: boolean;
  heroIndex: number | null;
  selectedCount: number;
  images: CuratedImage[];
};

type LoadResult = {
  ok: boolean;
  message?: string;
  production?: CuratedProduction;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function CuratedProductionEditPage() {
  const params =
    useParams<{
      production: string;
    }>();

  const router = useRouter();

  const productionName =
    decodeURIComponent(
      params.production,
    );

  const [original, setOriginal] =
    useState<CuratedProduction | null>(
      null,
    );

  const [title, setTitle] =
    useState("");

  const [venue, setVenue] =
    useState("");

  const [month, setMonth] =
    useState("");

  const [year, setYear] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [credits, setCredits] =
    useState<Credit[]>([]);

  const [images, setImages] =
    useState<CuratedImage[]>([]);

  const [heroIndex, setHeroIndex] =
    useState<number | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState<
      "success" | "error" | null
    >(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProduction() {
      setLoading(true);
      setMessage("");
      setMessageType(null);

      try {
        const response =
          await fetch(
            `/api/admin/curated-archive-import/edit?production=${encodeURIComponent(
              productionName,
            )}`,
            {
              cache: "no-store",
            },
          );

        const result =
          (await response.json()) as
            LoadResult;

        if (
          !response.ok ||
          !result.ok ||
          !result.production
        ) {
          throw new Error(
            result.message ||
              "Curated production could not be loaded.",
          );
        }

        if (cancelled) {
          return;
        }

        const production =
          result.production;

        setOriginal(production);
        setTitle(production.title);
        setVenue(production.venue);
        setMonth(
          production.month
            ? String(
                production.month,
              )
            : "",
        );
        setYear(
          production.year
            ? String(
                production.year,
              )
            : "",
        );
        setDescription(
          production.description,
        );
        setCredits(
          production.credits,
        );
        setImages(
          production.images,
        );
        setHeroIndex(
          production.heroIndex,
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "Curated production could not be loaded.",
        );
        setMessageType("error");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProduction();

    return () => {
      cancelled = true;
    };
  }, [productionName]);

  const parsedMonth =
    Number.parseInt(
      month,
      10,
    );

  const parsedYear =
    Number.parseInt(
      year,
      10,
    );

  const hasChanges =
    Boolean(
      original &&
        (
          title.trim() !==
            original.title ||
          venue.trim() !==
            original.venue ||
          parsedMonth !==
            original.month ||
          parsedYear !==
            original.year ||
          description.trim() !==
            original.description ||
          JSON.stringify(credits) !==
            JSON.stringify(
              original.credits,
            )
        ),
    );

  const hasImageChanges =
    Boolean(
      original &&
        (
          heroIndex !==
            original.heroIndex ||
          JSON.stringify(
            images.map(
              (image) =>
                image.index,
            ),
          ) !==
            JSON.stringify(
              original.images.map(
                (image) =>
                  image.index,
              ),
            )
        ),
    );

  function clearMessage() {
    setMessage("");
    setMessageType(null);
  }

  function makeHero(
    index: number,
  ) {
    setHeroIndex(index);
    setImages(
      (current) =>
        current.map(
          (image) => ({
            ...image,
            hero:
              image.index ===
              index,
          }),
        ),
    );
    clearMessage();
  }

  function moveImage(
    index: number,
    direction: -1 | 1,
  ) {
    setImages(
      (current) => {
        const position =
          current.findIndex(
            (image) =>
              image.index ===
              index,
          );

        const nextPosition =
          position + direction;

        if (
          position < 0 ||
          nextPosition < 0 ||
          nextPosition >=
            current.length
        ) {
          return current;
        }

        const next =
          [...current];

        [
          next[position],
          next[nextPosition],
        ] = [
          next[nextPosition],
          next[position],
        ];

        return next.map(
          (image, sequence) => ({
            ...image,
            sequence:
              sequence + 1,
          }),
        );
      },
    );

    clearMessage();
  }

  function removeImage(
    index: number,
  ) {
    if (index === heroIndex) {
      setMessage(
        "Choose a different hero before removing the current hero.",
      );
      setMessageType("error");
      return;
    }

    if (images.length <= 1) {
      setMessage(
        "A production must retain at least one selected image.",
      );
      setMessageType("error");
      return;
    }

    setImages(
      (current) =>
        current
          .filter(
            (image) =>
              image.index !==
              index,
          )
          .map(
            (image, sequence) => ({
              ...image,
              sequence:
                sequence + 1,
            }),
          ),
    );

    clearMessage();
  }

  function discardImageChanges() {
    if (!original) {
      return;
    }

    setImages(
      original.images,
    );
    setHeroIndex(
      original.heroIndex,
    );
    clearMessage();
  }

  async function resetImageSelection() {
    if (!original?.imageEdited) {
      return;
    }

    if (
      !window.confirm(
        `Reset "${original.title}" to the curator's original image selection, hero and order?`,
      )
    ) {
      return;
    }

    setSaving(true);
    clearMessage();

    try {
      const response =
        await fetch(
          "/api/admin/curated-archive-import/edit",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              production:
                original.production,
              reset: "images",
            }),
          },
        );

      const result =
        (await response.json()) as {
          ok?: boolean;
          message?: string;
        };

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ||
            "Image selection could not be reset.",
        );
      }

      const reloadResponse =
        await fetch(
          `/api/admin/curated-archive-import/edit?production=${encodeURIComponent(
            original.production,
          )}`,
          {
            cache: "no-store",
          },
        );

      const reloadResult =
        (await reloadResponse.json()) as
          LoadResult;

      if (
        !reloadResponse.ok ||
        !reloadResult.ok ||
        !reloadResult.production
      ) {
        throw new Error(
          reloadResult.message ||
            "Image selection reset, but curated production could not be reloaded.",
        );
      }

      const production =
        reloadResult.production;

      setOriginal(production);
      setImages(
        production.images,
      );
      setHeroIndex(
        production.heroIndex,
      );

      setMessage(
        "Curator image selection restored.",
      );
      setMessageType("success");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Image selection could not be reset.",
      );
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  async function saveImageChanges() {
    if (
      !original ||
      !hasImageChanges ||
      heroIndex === null
    ) {
      return;
    }

    setSaving(true);
    clearMessage();

    try {
      const response =
        await fetch(
          "/api/admin/curated-archive-import/edit",
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              production:
                original.production,
              heroIndex,
              selectedIndexes:
                images.map(
                  (image) =>
                    image.index,
                ),
            }),
          },
        );

      const result =
        (await response.json()) as {
          ok?: boolean;
          message?: string;
        };

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ||
            "Image changes could not be saved.",
        );
      }

      const nextImages =
        images.map(
          (image, sequence) => ({
            ...image,
            sequence:
              sequence + 1,
            hero:
              image.index ===
              heroIndex,
          }),
        );

      setImages(nextImages);

      setOriginal({
        ...original,
        images: nextImages,
        heroIndex,
        selectedCount:
          nextImages.length,
        edited: true,
        imageEdited: true,
      });

      setMessage(
        "Curated image changes saved.",
      );
      setMessageType("success");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Image changes could not be saved.",
      );
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  async function resetToResearched() {
    if (!original?.metadataEdited) {
      return;
    }

    if (
      !window.confirm(
        `Reset "${original.title}" to the researched metadata? This will remove all curated edits for this production.`,
      )
    ) {
      return;
    }

    setSaving(true);
    clearMessage();

    try {
      const response =
        await fetch(
          `/api/admin/curated-archive-import/edit?production=${encodeURIComponent(
            original.production,
          )}`,
          {
            method: "DELETE",
          },
        );

      const result =
        (await response.json()) as {
          ok?: boolean;
          message?: string;
        };

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ||
            "Curated override could not be reset.",
        );
      }

      const reloadResponse =
        await fetch(
          `/api/admin/curated-archive-import/edit?production=${encodeURIComponent(
            original.production,
          )}`,
          {
            cache: "no-store",
          },
        );

      const reloadResult =
        (await reloadResponse.json()) as
          LoadResult;

      if (
        !reloadResponse.ok ||
        !reloadResult.ok ||
        !reloadResult.production
      ) {
        throw new Error(
          reloadResult.message ||
            "Override reset, but researched metadata could not be reloaded.",
        );
      }

      const production =
        reloadResult.production;

      setOriginal(production);
      setTitle(production.title);
      setVenue(production.venue);
      setMonth(
        production.month
          ? String(production.month)
          : "",
      );
      setYear(
        production.year
          ? String(production.year)
          : "",
      );
      setDescription(
        production.description,
      );
      setCredits(
        production.credits,
      );

      setMessage(
        "Curated edits removed. Researched metadata restored.",
      );
      setMessageType("success");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Curated override could not be reset.",
      );
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  async function saveChanges() {
    if (
      !original ||
      !hasChanges
    ) {
      return;
    }

    if (!title.trim()) {
      setMessage(
        "A production title is required.",
      );
      setMessageType("error");
      return;
    }

    if (!venue.trim()) {
      setMessage(
        "A venue is required.",
      );
      setMessageType("error");
      return;
    }

    if (
      !Number.isInteger(
        parsedMonth,
      ) ||
      parsedMonth < 1 ||
      parsedMonth > 12
    ) {
      setMessage(
        "A valid month is required.",
      );
      setMessageType("error");
      return;
    }

    if (
      !Number.isInteger(
        parsedYear,
      )
    ) {
      setMessage(
        "A valid year is required.",
      );
      setMessageType("error");
      return;
    }

    setSaving(true);
    clearMessage();

    try {
      const response =
        await fetch(
          "/api/admin/curated-archive-import/edit",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              production:
                original.production,
              title: title.trim(),
              venue: venue.trim(),
              month: parsedMonth,
              year: parsedYear,
              description:
                description.trim(),
              credits,
            }),
          },
        );

      const result =
        (await response.json()) as {
          ok?: boolean;
          message?: string;
        };

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ||
            "Curated changes could not be saved.",
        );
      }

      const nextOriginal = {
        ...original,
        title: title.trim(),
        venue: venue.trim(),
        month: parsedMonth,
        year: parsedYear,
        description:
          description.trim(),
        credits,
        edited: true,
      };

      setOriginal(
        nextOriginal,
      );

      setMessage(
        "Curated production changes saved.",
      );
      setMessageType("success");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Curated changes could not be saved.",
      );
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding:
            "5rem clamp(1.5rem, 5vw, 5rem)",
          color: "#f2eee6",
        }}
      >
        <p>
          Loading curated production…
        </p>
      </main>
    );
  }

  if (!original) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding:
            "5rem clamp(1.5rem, 5vw, 5rem)",
          color: "#f2eee6",
        }}
      >
        <p>
          {message ||
            "Curated production not found."}
        </p>

        <button
          type="button"
          className="backstage-button"
          onClick={() =>
            router.push(
              "/admin/curated-archive-import",
            )
          }
          style={{
            marginTop: "1.5rem",
          }}
        >
          Back to curated import
        </button>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding:
          "5rem clamp(1.5rem, 5vw, 5rem) 7rem",
        color: "#f2eee6",
      }}
    >
      <header
        style={{
          maxWidth: "90rem",
          margin: "0 auto",
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (
              hasChanges &&
              !window.confirm(
                "Discard your unsaved changes?",
              )
            ) {
              return;
            }

            router.push(
              "/admin/curated-archive-import",
            );
          }}
          style={{
            padding: 0,
            border: 0,
            background:
              "transparent",
            color: "#c7a369",
            cursor: "pointer",
            fontSize: "0.55rem",
            fontWeight: 700,
            letterSpacing:
              "0.16em",
            textTransform:
              "uppercase",
          }}
        >
          ← Curated import
        </button>

        <p
          style={{
            margin: "2rem 0 0",
            color: "#c7a369",
            fontSize: "0.55rem",
            fontWeight: 700,
            letterSpacing:
              "0.18em",
            textTransform:
              "uppercase",
          }}
        >
          Curated production editor
        </p>

        <h1
          style={{
            margin:
              "0.75rem 0 0",
            fontFamily:
              '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
            fontSize:
              "clamp(3rem, 7vw, 7rem)",
            fontWeight: 400,
            lineHeight: 0.95,
          }}
        >
          {original.title}
        </h1>

        <p
          style={{
            margin: "1rem 0 0",
            color:
              "rgba(242, 238, 230, 0.58)",
            fontSize: "0.75rem",
            letterSpacing:
              "0.08em",
            textTransform:
              "uppercase",
          }}
        >
          {original.venue}
          {" · "}
          {original.month
            ? MONTHS[
                original.month - 1
              ]
            : ""}
          {" "}
          {original.year ?? ""}
        </p>

        <p
          style={{
            maxWidth: "48rem",
            margin: "1.5rem 0 0",
            color:
              "rgba(242, 238, 230, 0.5)",
            lineHeight: 1.7,
          }}
        >
          Final amendments made here
          affect Curated Archive Import
          only. Research files and curated
          source files remain unchanged.
          Nothing is published from this
          page.
        </p>

        <p
          style={{
            margin: "1rem 0 0",
            color:
              "rgba(242, 238, 230, 0.42)",
            fontSize: "0.68rem",
          }}
        >
          {original.selectedCount} selected
          {" "}
          image
          {original.selectedCount === 1
            ? ""
            : "s"}
          {original.heroIndex
            ? ` · Hero #${String(
                original.heroIndex,
              ).padStart(4, "0")}`
            : ""}
          {original.edited
            ? " · Previously edited"
            : ""}
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
              "repeat(auto-fit, minmax(15rem, 1fr))",
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
              onChange={(event) => {
                setTitle(
                  event.target.value,
                );
                clearMessage();
              }}
            />
          </label>

          <label className="backstage-field">
            <span className="backstage-field-label">
              Venue
            </span>

            <input
              className="backstage-input"
              value={venue}
              onChange={(event) => {
                setVenue(
                  event.target.value,
                );
                clearMessage();
              }}
            />
          </label>

          <label className="backstage-field">
            <span className="backstage-field-label">
              Month
            </span>

            <select
              className="backstage-input"
              value={month}
              onChange={(event) => {
                setMonth(
                  event.target.value,
                );
                clearMessage();
              }}
            >
              <option value="">
                Select month
              </option>

              {MONTHS.map(
                (
                  monthName,
                  index,
                ) => (
                  <option
                    key={
                      monthName
                    }
                    value={
                      index + 1
                    }
                  >
                    {monthName}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="backstage-field">
            <span className="backstage-field-label">
              Year
            </span>

            <input
              className="backstage-input"
              inputMode="numeric"
              value={year}
              onChange={(event) => {
                setYear(
                  event.target.value,
                );
                clearMessage();
              }}
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
            rows={6}
            value={description}
            onChange={(event) => {
              setDescription(
                event.target.value,
              );
              clearMessage();
            }}
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
          Curated image selection
        </p>

        <h2
          style={{
            margin: "0.7rem 0 0",
            fontFamily:
              '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
            fontSize: "2rem",
            fontWeight: 400,
          }}
        >
          Final photographs
        </h2>

        <p
          style={{
            maxWidth: "48rem",
            margin: "0.8rem 0 0",
            color:
              "rgba(242, 238, 230, 0.5)",
            lineHeight: 1.7,
          }}
        >
          Review the curator&apos;s final
          selection, choose the hero image,
          change the gallery order or remove
          photographs before import. Changes
          remain unsaved until you save them.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(16rem, 1fr))",
            gap: "1rem",
            marginTop: "2rem",
          }}
        >
          {images.map(
            (image, imagePosition) => (
              <article
                key={image.index}
                style={{
                  position: "relative",
                  border: image.hero
                    ? "1px solid rgba(199, 163, 105, 0.8)"
                    : "1px solid rgba(242, 238, 230, 0.12)",
                  background:
                    "rgba(242, 238, 230, 0.025)",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "3 / 2",
                    overflow: "hidden",
                    background: "#090909",
                  }}
                >
                  <img
                    src={`/api/admin/curated-archive-import/image?production=${encodeURIComponent(
                      original.production,
                    )}&file=${encodeURIComponent(
                      image.stagedFile,
                    )}`}
                    alt=""
                    loading="lazy"
                    style={{
                      display: "block",
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />

                  {image.hero ? (
                    <span
                      style={{
                        position: "absolute",
                        top: "0.65rem",
                        left: "0.65rem",
                        padding:
                          "0.4rem 0.55rem",
                        background:
                          "rgba(8, 8, 8, 0.88)",
                        border:
                          "1px solid rgba(199, 163, 105, 0.75)",
                        color: "#c7a369",
                        fontSize: "0.5rem",
                        fontWeight: 700,
                        letterSpacing:
                          "0.14em",
                        textTransform:
                          "uppercase",
                      }}
                    >
                      Hero
                    </span>
                  ) : null}
                </div>

                <div
                  style={{
                    padding:
                      "0.8rem 0.9rem 0.9rem",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: "#c7a369",
                      fontSize: "0.52rem",
                      fontWeight: 700,
                      letterSpacing:
                        "0.13em",
                      textTransform:
                        "uppercase",
                    }}
                  >
                    {image.sequence
                      ? `Gallery ${String(
                          image.sequence,
                        ).padStart(2, "0")}`
                      : "Gallery"}
                    {" · "}
                    #{String(
                      image.index,
                    ).padStart(4, "0")}
                  </p>

                  <p
                    title={
                      image.sourceName
                    }
                    style={{
                      margin:
                        "0.45rem 0 0",
                      overflow: "hidden",
                      color:
                        "rgba(242, 238, 230, 0.46)",
                      fontSize:
                        "0.62rem",
                      textOverflow:
                        "ellipsis",
                      whiteSpace:
                        "nowrap",
                    }}
                  >
                    {image.sourceName}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: "0.45rem",
                      flexWrap: "wrap",
                      marginTop: "0.9rem",
                    }}
                  >
                    <button
                      type="button"
                      className="backstage-button"
                      disabled={
                        image.index ===
                        heroIndex
                      }
                      onClick={() =>
                        makeHero(
                          image.index,
                        )
                      }
                      style={{
                        fontSize: "0.5rem",
                      }}
                    >
                      {image.index ===
                      heroIndex
                        ? "Hero"
                        : "Make hero"}
                    </button>

                    <button
                      type="button"
                      className="backstage-button"
                      disabled={
                        imagePosition === 0
                      }
                      onClick={() =>
                        moveImage(
                          image.index,
                          -1,
                        )
                      }
                      aria-label="Move image earlier"
                      title="Move earlier"
                      style={{
                        fontSize: "0.5rem",
                      }}
                    >
                      ← Earlier
                    </button>

                    <button
                      type="button"
                      className="backstage-button"
                      disabled={
                        imagePosition ===
                        images.length - 1
                      }
                      onClick={() =>
                        moveImage(
                          image.index,
                          1,
                        )
                      }
                      aria-label="Move image later"
                      title="Move later"
                      style={{
                        fontSize: "0.5rem",
                      }}
                    >
                      Later →
                    </button>

                    <button
                      type="button"
                      className="backstage-button"
                      disabled={
                        image.index ===
                        heroIndex
                      }
                      onClick={() =>
                        removeImage(
                          image.index,
                        )
                      }
                      title={
                        image.index ===
                        heroIndex
                          ? "Choose another hero before removing this image."
                          : "Remove from imported gallery"
                      }
                      style={{
                        fontSize: "0.5rem",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ),
          )}
        </div>
      </section>

      <CreditsEditor
        credits={credits}
        onChange={(nextCredits) => {
          setCredits(nextCredits);
          clearMessage();
        }}
      />

      {message ? (
        <div
          style={{
            maxWidth: "90rem",
            margin: "3rem auto 0",
            padding: "1rem 1.25rem",
            border:
              messageType === "error"
                ? "1px solid rgba(220, 100, 100, 0.35)"
                : "1px solid rgba(199, 163, 105, 0.45)",
            color:
              messageType === "error"
                ? "#f0b2aa"
                : "#c7a369",
          }}
        >
          {message}
        </div>
      ) : null}

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
          backdropFilter:
            "blur(14px)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <p
            style={{
              margin: 0,
              color: hasChanges
                ? "#c7a369"
                : "rgba(242, 238, 230, 0.42)",
              fontSize: "0.58rem",
              fontWeight:
                hasChanges
                  ? 700
                  : 400,
              letterSpacing:
                "0.12em",
              textTransform:
                "uppercase",
            }}
          >
            {hasChanges &&
            hasImageChanges
              ? "Unsaved metadata + image changes"
              : hasChanges
                ? "Unsaved metadata changes"
                : hasImageChanges
                  ? "Unsaved image changes"
                  : "No unsaved changes"}
          </p>

          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            {original.imageEdited &&
            !hasImageChanges ? (
              <button
                type="button"
                className="backstage-button"
                disabled={saving}
                onClick={() =>
                  void resetImageSelection()
                }
              >
                Reset image selection to curator
              </button>
            ) : null}

            {hasImageChanges ? (
              <>
                <button
                  type="button"
                  className="backstage-button"
                  disabled={saving}
                  onClick={
                    discardImageChanges
                  }
                >
                  Discard image changes
                </button>

                <button
                  type="button"
                  className="backstage-button"
                  disabled={
                    saving ||
                    !hasImageChanges
                  }
                  onClick={() =>
                    void saveImageChanges()
                  }
                >
                  {saving
                    ? "Saving…"
                    : "Save image changes"}
                </button>
              </>
            ) : null}

            {original.metadataEdited ? (
              <button
                type="button"
                className="backstage-button"
                disabled={saving}
                onClick={() =>
                  void resetToResearched()
                }
              >
                Reset to researched metadata
              </button>
            ) : null}

            <button
              type="button"
              className="backstage-button"
              disabled={saving}
              onClick={() => {
                if (
                  hasChanges &&
                  !window.confirm(
                    "Discard your unsaved changes?",
                  )
                ) {
                  return;
                }

                router.push(
                  "/admin/curated-archive-import",
                );
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              className="backstage-button"
              disabled={
                saving ||
                !hasChanges
              }
              onClick={() =>
                void saveChanges()
              }
            >
              {saving
                ? "Saving…"
                : "Save curated changes"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
