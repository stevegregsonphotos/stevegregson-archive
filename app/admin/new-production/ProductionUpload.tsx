"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import PasteCreditsPanel from "../../../components/admin/editor/PasteCreditsPanel";
import {
  normalisePastedRole,
  type PastedCredit,
} from "../../../lib/parse-pasted-credits";
import type {
  UpcomingDraft,
  UpcomingSummary,
} from "../../../lib/upcoming-productions";

import ci from "../curated-archive-import/curated-import.module.css";
import pe from "../edit-production/[slug]/production-edit.module.css";
import sw from "../selected-work/backstage-selected-work.module.css";
import np from "./new-production.module.css";

type LocalImage = {
  id: string;
  file: File;
  filepath: string;
  previewUrl: string;
  included: boolean;
};

type PublishedAsset = {
  sourceFilepath: string;
  filename: string;
  blurDataURL: string;
};

const MONTHS = [
  "",
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

const IMAGE_EXTENSIONS =
  /\.(jpe?g|png|webp)$/i;

const DETAIL_LABELS: Record<
  string,
  | "title"
  | "venue"
  | "year"
  | "director"
  | "writer"
  | "cast"
  | "associateDirector"
  | "musicalDirector"
  | "choreographer"
  | "movementDirector"
  | "lightingDesign"
  | "setDesign"
  | "costumeDesign"
  | "setCostumeDesign"
  | "soundDesign"
  | "commissionedBy"
  | "description"
> = {
  production: "title",
  title: "title",
  venue: "venue",
  theatre: "venue",
  year: "year",
  director: "director",
  writer: "writer",
  cast: "cast",
  "associate director":
    "associateDirector",
  "musical director":
    "musicalDirector",
  choreographer:
    "choreographer",
  "movement director":
    "movementDirector",
  "lighting design":
    "lightingDesign",
  "lighting designer":
    "lightingDesign",
  "set design":
    "setDesign",
  "set designer":
    "setDesign",
  "costume design":
    "costumeDesign",
  "costume designer":
    "costumeDesign",
  "set & costume design":
    "setCostumeDesign",
  "set and costume design":
    "setCostumeDesign",
  "set & costume designer":
    "setCostumeDesign",
  "set and costume designer":
    "setCostumeDesign",
  "sound design":
    "soundDesign",
  "sound designer":
    "soundDesign",
  "commissioned by":
    "commissionedBy",
  description:
    "description",
};

function normaliseDetailLabel(
  value: string,
) {
  return value
    .trim()
    .replace(/:$/, "")
    .replace(/\.$/, "")
    .trim()
    .toLowerCase();
}

function normaliseAllCapsDisplayValue(
  value: string,
) {
  const trimmed = value.trim();

  const letters =
    trimmed.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) ?? [];

  if (
    letters.length === 0 ||
    letters.some(
      (letter) =>
        letter !== letter.toUpperCase(),
    )
  ) {
    return trimmed;
  }

  const acronymLike =
    /^[A-Z0-9&.+/-]{2,6}$/.test(
      trimmed,
    );

  if (acronymLike) {
    return trimmed;
  }

  return trimmed
    .toLowerCase()
    .replace(
      /(^|[\s\-–—/('])([a-zà-öø-ÿ])/g,
      (_match, prefix: string, letter: string) =>
        `${prefix}${letter.toUpperCase()}`,
    )
    .replace(
      /\b([A-Z])\.\s*([A-Z])\./g,
      "$1.$2.",
    );
}

function cleanDetailValue(
  value: string,
) {
  const cleaned =
    value
      .trim()
      .replace(/\s+\.$/, ".")
      .replace(/\.$/, "")
      .trim();

  if (
    !cleaned ||
    /^not\s+found$/i.test(
      cleaned,
    )
  ) {
    return "";
  }

  return normaliseAllCapsDisplayValue(
    cleaned,
  );
}

function decodeWindows1252Byte(
  hex: string,
) {
  return new TextDecoder(
    "windows-1252",
  ).decode(
    Uint8Array.of(
      Number.parseInt(
        hex,
        16,
      ),
    ),
  );
}

function rtfToPlainText(
  rtf: string,
) {
  let result = rtf;

  result =
    result.replace(
      /\{\\(?:fonttbl|colortbl|expandedcolortbl|stylesheet|info)[\s\S]*?\}(?=\s*\{|\s*\\|\s*$)/gi,
      "",
    );

  result =
    result.replace(
      /\\'([0-9a-f]{2})/gi,
      (
        _match,
        hex: string,
      ) =>
        decodeWindows1252Byte(
          hex,
        ),
    );

  result =
    result.replace(
      /\\u(-?\d+)\??/g,
      (
        _match,
        value: string,
      ) => {
        const number =
          Number.parseInt(
            value,
            10,
          );

        const codePoint =
          number < 0
            ? number +
              65536
            : number;

        return String.fromCharCode(
          codePoint,
        );
      },
    );

  result =
    result
      .replace(
        /\\par(?=[\\\s{}]|$)/gi,
        "\n",
      )
      .replace(
        /\\line(?=[\\\s{}]|$)/gi,
        "\n",
      )
      .replace(
        /\\tab(?=[\\\s{}]|$)/gi,
        "\t",
      )
      .replace(
        /\\\{/g,
        "{",
      )
      .replace(
        /\\\}/g,
        "}",
      )
      .replace(
        /\\\\/g,
        "\\",
      );

  result =
    result.replace(
      /\\\r?\n/g,
      "\n",
    );

  result =
    result
      .replace(
        /\\[a-z]+-?\d*\s?/gi,
        "",
      )
      .replace(
        /[{}]/g,
        "",
      );

  const lines =
    result
      .split(/\r?\n/)
      .map(
        (line) =>
          line
            .replace(
              /\s+/g,
              " ",
            )
            .trim(),
      )
      .filter(Boolean);

  const firstLabelIndex =
    lines.findIndex(
      (line) =>
        Boolean(
          DETAIL_LABELS[
            normaliseDetailLabel(
              line,
            )
          ],
        ),
    );

  return (
    firstLabelIndex >= 0
      ? lines.slice(
          firstLabelIndex,
        )
      : lines
  ).join("\n");
}

function parseDetails(
  plainText: string,
) {
  const fields = {
    title: "",
    venue: "",
    year: "",
    director: "",
    writer: "",
    cast: "",
    associateDirector: "",
    musicalDirector: "",
    choreographer: "",
    movementDirector: "",
    lightingDesign: "",
    setDesign: "",
    costumeDesign: "",
    setCostumeDesign: "",
    soundDesign: "",
    commissionedBy: "",
    description: "",
  };

  let activeField:
    | keyof typeof fields
    | null = null;

  const lines =
    plainText
      .split(/\r?\n/)
      .map(
        (line) =>
          line.trim(),
      )
      .filter(Boolean);

  for (
    const line of lines
  ) {
    const inlineMatch =
      line.match(
        /^([^:]{2,60}):\s*(.+)$/,
      );

    if (inlineMatch) {
      const [
        ,
        rawLabel,
        rawValue,
      ] =
        inlineMatch;

      const field =
        DETAIL_LABELS[
          normaliseDetailLabel(
            rawLabel,
          )
        ];

      if (field) {
        const value =
          cleanDetailValue(
            rawValue,
          );

        if (
          field ===
            "description" &&
          fields.description
        ) {
          fields.description =
            `${fields.description} ${value}`;
        } else if (
          !fields[field]
        ) {
          fields[field] =
            value;
        }

        activeField =
          null;
        continue;
      }
    }

    const field =
      DETAIL_LABELS[
        normaliseDetailLabel(
          line,
        )
      ];

    if (field) {
      activeField =
        field;
      continue;
    }

    if (!activeField) {
      continue;
    }

    const value =
      cleanDetailValue(
        line,
      );

    if (!value) {
      continue;
    }

    if (
      activeField ===
        "description" &&
      fields.description
    ) {
      fields.description =
        `${fields.description} ${value}`;
    } else if (
      !fields[
        activeField
      ]
    ) {
      fields[
        activeField
      ] = value;
    }

    if (
      activeField !==
      "description"
    ) {
      activeField =
        null;
    }
  }

  return fields;
}

function slugify(
  value: string,
) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[’']/g, "")
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    );
}

function webStem(
  value: string,
) {
  const filename =
    value
      .split("/")
      .at(-1) ??
    value;

  const withoutExtension =
    filename.replace(
      /\.[^.]+$/,
      "",
    );

  return (
    slugify(
      withoutExtension,
    ) || "photograph"
  );
}

async function prepareImage(
  source: LocalImage,
  outputFilename: string,
): Promise<{
  blob: Blob;
  asset: PublishedAsset;
}> {
  const objectUrl =
    URL.createObjectURL(
      source.file,
    );

  try {
    const image =
      new Image();

    await new Promise<void>(
      (
        resolve,
        reject,
      ) => {
        image.onload = () =>
          resolve();

        image.onerror = () =>
          reject(
            new Error(
              `Could not read ${source.file.name}.`,
            ),
          );

        image.src =
          objectUrl;
      },
    );

    const scale =
      Math.min(
        1,
        2560 /
          Math.max(
            image.naturalWidth,
            image.naturalHeight,
          ),
      );

    const width =
      Math.max(
        1,
        Math.round(
          image.naturalWidth *
            scale,
        ),
      );

    const height =
      Math.max(
        1,
        Math.round(
          image.naturalHeight *
            scale,
        ),
      );

    const canvas =
      document.createElement(
        "canvas",
      );

    canvas.width =
      width;
    canvas.height =
      height;

    const context =
      canvas.getContext(
        "2d",
      );

    if (!context) {
      throw new Error(
        `Could not prepare ${source.file.name}.`,
      );
    }

    context.drawImage(
      image,
      0,
      0,
      width,
      height,
    );

    const blob =
      await new Promise<Blob>(
        (
          resolve,
          reject,
        ) => {
          canvas.toBlob(
            (result) => {
              if (
                result
              ) {
                resolve(
                  result,
                );
              } else {
                reject(
                  new Error(
                    `Could not create ${outputFilename}.`,
                  ),
                );
              }
            },
            "image/webp",
            0.82,
          );
        },
      );

    const blurCanvas =
      document.createElement(
        "canvas",
      );

    const blurWidth =
      24;

    blurCanvas.width =
      blurWidth;

    blurCanvas.height =
      Math.max(
        1,
        Math.round(
          height *
            (
              blurWidth /
              width
            ),
        ),
      );

    const blurContext =
      blurCanvas.getContext(
        "2d",
      );

    if (!blurContext) {
      throw new Error(
        `Could not create blur placeholder for ${source.file.name}.`,
      );
    }

    blurContext.drawImage(
      canvas,
      0,
      0,
      blurCanvas.width,
      blurCanvas.height,
    );

    return {
      blob,
      asset: {
        sourceFilepath:
          source.filepath,
        filename:
          outputFilename,
        blurDataURL:
          blurCanvas.toDataURL(
            "image/webp",
            0.38,
          ),
      },
    };
  } finally {
    URL.revokeObjectURL(
      objectUrl,
    );
  }
}


async function createProductionCardBlob(
  source: Blob,
) {
  const objectUrl =
    URL.createObjectURL(
      source,
    );

  try {
    const image =
      new Image();

    await new Promise<void>(
      (
        resolve,
        reject,
      ) => {
        image.onload =
          () =>
            resolve();

        image.onerror =
          () =>
            reject(
              new Error(
                "The production card image could not be decoded.",
              ),
            );

        image.src =
          objectUrl;
      },
    );

    const maximumWidth =
      1000;

    const scale =
      Math.min(
        1,
        maximumWidth /
          image.naturalWidth,
      );

    const width =
      Math.max(
        1,
        Math.round(
          image.naturalWidth *
            scale,
        ),
      );

    const height =
      Math.max(
        1,
        Math.round(
          image.naturalHeight *
            scale,
        ),
      );

    const canvas =
      document.createElement(
        "canvas",
      );

    canvas.width =
      width;
    canvas.height =
      height;

    const context =
      canvas.getContext(
        "2d",
      );

    if (!context) {
      throw new Error(
        "The production card canvas could not be created.",
      );
    }

    context.drawImage(
      image,
      0,
      0,
      width,
      height,
    );

    return await new Promise<Blob>(
      (
        resolve,
        reject,
      ) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(
                blob,
              );
            } else {
              reject(
                new Error(
                  "The production card WebP could not be created.",
                ),
              );
            }
          },
          "image/webp",
          0.75,
        );
      },
    );
  } finally {
    URL.revokeObjectURL(
      objectUrl,
    );
  }
}

export default function ProductionUpload() {
  const [
    images,
    setImages,
  ] =
    useState<
      LocalImage[]
    >([]);

  const [
    heroId,
    setHeroId,
  ] =
    useState("");

  const [
    title,
    setTitle,
  ] =
    useState("");

  const [
    venue,
    setVenue,
  ] =
    useState("");

  const [
    month,
    setMonth,
  ] =
    useState("");

  const [
    year,
    setYear,
  ] =
    useState("");

  const [
    description,
    setDescription,
  ] =
    useState("");

  const [
    commissionedBy,
    setCommissionedBy,
  ] =
    useState("");

  const [
    director,
    setDirector,
  ] =
    useState("");

  const [
    writer,
    setWriter,
  ] =
    useState("");

  const [
    cast,
    setCast,
  ] =
    useState("");

  const [
    associateDirector,
    setAssociateDirector,
  ] =
    useState("");

  const [
    musicalDirector,
    setMusicalDirector,
  ] =
    useState("");

  const [
    choreographer,
    setChoreographer,
  ] =
    useState("");

  const [
    movementDirector,
    setMovementDirector,
  ] =
    useState("");

  const [
    lightingDesign,
    setLightingDesign,
  ] =
    useState("");

  const [
    setDesign,
    setSetDesign,
  ] =
    useState("");

  const [
    costumeDesign,
    setCostumeDesign,
  ] =
    useState("");

  const [
    setAndCostumeDesign,
    setSetAndCostumeDesign,
  ] =
    useState("");

  const [
    soundDesign,
    setSoundDesign,
  ] =
    useState("");

  /** Pasted credits that have no box of their own (Producer, Composer…). */
  const [
    extraCredits,
    setExtraCredits,
  ] =
    useState<PastedCredit[]>([]);

  const [
    progress,
    setProgress,
  ] =
    useState("");

  const [
    detailsFileName,
    setDetailsFileName,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    publishedUrl,
    setPublishedUrl,
  ] =
    useState("");

  const [
    publishSucceeded,
    setPublishSucceeded,
  ] =
    useState(false);

  const [
    isPublishing,
    setIsPublishing,
  ] =
    useState(false);

  /* Productions › Upcoming: start from a private draft (?upcoming=<id>). */
  const [
    upcomingDraft,
    setUpcomingDraft,
  ] = useState<UpcomingDraft | null>(null);
  const [
    upcomingOptions,
    setUpcomingOptions,
  ] = useState<UpcomingSummary[]>([]);
  const [
    upcomingMessage,
    setUpcomingMessage,
  ] = useState("");
  const [
    upcomingAfterPublish,
    setUpcomingAfterPublish,
  ] = useState("");

  const pasteCreditFields: Record<
    string,
    [string, (update: (current: string) => string) => void]
  > = {
    Director: [director, setDirector],
    Writer: [writer, setWriter],
    Cast: [cast, setCast],
    "Associate Director": [associateDirector, setAssociateDirector],
    "Musical Director": [musicalDirector, setMusicalDirector],
    Choreographer: [choreographer, setChoreographer],
    "Movement Director": [movementDirector, setMovementDirector],
    "Lighting Design": [lightingDesign, setLightingDesign],
    "Set Design": [setDesign, setSetDesign],
    "Costume Design": [costumeDesign, setCostumeDesign],
    "Set & Costume Design": [setAndCostumeDesign, setSetAndCostumeDesign],
    "Sound Design": [soundDesign, setSoundDesign],
    "Commissioned by": [commissionedBy, setCommissionedBy],
  };

  function splitFieldNames(
    value: string,
  ) {
    return value
      .split(
        /\s*(?:,|;|&|\band\b)\s*/i,
      )
      .map((name) =>
        name.trim(),
      )
      .filter(Boolean);
  }

  const creditsForPaste = [
    ...Object.entries(
      pasteCreditFields,
    ).flatMap(
      ([role, [value]]) =>
        splitFieldNames(
          value,
        ).map((name) => ({
          role,
          name,
        })),
    ),
    ...extraCredits,
  ];

  function addPastedCredits(
    pasted: PastedCredit[],
  ) {
    const extras: PastedCredit[] = [];

    for (const credit of pasted) {
      const field =
        pasteCreditFields[
          credit.role
        ];

      if (!field) {
        extras.push(credit);
        continue;
      }

      const [, setField] =
        field;

      setField((current) => {
        const existing =
          splitFieldNames(
            current,
          ).map((name) =>
            name.toLowerCase(),
          );

        if (
          existing.includes(
            credit.name.toLowerCase(),
          )
        ) {
          return current;
        }

        return current.trim()
          ? `${current.trim()}, ${credit.name}`
          : credit.name;
      });
    }

    if (extras.length) {
      setExtraCredits(
        (current) => [
          ...current,
          ...extras,
        ],
      );
    }
  }

  /** Fills the form from an upcoming draft, the same way details.txt does. */
  function applyUpcomingDraft(
    draft: UpcomingDraft,
  ) {
    const fieldNames: Record<string, string[]> = {};
    const fieldKeys = Object.keys(pasteCreditFields);
    const extras: PastedCredit[] = [];

    for (const credit of draft.credits) {
      const role = credit.role.trim();
      const name = credit.name.trim();
      if (!role || !name) continue;
      const normalised = normalisePastedRole(role);
      const key =
        fieldKeys.find((fieldKey) => fieldKey === role) ??
        fieldKeys.find((fieldKey) => fieldKey.toLowerCase() === role.toLowerCase()) ??
        fieldKeys.find((fieldKey) => fieldKey.toLowerCase() === normalised.toLowerCase());
      if (key) {
        fieldNames[key] = [...(fieldNames[key] ?? []), name];
      } else {
        extras.push({ role, name });
      }
    }

    for (const key of fieldKeys) {
      const [, setField] = pasteCreditFields[key];
      setField(() => (fieldNames[key] ?? []).join(", "));
    }
    setExtraCredits(extras);
    setTitle(draft.title);
    setVenue(draft.venue);
    setMonth(draft.month);
    setYear(draft.year);
    setDescription(draft.description);
    setUpcomingDraft(draft);
    setUpcomingMessage(
      `Details and credits filled in from your upcoming production “${draft.title.trim() || "Untitled"}”. Now choose the photo folder.`,
    );
  }

  async function loadUpcomingDraft(
    id: string,
  ) {
    try {
      const response = await fetch(
        `/api/admin/upcoming-productions?id=${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        draft?: UpcomingDraft;
      };
      if (!response.ok || !result.ok || !result.draft) {
        throw new Error(result.message || "That upcoming production could not be loaded.");
      }
      applyUpcomingDraft(result.draft);
    } catch (loadError) {
      setUpcomingMessage(
        loadError instanceof Error
          ? loadError.message
          : "That upcoming production could not be loaded.",
      );
    }
  }

  function clearUpcomingDraft() {
    setUpcomingDraft(null);
    setUpcomingMessage(
      images.length
        ? "No longer starting from an upcoming production. Choose the folder again to read its details file, or fill in the details below."
        : "",
    );
  }

  useEffect(() => {
    let cancelled = false;
    const id = new URLSearchParams(window.location.search).get("upcoming");

    async function loadOptions() {
      try {
        const response = await fetch("/api/admin/upcoming-productions", { cache: "no-store" });
        const result = (await response.json()) as { ok?: boolean; drafts?: UpcomingSummary[] };
        if (!cancelled && response.ok && result.ok && result.drafts) {
          setUpcomingOptions(result.drafts.filter((draft) => draft.status === "draft"));
        }
      } catch {
        // The "Start from an upcoming production" list is optional.
      }
    }

    async function loadStartingDraft(draftId: string) {
      try {
        const response = await fetch(
          `/api/admin/upcoming-productions?id=${encodeURIComponent(draftId)}`,
          { cache: "no-store" },
        );
        const result = (await response.json()) as { ok?: boolean; message?: string; draft?: UpcomingDraft };
        if (cancelled) return;
        if (!response.ok || !result.ok || !result.draft) {
          setUpcomingMessage(result.message || "That upcoming production could not be loaded.");
          return;
        }
        applyUpcomingDraft(result.draft);
      } catch {
        if (!cancelled) setUpcomingMessage("That upcoming production could not be loaded.");
      }
    }

    void loadOptions();
    if (id) void loadStartingDraft(id);

    return () => {
      cancelled = true;
    };
    // Runs once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const includedImages =
    useMemo(
      () =>
        images.filter(
          (image) =>
            image.included,
        ),
      [images],
    );

  const hero =
    images.find(
      (image) =>
        image.id ===
        heroId,
    ) ?? null;

  async function chooseFolder(
    files:
      FileList | null,
  ) {
    if (!files) {
      return;
    }

    for (
      const old of
      images
    ) {
      URL.revokeObjectURL(
        old.previewUrl,
      );
    }

    const selectedFiles =
      Array.from(
        files,
      );

    const next =
      selectedFiles
        .filter(
          (file) =>
            IMAGE_EXTENSIONS.test(
              file.name,
            ),
        )
        .map(
          (
            file,
            index,
          ) => ({
            id:
              `${index}:${file.webkitRelativePath || file.name}`,
            file,
            filepath:
              file.webkitRelativePath ||
              file.name,
            previewUrl:
              URL.createObjectURL(
                file,
              ),
            included:
              true,
          }),
        );

    setImages(
      next,
    );

    setHeroId(
      next[0]?.id ??
        "",
    );

    setError("");
    setPublishedUrl("");
    setPublishSucceeded(false);
    setDetailsFileName("");

    // Starting from an upcoming draft: keep its details and credits.
    if (!upcomingDraft) {
      setExtraCredits([]);
    }

    const detailsFile =
      selectedFiles.find(
        (file) =>
          /(^|\/)details?\.txt$/i.test(
            file.webkitRelativePath ||
              file.name,
          ),
      ) ??
      selectedFiles.find(
        (file) =>
          /(^|\/)details?\.rtf$/i.test(
            file.webkitRelativePath ||
              file.name,
          ),
      ) ??
      selectedFiles.find(
        (file) =>
          /\.txt$/i.test(
            file.name,
          ),
      ) ??
      selectedFiles.find(
        (file) =>
          /\.rtf$/i.test(
            file.name,
          ),
      ) ??
      null;

    if (detailsFile && upcomingDraft) {
      setProgress(
        `Found ${next.length.toLocaleString()} photograph${
          next.length === 1
            ? ""
            : "s"
        }. Kept the details from your upcoming production — ${detailsFile.name} in the folder was not used.`,
      );
    } else if (detailsFile) {
      try {
        const rawText =
          await detailsFile.text();

        const plainText =
          /\.rtf$/i.test(
            detailsFile.name,
          )
            ? rtfToPlainText(
                rawText,
              )
            : rawText
                .split(
                  /\r?\n/,
                )
                .map(
                  (line) =>
                    line.trim(),
                )
                .filter(
                  Boolean,
                )
                .join(
                  "\n",
                );

        const fields =
          parseDetails(
            plainText,
          );

        setTitle(
          fields.title,
        );
        setVenue(
          fields.venue,
        );
        setYear(
          fields.year,
        );
        setDirector(
          fields.director,
        );
        setWriter(
          fields.writer,
        );
        setCast(
          fields.cast,
        );
        setAssociateDirector(
          fields.associateDirector,
        );
        setMusicalDirector(
          fields.musicalDirector,
        );
        setChoreographer(
          fields.choreographer,
        );
        setMovementDirector(
          fields.movementDirector,
        );
        setLightingDesign(
          fields.lightingDesign,
        );
        setSetDesign(
          fields.setDesign,
        );
        setCostumeDesign(
          fields.costumeDesign,
        );
        setSetAndCostumeDesign(
          fields.setCostumeDesign,
        );
        setSoundDesign(
          fields.soundDesign,
        );
        setCommissionedBy(
          fields.commissionedBy,
        );
        setDescription(
          fields.description,
        );

        setDetailsFileName(
          detailsFile.name,
        );

        setProgress(
          `Found ${next.length.toLocaleString()} photograph${
            next.length === 1
              ? ""
              : "s"
          }. Read production details from ${detailsFile.name}.`,
        );
      } catch (detailsError) {
        setProgress(
          `Found ${next.length.toLocaleString()} photograph${
            next.length === 1
              ? ""
              : "s"
          }.`,
        );

        setError(
          detailsError instanceof Error
            ? `Photographs loaded, but ${detailsFile.name} could not be read: ${detailsError.message}`
            : `Photographs loaded, but ${detailsFile.name} could not be read.`,
        );
      }
    } else {
      setProgress(
        `Found ${next.length.toLocaleString()} photograph${
          next.length === 1
            ? ""
            : "s"
        }. No details.txt or details.rtf file was found.`,
      );
    }
  }

  async function publish() {
    setError("");
    setPublishedUrl("");
    setPublishSucceeded(false);

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

    if (
      !title.trim() ||
      !venue.trim() ||
      !Number.isInteger(
        parsedMonth,
      ) ||
      parsedMonth < 1 ||
      parsedMonth > 12 ||
      !Number.isInteger(
        parsedYear,
      ) ||
      parsedYear < 1800 ||
      parsedYear > 2200 ||
      !description.trim()
    ) {
      setError(
        "Title, venue, month, year and description are required.",
      );
      return;
    }

    if (
      !hero ||
      !hero.included
    ) {
      setError(
        "Choose an included hero image.",
      );
      return;
    }

    const gallery =
      includedImages.filter(
        (image) =>
          image.id !==
          hero.id,
      );

    if (
      gallery.length === 0
    ) {
      setError(
        "Include at least one gallery image in addition to the hero.",
      );
      return;
    }

    const slug =
      slugify(
        [
          title,
          venue,
          MONTHS[
            parsedMonth
          ],
          parsedYear,
        ].join(" "),
      );

    if (!slug) {
      setError(
        "Could not create a production slug.",
      );
      return;
    }

    if (
      !window.confirm(
        `Publish "${title.trim()}" with ${gallery.length + 1} images?`,
      )
    ) {
      return;
    }

    setIsPublishing(
      true,
    );

    try {
      setProgress(
        "Checking production identity…",
      );

      const checkResponse =
        await fetch(
          "/api/admin/new-production-r2",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                {
                  action:
                    "check",
                  slug,
                },
              ),
          },
        );

      const check =
        (await checkResponse.json()) as {
          ok?: boolean;
          exists?: boolean;
          message?: string;
        };

      if (
        !checkResponse.ok ||
        !check.ok
      ) {
        throw new Error(
          check.message ||
            "Production check failed.",
        );
      }

      if (
        check.exists
      ) {
        throw new Error(
          `A production already exists for "${slug}".`,
        );
      }

      const jobs = [
        {
          image:
            hero,
          outputFilename:
            `hero-${webStem(
              hero.file.name,
            )}.webp`,
        },
        ...gallery.map(
          (
            image,
            index,
          ) => ({
            image,
            outputFilename:
              `${String(
                index + 1,
              ).padStart(
                2,
                "0",
              )}-${webStem(
                image.file.name,
              )}.webp`,
          }),
        ),
      ];

      const assets:
        PublishedAsset[] =
        [];

      for (
        let index = 0;
        index <
        jobs.length;
        index += 1
      ) {
        const job =
          jobs[
            index
          ];

        setProgress(
          `Preparing and uploading ${index + 1} of ${jobs.length}: ${job.image.file.name}`,
        );

        const signedResponse =
          await fetch(
            "/api/admin/new-production-r2",
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify(
                  {
                    action:
                      "sign-image",
                    slug,
                    filename:
                      job.outputFilename,
                  },
                ),
            },
          );

        const signed =
          (await signedResponse.json()) as {
            ok?: boolean;
            uploadUrl?: string;
            cardUploadUrl?: string;
            message?: string;
          };

        if (
          !signedResponse.ok ||
          !signed.ok ||
          !signed.uploadUrl
        ) {
          throw new Error(
            signed.message ||
              `Could not prepare ${job.image.file.name} for upload.`,
          );
        }

        const prepared =
          await prepareImage(
            job.image,
            job.outputFilename,
          );

        const uploadResponse =
          await fetch(
            signed.uploadUrl,
            {
              method:
                "PUT",
              headers: {
                "Content-Type":
                  "image/webp",
                "Cache-Control":
                  "public, max-age=31536000, immutable",
              },
              body:
                prepared.blob,
            },
          );

        if (
          !uploadResponse.ok
        ) {
          throw new Error(
            `R2 upload failed for ${job.image.file.name} (HTTP ${uploadResponse.status}).`,
          );
        }

        if (
          signed.cardUploadUrl
        ) {
          const cardBlob =
            await createProductionCardBlob(
              prepared.blob,
            );

          const cardResponse =
            await fetch(
              signed.cardUploadUrl,
              {
                method:
                  "PUT",
                headers: {
                  "Content-Type":
                    "image/webp",
                  "Cache-Control":
                    "public, max-age=31536000, immutable",
                },
                body:
                  cardBlob,
              },
            );

          if (
            !cardResponse.ok
          ) {
            throw new Error(
              `R2 card upload failed for ${job.image.file.name} (HTTP ${cardResponse.status}).`,
            );
          }
        }

        assets.push(
          prepared.asset,
        );
      }

      const genericAlt =
        `${title.trim()} at ${venue.trim()} — production photograph`;

      const castCredits =
        cast
          .split(
            /\s*(?:,|;|\band\b)\s*/i,
          )
          .map(
            (name) =>
              normaliseAllCapsDisplayValue(
                name,
              ),
          )
          .filter(Boolean)
          .map((name) => ({
            role: "Cast",
            name,
          }));

      const credits = [
        ["Director", director],
        ["Writer", writer],
        ["Associate Director", associateDirector],
        ["Musical Director", musicalDirector],
        ["Choreographer", choreographer],
        ["Movement Director", movementDirector],
        ["Lighting Design", lightingDesign],
        ["Set Design", setDesign],
        ["Costume Design", costumeDesign],
        ["Set & Costume Design", setAndCostumeDesign],
        ["Sound Design", soundDesign],
        ["Commissioned by", commissionedBy],
      ].flatMap(
        ([rawRole, rawName]) => {
          const role =
            normaliseAllCapsDisplayValue(
              rawRole,
            );

          const name =
            normaliseAllCapsDisplayValue(
              rawName,
            );

          return name
            ? [
                {
                  role,
                  name,
                },
              ]
            : [];
        },
      );

      credits.push(
        ...extraCredits
          .map((credit) => ({
            role: credit.role.trim(),
            name: credit.name.trim(),
          }))
          .filter(
            (credit) =>
              credit.role &&
              credit.name,
          ),
        ...castCredits,
      );

      const payload = {
        slug,
        title:
          title.trim(),
        venue:
          venue.trim(),
        month:
          parsedMonth,
        year:
          parsedYear,
        description:
          description.trim(),
        hero: {
          filepath:
            hero.filepath,
          filename:
            jobs[0]
              .outputFilename,
          alt:
            genericAlt,
        },
        credits,
        images:
          gallery.map(
            (
              image,
              index,
            ) => ({
              filepath:
                image.filepath,
              filename:
                jobs[
                  index +
                    1
                ]
                  .outputFilename,
              alt:
                genericAlt,
              layout:
                "wide" as const,
            }),
          ),
      };

      setProgress(
        "Verifying R2 and committing production to the archive…",
      );

      const finalizeResponse =
        await fetch(
          "/api/admin/new-production-r2",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                {
                  action:
                    "finalize",
                  payload,
                  heroAsset:
                    assets[0],
                  galleryAssets:
                    assets.slice(
                      1,
                    ),
                },
              ),
          },
        );

      const finalized =
        (await finalizeResponse.json()) as {
          ok?: boolean;
          message?: string;
          production?: {
            url?: string;
          };
        };

      if (
        !finalizeResponse.ok ||
        !finalized.ok
      ) {
        throw new Error(
          finalized.message ||
            "Production could not be finalized.",
        );
      }

      setProgress(
        "Published successfully.",
      );

      setPublishSucceeded(
        true,
      );

      // Only now, after a successful publish, mark the upcoming draft done.
      if (upcomingDraft) {
        try {
          const markResponse = await fetch(
            "/api/admin/upcoming-productions",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "published",
                id: upcomingDraft.id,
                url: finalized.production?.url ?? "",
              }),
            },
          );
          const marked = (await markResponse.json()) as { ok?: boolean };
          setUpcomingAfterPublish(
            markResponse.ok && marked.ok
              ? "It has been moved out of your Upcoming list."
              : "The production is published, but its Upcoming draft couldn’t be updated — you can delete the draft from Productions › Upcoming.",
          );
        } catch {
          setUpcomingAfterPublish(
            "The production is published, but its Upcoming draft couldn’t be updated — you can delete the draft from Productions › Upcoming.",
          );
        }
      }

      setPublishedUrl(
        finalized.production
          ?.url ?? "",
      );
    } catch (
      publishError
    ) {
      setError(
        publishError instanceof
          Error
          ? publishError.message
          : "Production publishing failed.",
      );
    } finally {
      setIsPublishing(
        false,
      );
    }
  }

  const parsedMonthForSteps =
    Number.parseInt(month, 10);
  const parsedYearForSteps =
    Number.parseInt(year, 10);
  const detailsReady =
    Boolean(
      title.trim() &&
        venue.trim() &&
        description.trim(),
    ) &&
    Number.isInteger(parsedMonthForSteps) &&
    parsedMonthForSteps >= 1 &&
    parsedMonthForSteps <= 12 &&
    Number.isInteger(parsedYearForSteps) &&
    parsedYearForSteps >= 1800 &&
    parsedYearForSteps <= 2200;
  const heroIncluded =
    Boolean(hero && hero.included);
  const imagesReady =
    heroIncluded &&
    includedImages.some(
      (image) => image.id !== hero?.id,
    );

  const stepItems: {
    label: string;
    done: boolean;
  }[] = [
    {
      label: "Choose folder",
      done: images.length > 0,
    },
    {
      label: "Production details",
      done: images.length > 0 && detailsReady,
    },
    {
      label: "Images & hero",
      done: images.length > 0 && imagesReady,
    },
    {
      label: "Upload & publish",
      done: publishSucceeded,
    },
  ];
  const currentStepIndex =
    isPublishing
      ? 3
      : stepItems.findIndex(
          (step) => !step.done,
        );

  const creditFields: [
    string,
    string,
    (value: string) => void,
  ][] = [
    ["Director", director, setDirector],
    ["Writer", writer, setWriter],
    ["Cast", cast, setCast],
    ["Associate Director", associateDirector, setAssociateDirector],
    ["Musical Director", musicalDirector, setMusicalDirector],
    ["Choreographer", choreographer, setChoreographer],
    ["Movement Director", movementDirector, setMovementDirector],
    ["Lighting Design", lightingDesign, setLightingDesign],
    ["Set Design", setDesign, setSetDesign],
    ["Costume Design", costumeDesign, setCostumeDesign],
    ["Set & Costume Design", setAndCostumeDesign, setSetAndCostumeDesign],
    ["Sound Design", soundDesign, setSoundDesign],
    ["Commissioned by", commissionedBy, setCommissionedBy],
  ];

  return (
    <div
      className={
        images.length > 0
          ? `${ci.screen} ${ci.screenWithBar}`
          : ci.screen
      }
    >
      <ol
        className={ci.steps}
        aria-label="Progress"
      >
        {stepItems.map(
          (step, index) => {
            const isCurrent =
              index === currentStepIndex;
            const className =
              isCurrent
                ? ci.stepCurrent
                : step.done
                  ? ci.stepDone
                  : undefined;

            return (
              <li
                key={step.label}
                className={className}
                aria-current={
                  isCurrent
                    ? "step"
                    : undefined
                }
              >
                <span className={ci.stepNumber}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                {step.label}
                <span className={ci.stepState}>
                  {isCurrent
                    ? index === 3 && isPublishing
                      ? "Working"
                      : "Now"
                    : step.done
                      ? "Done"
                      : ""}
                </span>
              </li>
            );
          },
        )}
      </ol>

      <section>
        <div className={ci.sectionHead}>
          <div>
            <p className={ci.eyebrow}>
              Step 1
            </p>
            <h2 className={ci.sectionTitle}>
              Production folder
            </h2>
          </div>
          <p className={ci.sectionSub}>
            Choose one production folder. Photographs remain in your browser until the selected images are converted to WebP and uploaded directly to R2.
          </p>
        </div>

        {upcomingOptions.length > 0 || upcomingDraft || upcomingMessage ? (
          <div className={np.upcomingBar} data-testid="upcoming-start">
            {upcomingOptions.length > 0 || upcomingDraft ? (
              <label className={np.upcomingLabel}>
                Start from an upcoming production
                <select
                  className={sw.select}
                  value={upcomingDraft?.id ?? ""}
                  disabled={isPublishing || publishSucceeded}
                  onChange={(event) => {
                    const id = event.target.value;
                    if (id) {
                      void loadUpcomingDraft(id);
                    } else {
                      clearUpcomingDraft();
                    }
                  }}
                  data-testid="upcoming-select"
                >
                  <option value="">None — use the folder’s details file</option>
                  {upcomingDraft &&
                  !upcomingOptions.some((option) => option.id === upcomingDraft.id) ? (
                    <option value={upcomingDraft.id}>
                      {upcomingDraft.title.trim() || "Untitled"}
                    </option>
                  ) : null}
                  {upcomingOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {[option.title.trim() || "Untitled", option.venue.trim()].filter(Boolean).join(" · ")}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {upcomingMessage ? (
              <p className={np.upcomingNote} role="status" data-testid="upcoming-message">
                {upcomingMessage}
                {upcomingDraft
                  ? " If the folder has a details.txt, the details from your upcoming production are kept instead."
                  : ""}
              </p>
            ) : null}
          </div>
        ) : null}

        <div
          className={
            isPublishing
              ? `${ci.dropzone} ${ci.dropzoneBusy}`
              : ci.dropzone
          }
        >
          <input
            type="file"
            multiple
            // @ts-expect-error webkitdirectory is supported by Safari/Chromium.
            webkitdirectory=""
            aria-label="Choose production folder"
            className={ci.dropInput}
            onChange={(
              event,
            ) =>
              void chooseFolder(
                event.target
                  .files,
              )
            }
          />

          <span
            className={ci.dropIcon}
            aria-hidden="true"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M3 6.5h6l2 2h10v10H3z" />
            </svg>
          </span>

          <div className={ci.dropText}>
            <p className={ci.dropTitle}>
              Drop the production folder here, or click to choose
            </p>
            <p className={ci.dropSub}>
              JPEG, PNG or WebP · converted to WebP automatically before upload
            </p>
            <p className={ci.dropSub}>
              Include a details.txt or details.rtf file in the folder to fill in the production information.
            </p>
          </div>

          <div className={ci.dropPick}>
            {images.length > 0 ? (
              <span className={ci.dropStaged}>
                <b>Loaded</b>
                {images.length.toLocaleString()} photograph
                {images.length === 1 ? "" : "s"}
              </span>
            ) : null}

            <span
              className={
                images.length > 0
                  ? ci.btnLg
                  : `${ci.btnLg} ${ci.btnGold}`
              }
              aria-hidden="true"
            >
              {images.length > 0
                ? "Choose another folder…"
                : "Choose folder…"}
            </span>
          </div>
        </div>

        {progress ? (
          <p className={ci.msg}>
            {isPublishing ? (
              <span
                className={ci.spinner}
                aria-hidden="true"
              />
            ) : null}
            {progress}
          </p>
        ) : null}

        {error ? (
          <p
            className={`${ci.msg} ${ci.msgError}`}
          >
            {error}
          </p>
        ) : null}

        {publishedUrl ? (
          <p className={ci.msg}>
            Published:{" "}
            <a
              className={np.goldLink}
              href={
                publishedUrl
              }
            >
              {publishedUrl}
            </a>
          </p>
        ) : null}
      </section>

      {images.length >
      0 ? (
        <>
          <section>
            <div className={ci.sectionHead}>
              <div>
                <p className={ci.eyebrow}>
                  Step 2
                </p>
                <h2 className={ci.sectionTitle}>
                  Production information
                </h2>
              </div>
              <span
                className={
                  detailsFileName || upcomingDraft
                    ? `${ci.chip} ${ci.chipReady}`
                    : `${ci.chip} ${ci.chipExisting}`
                }
              >
                <span
                  className={ci.chipDot}
                  aria-hidden="true"
                />
                {upcomingDraft
                  ? "Filled in from Upcoming"
                  : detailsFileName
                    ? `Read from ${detailsFileName}`
                    : "Required before publishing"}
              </span>
            </div>

            <div className={pe.detailsGrid}>
              <div className={pe.card}>
                <div className={pe.cardHead}>
                  <h3 className={pe.cardTitle}>
                    Production
                  </h3>
                  <span
                    className={
                      detailsReady
                        ? pe.cardMeta
                        : `${pe.cardMeta} ${pe.cardMetaGold}`
                    }
                  >
                    {detailsReady
                      ? "Complete"
                      : "Title, venue, month, year and description are required"}
                  </span>
                </div>

                <label className={sw.field}>
                  Production
                  <input
                    className={sw.input}
                    value={
                      title
                    }
                    onChange={(
                      event,
                    ) =>
                      setTitle(
                        event
                          .target
                          .value,
                      )
                    }
                  />
                </label>

                <label className={sw.field}>
                  Venue
                  <input
                    className={sw.input}
                    value={
                      venue
                    }
                    onChange={(
                      event,
                    ) =>
                      setVenue(
                        event
                          .target
                          .value,
                      )
                    }
                  />
                </label>

                <div className={np.pair}>
                  <label className={sw.field}>
                    Month
                    <select
                      className={sw.select}
                      value={
                        month
                      }
                      onChange={(
                        event,
                      ) =>
                        setMonth(
                          event
                            .target
                            .value,
                        )
                      }
                    >
                      <option value="">
                        Choose month
                      </option>
                      {MONTHS.slice(
                        1,
                      ).map(
                        (
                          name,
                          index,
                        ) => (
                          <option
                            key={
                              name
                            }
                            value={
                              index +
                              1
                            }
                          >
                            {name}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label className={sw.field}>
                    Year
                    <input
                      className={sw.input}
                      inputMode="numeric"
                      value={
                        year
                      }
                      onChange={(
                        event,
                      ) =>
                        setYear(
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </label>
                </div>

                <label className={sw.field}>
                  Description
                  <textarea
                    className={`${sw.textarea} ${np.description}`}
                    rows={
                      7
                    }
                    value={
                      description
                    }
                    onChange={(
                      event,
                    ) =>
                      setDescription(
                        event
                          .target
                          .value,
                      )
                    }
                  />
                </label>
              </div>

              <div className={pe.card}>
                <div className={pe.cardHead}>
                  <h3 className={pe.cardTitle}>
                    Credits
                  </h3>
                  <span className={pe.cardMeta}>
                    Optional
                  </span>
                </div>

                <div className={np.creditGrid}>
                  {creditFields.map(
                    ([label, value, setValue]) => (
                      <label
                        key={label}
                        className={sw.field}
                      >
                        {label}
                        <input
                          className={sw.input}
                          value={value}
                          onChange={(
                            event,
                          ) =>
                            setValue(
                              event
                                .target
                                .value,
                            )
                          }
                        />
                      </label>
                    ),
                  )}
                </div>

                <div className={np.pasteWrap}>
                  <PasteCreditsPanel
                    existingCredits={
                      creditsForPaste
                    }
                    onAdd={
                      addPastedCredits
                    }
                    afterAddHint="They will be published with the production."
                  />
                </div>

                {extraCredits.length >
                0 ? (
                  <div>
                    <p className={np.subLabel}>
                      Other credits
                    </p>

                    <div className={np.extraList}>
                      {extraCredits.map(
                        (
                          credit,
                          index,
                        ) => (
                          <div
                            key={index}
                            className={np.extraRow}
                          >
                            <input
                              className={sw.input}
                              aria-label="Role"
                              value={
                                credit.role
                              }
                              onChange={(
                                event,
                              ) =>
                                setExtraCredits(
                                  (current) =>
                                    current.map(
                                      (
                                        item,
                                        itemIndex,
                                      ) =>
                                        itemIndex ===
                                        index
                                          ? {
                                              ...item,
                                              role: event
                                                .target
                                                .value,
                                            }
                                          : item,
                                    ),
                                )
                              }
                            />

                            <input
                              className={sw.input}
                              aria-label="Name"
                              value={
                                credit.name
                              }
                              onChange={(
                                event,
                              ) =>
                                setExtraCredits(
                                  (current) =>
                                    current.map(
                                      (
                                        item,
                                        itemIndex,
                                      ) =>
                                        itemIndex ===
                                        index
                                          ? {
                                              ...item,
                                              name: event
                                                .target
                                                .value,
                                            }
                                          : item,
                                    ),
                                )
                              }
                            />

                            <button
                              type="button"
                              className={`${ci.btn} ${ci.btnQuiet}`}
                              onClick={() =>
                                setExtraCredits(
                                  (current) =>
                                    current.filter(
                                      (
                                        _item,
                                        itemIndex,
                                      ) =>
                                        itemIndex !==
                                        index,
                                    ),
                                )
                              }
                            >
                              Remove
                            </button>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section>
            <div className={ci.sectionHead}>
              <div>
                <p className={ci.eyebrow}>
                  Step 3
                </p>
                <h2 className={ci.sectionTitle}>
                  Images
                </h2>
              </div>
              <div className={np.chips}>
                <span
                  className={`${ci.chip} ${ci.chipReady}`}
                >
                  <span
                    className={ci.chipDot}
                    aria-hidden="true"
                  />
                  {includedImages.length} included
                </span>
                <span
                  className={
                    heroIncluded
                      ? `${ci.chip} ${ci.chipExisting}`
                      : `${ci.chip} ${ci.chipAttention}`
                  }
                >
                  <span
                    className={ci.chipDot}
                    aria-hidden="true"
                  />
                  {heroIncluded
                    ? "Hero chosen"
                    : "Choose an included hero image."}
                </span>
              </div>
            </div>

            <p className={np.hint}>
              Untick any photograph you don&apos;t want to publish, and choose one as the hero.
            </p>

            <div className={np.imageGrid}>
              {images.map(
                (
                  image,
                ) => {
                  const isHero =
                    image.id ===
                    heroId;
                  const tileClass = [
                    np.tile,
                    isHero
                      ? np.tileHero
                      : "",
                    image.included
                      ? ""
                      : np.tileExcluded,
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <article
                      key={
                        image.id
                      }
                      className={tileClass}
                    >
                      <div className={np.frame}>
                        <img
                          src={
                            image.previewUrl
                          }
                          alt=""
                        />
                        {isHero ? (
                          <span className={np.heroBadge}>
                            HERO
                          </span>
                        ) : null}
                      </div>

                      <p
                        className={np.fileName}
                        title={image.file.name}
                      >
                        {
                          image
                            .file
                            .name
                        }
                      </p>

                      <div className={np.tileControls}>
                        <label className={np.check}>
                          <input
                            type="checkbox"
                            checked={
                              image.included
                            }
                            onChange={() =>
                              setImages(
                                (
                                  current,
                                ) =>
                                  current.map(
                                    (
                                      candidate,
                                    ) =>
                                      candidate.id ===
                                      image.id
                                        ? {
                                            ...candidate,
                                            included:
                                              !candidate.included,
                                          }
                                        : candidate,
                                  ),
                              )
                            }
                          />
                          Include
                        </label>

                        <label className={np.check}>
                          <input
                            type="radio"
                            name="hero"
                            checked={
                              heroId ===
                              image.id
                            }
                            onChange={() =>
                              setHeroId(
                                image.id,
                              )
                            }
                          />
                          Hero
                        </label>
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          </section>

          <section>
            {publishSucceeded ? (
              <div
                role="status"
                className={np.success}
              >
                <strong className={np.successTitle}>
                  Production published successfully
                </strong>

                <span>
                  {title.trim()} is now live in the archive.
                  {upcomingAfterPublish ? ` ${upcomingAfterPublish}` : ""}
                </span>

                {publishedUrl ? (
                  <>
                    {" "}
                    <a
                      href={
                        publishedUrl
                      }
                      className={np.goldLink}
                    >
                      View production
                    </a>
                  </>
                ) : null}
              </div>
            ) : null}
          </section>

          <div
            className={ci.batchBar}
            role="region"
            aria-label="Upload and publish"
          >
            <div className={ci.batchText}>
              <p className={ci.batchLabel}>
                Step 4 · Upload &amp; publish
              </p>
              <p className={ci.batchStatus}>
                {isPublishing ? (
                  <span
                    className={ci.spinner}
                    aria-hidden="true"
                  />
                ) : null}
                <span className={np.barStatus}>
                  {isPublishing && progress
                    ? progress
                    : `${includedImages.length} image${
                        includedImages.length === 1
                          ? ""
                          : "s"
                      } included${
                        hero
                          ? ` · hero: ${hero.file.name}`
                          : ""
                      }`}
                </span>
              </p>
              {error && !isPublishing ? (
                <p
                  className={`${ci.batchResult} ${ci.batchResultFailed}`}
                >
                  {error}
                </p>
              ) : publishSucceeded ? (
                <p className={ci.batchResult}>
                  Published successfully.
                </p>
              ) : null}
            </div>

            <div className={ci.batchButtons}>
              <button
                type="button"
                className={
                  isPublishing
                    ? `${ci.btnLg} ${ci.btnBusy}`
                    : `${ci.btnLg} ${ci.btnGold}`
                }
                disabled={
                  isPublishing
                }
                onClick={() =>
                  void publish()
                }
              >
                {isPublishing
                  ? "Publishing…"
                  : "Upload & Publish"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
