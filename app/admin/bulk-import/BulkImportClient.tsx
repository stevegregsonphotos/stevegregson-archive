"use client";

import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import JSZip from "jszip";

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
]);

const DETAILS_EXTENSIONS = new Set([
  "txt",
  "rtf",
  "docx",
  "pdf",
]);

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

const MONTH_ALIASES: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

type ExistingProduction = {
  slug: string;
  title: string;
  month: number | null;
  year: number;
};

type BulkImportClientProps = {
  existingProductions: ExistingProduction[];
};

type ProductionDetails = {
  title: string;
  venue: string;
  month: number | null;
  year: number | null;
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

type ProductionPreflight = {
  folder: string;
  title: string;
  venue: string;
  month: number | null;
  year: number | null;
  locked: boolean;
  imageCount: number;
  detailsCount: number;
  fileCount: number;
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
  status:
    | "ready"
    | "attention"
    | "existing";
  existingSlug: string | null;
  issues: string[];
};

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
  metrics: {
    technicalScore: number;
  };
  suggestion: {
    include: boolean;
    order: number | null;
    layout: GalleryLayout;
  };
};

type PreviewResponse = {
  ok: boolean;
  message: string;
  archive?: {
    suggestedSlug: string;
  };
  contents?: {
    images: PreviewImage[];
    suggestedHeroPath: string | null;
  };
};

type VisionReview = {
  hero: string;
  sequence: string[];
  keep: string[];
  remove: string[];
  editorialSummary: string;
};

type ImageMetadata = {
  alt: string;
  filename: string;
  layout: GalleryLayout;
};

type BatchResult = {
  status: "processing" | "published" | "failed";
  message: string;
};

function extension(filename: string) {
  const dot = filename.lastIndexOf(".");

  if (dot === -1) {
    return "";
  }

  return filename.slice(dot + 1).toLowerCase();
}

function productionFolderFromFile(file: File) {
  const relativePath =
    file.webkitRelativePath || file.name;

  const parts = relativePath
    .split("/")
    .filter(Boolean);

  if (parts.length >= 3) {
    return parts[1];
  }

  if (parts.length >= 2) {
    return parts[0];
  }

  return "";
}

function parseFolderDate(folder: string) {
  const lower = folder.toLowerCase();

  let year: number | null = null;
  let month: number | null = null;

  const yearMatches =
    lower.match(/\b(?:19|20)\d{2}\b/g);

  if (yearMatches?.length) {
    year = Number(
      yearMatches[yearMatches.length - 1],
    );
  }

  const monthPattern = new RegExp(
    `\\b(${[
      ...MONTHS,
      "jan",
      "feb",
      "mar",
      "apr",
      "jun",
      "jul",
      "aug",
      "sep",
      "sept",
      "oct",
      "nov",
      "dec",
    ].join("|")})\\b`,
    "i",
  );

  const monthMatch =
    lower.match(monthPattern);

  if (monthMatch) {
    month =
      MONTH_ALIASES[
        monthMatch[1].toLowerCase()
      ] ?? null;
  }

  let title = folder.trim();

  title = title
    .replace(
      /\s*\((?=[^)]*(?:19|20)\d{2})[^)]*\)\s*$/i,
      "",
    )
    .replace(
      /\s*[—–-]\s*(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)[^0-9]*(?:19|20)\d{2}\s*$/i,
      "",
    )
    .trim();

  return {
    title: title || folder,
    month,
    year,
  };
}

function cleanDetailValue(value: string) {
  const cleaned = value.trim();

  if (/^not\s+found$/i.test(cleaned)) {
    return "";
  }

  return cleaned;
}

function emptyProductionDetails(): ProductionDetails {
  return {
    title: "",
    venue: "",
    month: null,
    year: null,
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
}

function parseDetailsText(text: string): ProductionDetails {
  const fields = emptyProductionDetails();

  const labelMap: Record<
    string,
    keyof Omit<ProductionDetails, "month" | "year">
  > = {
    production: "title",
    title: "title",
    venue: "venue",
    theatre: "venue",
    director: "director",
    "associate director": "associateDirector",
    "musical director": "musicalDirector",
    choreographer: "choreographer",
    lighting: "lightingDesign",
    "lighting design": "lightingDesign",
    "lighting designer": "lightingDesign",
    "set design": "setDesign",
    "set designer": "setDesign",
    "costume design": "costumeDesign",
    "costume designer": "costumeDesign",
    "set & costume design": "setCostumeDesign",
    "set and costume design": "setCostumeDesign",
    "sound design": "soundDesign",
    "sound designer": "soundDesign",
    "commissioned by": "commissionedBy",
    description: "description",
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const match = line.match(/^([^:]{2,60}):\s*(.*)$/);

    if (!match) {
      continue;
    }

    const label = match[1]
      .trim()
      .toLowerCase()
      .replace(/\.$/, "");

    const value = cleanDetailValue(match[2]);

    if (!value) {
      continue;
    }

    if (
      label === "year" ||
      label === "production year"
    ) {
      const parsedYear = Number(value);

      if (
        Number.isInteger(parsedYear) &&
        parsedYear >= 1900 &&
        parsedYear <= 2100
      ) {
        fields.year = parsedYear;
      }

      continue;
    }

    if (
      label === "month" ||
      label === "production month"
    ) {
      fields.month =
        MONTH_ALIASES[value.toLowerCase()] ?? null;
      continue;
    }

    const target = labelMap[label];

    if (!target) {
      continue;
    }

    if (target === "description" && fields.description) {
      fields.description =
        `${fields.description} ${value}`;
    } else if (!fields[target]) {
      fields[target] = value;
    }
  }

  return fields;
}

function createUniqueFilename(
  requested: string,
  used: Set<string>,
) {
  const dot = requested.lastIndexOf(".");
  const stem =
    dot > 0
      ? requested.slice(0, dot)
      : requested;
  const ext =
    dot > 0
      ? requested.slice(dot)
      : "";

  let candidate = requested;
  let suffix = 2;

  while (used.has(candidate.toLowerCase())) {
    candidate = `${stem}-${suffix}${ext}`;
    suffix += 1;
  }

  used.add(candidate.toLowerCase());

  return candidate;
}

function createCredits(
  production: ProductionPreflight,
) {
  return [
    {
      role: "Venue",
      name: production.venue.trim(),
    },
    {
      role: "Director",
      name: production.director.trim(),
    },
    {
      role: "Associate Director",
      name: production.associateDirector.trim(),
    },
    {
      role: "Musical Director",
      name: production.musicalDirector.trim(),
    },
    {
      role: "Choreographer",
      name: production.choreographer.trim(),
    },
    {
      role: "Lighting Design",
      name: production.lightingDesign.trim(),
    },
    {
      role: "Set Design",
      name: production.setDesign.trim(),
    },
    {
      role: "Costume Design",
      name: production.costumeDesign.trim(),
    },
    {
      role: "Set & Costume Design",
      name: production.setCostumeDesign.trim(),
    },
    {
      role: "Sound Design",
      name: production.soundDesign.trim(),
    },
    {
      role: "Commissioned by",
      name: production.commissionedBy.trim(),
    },
    {
      role: "Photography",
      name: "Steve Gregson",
    },
  ].filter((credit) => credit.name);
}

export default function BulkImportClient({
  existingProductions,
}: BulkImportClientProps) {
  const inputRef =
    useRef<HTMLInputElement | null>(null);

  const [files, setFiles] =
    useState<File[]>([]);

  const [detailsByFolder, setDetailsByFolder] =
    useState<Record<string, ProductionDetails>>({});

  const [isReadingDetails, setIsReadingDetails] =
    useState(false);

  const [isProcessing, setIsProcessing] =
    useState(false);

  const [batchProgress, setBatchProgress] =
    useState({
      current: 0,
      total: 0,
      stage: "",
    });

  const [batchResults, setBatchResults] =
    useState<Record<string, BatchResult>>({});

  useEffect(() => {
    inputRef.current?.setAttribute(
      "webkitdirectory",
      "",
    );

    inputRef.current?.setAttribute(
      "directory",
      "",
    );
  }, []);

  const productions =
    useMemo<ProductionPreflight[]>(() => {
      const groups =
        new Map<string, File[]>();

      for (const file of files) {
        const folder =
          productionFolderFromFile(file);

        if (!folder) {
          continue;
        }

        const existing =
          groups.get(folder) ?? [];

        existing.push(file);
        groups.set(folder, existing);
      }

      return [...groups.entries()]
        .map(([folder, productionFiles]) => {
          const parsed =
            parseFolderDate(folder);

          const details =
            detailsByFolder[folder] ??
            emptyProductionDetails();

          const imageCount =
            productionFiles.filter((file) =>
              IMAGE_EXTENSIONS.has(
                extension(file.name),
              ),
            ).length;

          const detailsCount =
            productionFiles.filter((file) =>
              DETAILS_EXTENSIONS.has(
                extension(file.name),
              ),
            ).length;

          const detailsTitleDate =
            details.title.trim()
              ? parseFolderDate(
                  details.title.trim(),
                )
              : null;

          const month =
            details.month ??
            detailsTitleDate?.month ??
            parsed.month;

          const year =
            details.year ??
            detailsTitleDate?.year ??
            parsed.year;

          const title =
            detailsTitleDate?.title ||
            parsed.title;

          const existingProduction =
            existingProductions.find(
              (existing) =>
                existing.title
                  .trim()
                  .toLowerCase() ===
                  title
                    .trim()
                    .toLowerCase() &&
                existing.month === month &&
                existing.year === year,
            ) ?? null;

          const issues: string[] = [];

          if (imageCount === 0) {
            issues.push("No images");
          } else if (imageCount < 2) {
            issues.push("Needs at least 2 images");
          }

          if (detailsCount === 0) {
            issues.push("No details file");
          }

          if (!year) {
            issues.push("Year missing");
          }

          if (!month) {
            issues.push("Month missing");
          }

          if (!title.trim()) {
            issues.push("Title missing");
          }

          if (!details.venue.trim()) {
            issues.push("Venue missing");
          }

          if (!details.description.trim()) {
            issues.push("Description missing");
          }

          const status: ProductionPreflight["status"] =
            existingProduction
              ? "existing"
              : issues.length === 0
                ? "ready"
                : "attention";

          return {
            folder,
            title,
            venue: details.venue,
            month,
            year,
            locked: /school/i.test(folder),
            imageCount,
            detailsCount,
            fileCount:
              productionFiles.length,
            director: details.director,
            associateDirector:
              details.associateDirector,
            musicalDirector:
              details.musicalDirector,
            choreographer:
              details.choreographer,
            lightingDesign:
              details.lightingDesign,
            setDesign:
              details.setDesign,
            costumeDesign:
              details.costumeDesign,
            setCostumeDesign:
              details.setCostumeDesign,
            soundDesign:
              details.soundDesign,
            commissionedBy:
              details.commissionedBy,
            description:
              details.description,
            status,
            existingSlug:
              existingProduction?.slug ??
              null,
            issues,
          };
        })
        .sort((a, b) =>
          a.folder.localeCompare(
            b.folder,
            undefined,
            {
              numeric: true,
              sensitivity: "base",
            },
          ),
        );
    }, [
      files,
      detailsByFolder,
      existingProductions,
    ]);

  async function handleFolderChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFiles = Array.from(
      event.target.files ?? [],
    );

    setFiles(selectedFiles);
    setDetailsByFolder({});

    const groups =
      new Map<string, File[]>();

    for (const file of selectedFiles) {
      const folder =
        productionFolderFromFile(file);

      if (!folder) {
        continue;
      }

      const existing =
        groups.get(folder) ?? [];

      existing.push(file);
      groups.set(folder, existing);
    }

    setIsReadingDetails(true);

    try {
      const parsedEntries =
        await Promise.all(
          [...groups.entries()].map(
            async ([folder, productionFiles]) => {
              const detailsFile =
                productionFiles.find(
                  (file) =>
                    extension(file.name) === "txt",
                );

              if (!detailsFile) {
                return [
                  folder,
                  emptyProductionDetails(),
                ] as const;
              }

              const text =
                await detailsFile.text();

              return [
                folder,
                parseDetailsText(text),
              ] as const;
            },
          ),
        );

      setDetailsByFolder(
        Object.fromEntries(parsedEntries),
      );
    } finally {
      setIsReadingDetails(false);
    }
  }

  async function createProductionArchive(
    production: ProductionPreflight,
  ) {
    const productionFiles =
      files.filter(
        (file) =>
          productionFolderFromFile(file) ===
          production.folder,
      );

    const zip = new JSZip();

    for (const file of productionFiles) {
      if (file.name === ".DS_Store") {
        continue;
      }

      zip.file(file.name, file);
    }

    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6,
      },
    });

    return new File(
      [blob],
      `${production.folder}.zip`,
      {
        type: "application/zip",
      },
    );
  }

  function updateBatchResult(
    folder: string,
    result: BatchResult,
  ) {
    setBatchResults((current) => ({
      ...current,
      [folder]: result,
    }));
  }

  async function processProduction(
    production: ProductionPreflight,
  ) {
    if (!production.month || !production.year) {
      throw new Error(
        "Month and year are required.",
      );
    }

    updateBatchResult(
      production.folder,
      {
        status: "processing",
        message: "Preparing ZIP",
      },
    );

    setBatchProgress((current) => ({
      ...current,
      stage: `Preparing ${production.title}`,
    }));

    const archive =
      await createProductionArchive(
        production,
      );

    const previewForm = new FormData();
    previewForm.set(
      "productionArchive",
      archive,
    );

    const previewResponse = await fetch(
      "/api/admin/production-preview",
      {
        method: "POST",
        body: previewForm,
      },
    );

    const preview =
      (await previewResponse.json()) as
        PreviewResponse;

    if (
      !previewResponse.ok ||
      !preview.ok ||
      !preview.archive ||
      !preview.contents
    ) {
      throw new Error(
        preview.message ||
          "Production preview failed.",
      );
    }

    const images =
      preview.contents.images;

    if (images.length < 2) {
      throw new Error(
        "At least two photographs are required.",
      );
    }

    updateBatchResult(
      production.folder,
      {
        status: "processing",
        message: "AI selecting hero",
      },
    );

    setBatchProgress((current) => ({
      ...current,
      stage: `AI reviewing ${production.title}`,
    }));

    const reviewResponse = await fetch(
      "/api/admin/vision-review",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          production: {
            title: production.title,
            venue: production.venue,
            year: production.year,
            description:
              production.description,
          },
          images: images.map((image) => ({
            filename: image.filename,
            previewUrl: image.previewUrl,
            heroScore: image.heroScore,
            technicalScore:
              image.metrics.technicalScore,
            width: image.width,
            height: image.height,
            orientation:
              image.orientation,
          })),
        }),
      },
    );

    const reviewData =
      (await reviewResponse.json()) as {
        ok: boolean;
        message?: string;
        review?: VisionReview;
      };

    if (
      !reviewResponse.ok ||
      !reviewData.ok ||
      !reviewData.review
    ) {
      throw new Error(
        reviewData.message ||
          "Vision AI review failed.",
      );
    }

    const review =
      reviewData.review;

    const hero =
      images.find(
        (image) =>
          image.filename === review.hero,
      ) ??
      images.find(
        (image) =>
          image.filepath ===
          preview.contents?.suggestedHeroPath,
      ) ??
      [...images].sort(
        (a, b) =>
          b.heroScore - a.heroScore,
      )[0];

    if (!hero) {
      throw new Error(
        "No hero photograph could be selected.",
      );
    }

    const metadataByPath =
      new Map<string, ImageMetadata>();

    for (
      let index = 0;
      index < images.length;
      index += 1
    ) {
      const image = images[index];

      updateBatchResult(
        production.folder,
        {
          status: "processing",
          message:
            `AI metadata ${index + 1}/${images.length}`,
        },
      );

      setBatchProgress((current) => ({
        ...current,
        stage:
          `${production.title}: metadata ${index + 1}/${images.length}`,
      }));

      const response = await fetch(
        "/api/admin/vision/analyse-image",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            image: image.filename,
            previewUrl:
              image.previewUrl,
            production: {
              title:
                production.title,
              venue:
                production.venue,
              year:
                production.year,
              description:
                production.description,
            },
          }),
        },
      );

      const data =
        (await response.json()) as {
          ok: boolean;
          metadata?: ImageMetadata;
          message?: string;
        };

      if (
        !response.ok ||
        !data.ok ||
        !data.metadata
      ) {
        throw new Error(
          data.message ||
            `AI metadata failed for ${image.filename}.`,
        );
      }

      metadataByPath.set(
        image.filepath,
        data.metadata,
      );
    }

    const imageByFilename =
      new Map(
        images.map((image) => [
          image.filename,
          image,
        ]),
      );

    const ordered: PreviewImage[] = [];
    const added =
      new Set<string>();

    for (const filename of
      review.sequence ?? []) {
      const image =
        imageByFilename.get(filename);

      if (
        !image ||
        image.filepath === hero.filepath ||
        added.has(image.filepath)
      ) {
        continue;
      }

      ordered.push(image);
      added.add(image.filepath);
    }

    /*
     * Archive Selects is already curated.
     * Never silently drop photographs just
     * because the AI review omitted them.
     */
    for (const image of images) {
      if (
        image.filepath === hero.filepath ||
        added.has(image.filepath)
      ) {
        continue;
      }

      ordered.push(image);
      added.add(image.filepath);
    }

    const usedFilenames =
      new Set<string>();

    const heroMetadata =
      metadataByPath.get(hero.filepath);

    if (!heroMetadata) {
      throw new Error(
        "Hero metadata is missing.",
      );
    }

    const heroFilename =
      createUniqueFilename(
        heroMetadata.filename,
        usedFilenames,
      );

    const genericAlt =
      `${production.title} at ${production.venue}, photographed by Steve Gregson`;

    const publishData = {
      slug:
        preview.archive.suggestedSlug,
      title:
        production.title.trim(),
      venue:
        production.venue.trim(),
      month:
        production.month,
      year:
        production.year,
      description:
        production.description.trim(),
      access:
        production.locked
          ? "password"
          : "public",
      hero: {
        filepath:
          hero.filepath,
        filename:
          heroFilename,
        alt:
          heroMetadata.alt ||
          genericAlt,
      },
      credits:
        createCredits(production),
      images:
        ordered.map((image) => {
          const metadata =
            metadataByPath.get(
              image.filepath,
            );

          if (!metadata) {
            throw new Error(
              `Metadata is missing for ${image.filename}.`,
            );
          }

          return {
            filepath:
              image.filepath,
            filename:
              createUniqueFilename(
                metadata.filename,
                usedFilenames,
              ),
            alt:
              metadata.alt ||
              genericAlt,
            layout:
              metadata.layout ||
              image.suggestion.layout,
          };
        }),
    };

    updateBatchResult(
      production.folder,
      {
        status: "processing",
        message: "Publishing",
      },
    );

    setBatchProgress((current) => ({
      ...current,
      stage: `Publishing ${production.title}`,
    }));

    const publishForm =
      new FormData();

    publishForm.set(
      "productionArchive",
      archive,
    );

    publishForm.set(
      "productionData",
      JSON.stringify(publishData),
    );

    const publishResponse =
      await fetch(
        "/api/admin/publish-production",
        {
          method: "POST",
          body: publishForm,
        },
      );

    const responseText =
      await publishResponse.text();

    let publishResult: {
      ok: boolean;
      message: string;
    };

    try {
      publishResult =
        JSON.parse(responseText) as {
          ok: boolean;
          message: string;
        };
    } catch {
      throw new Error(
        `Publishing returned invalid JSON (${publishResponse.status}).`,
      );
    }

    if (
      !publishResponse.ok ||
      !publishResult.ok
    ) {
      throw new Error(
        publishResult.message ||
          "Production publishing failed.",
      );
    }

    updateBatchResult(
      production.folder,
      {
        status: "published",
        message: "Published",
      },
    );
  }

  async function processReadyProductions(
    limit?: number,
  ) {
    if (isProcessing) {
      return;
    }

    const ready =
      productions.filter(
        (production) =>
          production.status === "ready",
      );

    const queue =
      typeof limit === "number"
        ? ready.slice(0, limit)
        : ready;

    if (queue.length === 0) {
      return;
    }

    if (
      limit === undefined &&
      !window.confirm(
        `Process and publish all ${queue.length} ready productions?`,
      )
    ) {
      return;
    }

    setIsProcessing(true);
    setBatchProgress({
      current: 0,
      total: queue.length,
      stage: "Starting batch",
    });

    for (
      let index = 0;
      index < queue.length;
      index += 1
    ) {
      const production =
        queue[index];

      setBatchProgress({
        current: index + 1,
        total: queue.length,
        stage:
          `Starting ${production.title}`,
      });

      try {
        await processProduction(
          production,
        );
      } catch (error) {
        console.error(
          `Bulk import failed for ${production.folder}:`,
          error,
        );

        updateBatchResult(
          production.folder,
          {
            status: "failed",
            message:
              error instanceof Error
                ? error.message
                : "Import failed",
          },
        );
      }
    }

    setBatchProgress((current) => ({
      ...current,
      stage: "Batch complete",
    }));

    setIsProcessing(false);
  }

  async function processFirstLockedProduction() {
    if (isProcessing) {
      return;
    }

    const lockedProduction =
      productions.find(
        (production) =>
          production.status === "ready" &&
          production.locked,
      );

    if (!lockedProduction) {
      return;
    }

    setIsProcessing(true);
    setBatchProgress({
      current: 1,
      total: 1,
      stage:
        `Starting ${lockedProduction.title}`,
    });

    try {
      await processProduction(
        lockedProduction,
      );
    } catch (error) {
      console.error(
        `Bulk import failed for ${lockedProduction.folder}:`,
        error,
      );

      updateBatchResult(
        lockedProduction.folder,
        {
          status: "failed",
          message:
            error instanceof Error
              ? error.message
              : "Import failed",
        },
      );
    }

    setBatchProgress((current) => ({
      ...current,
      stage: "Batch complete",
    }));

    setIsProcessing(false);
  }

  const readyCount =
    productions.filter(
      (production) =>
        production.status === "ready",
    ).length;

  const existingCount =
    productions.filter(
      (production) =>
        production.status === "existing",
    ).length;

  const attentionCount =
    productions.filter(
      (production) =>
        production.status === "attention",
    ).length;

  const lockedCount =
    productions.filter(
      (production) => production.locked,
    ).length;

  return (
    <section
      style={{
        borderTop:
          "1px solid rgba(242, 238, 230, 0.22)",
        paddingTop: "2rem",
      }}
    >
      <label
        style={{
          display: "block",
          marginBottom: "1rem",
          color: "#c7a369",
          fontSize: "0.56rem",
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        Archive parent folder
      </label>

      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleFolderChange}
        style={{
          display: "block",
          width: "100%",
          maxWidth: "40rem",
          marginBottom: "2rem",
        }}
      />

      {productions.length > 0 ? (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1.5rem",
              marginBottom: "2.5rem",
              color:
                "rgba(242, 238, 230, 0.72)",
            }}
          >
            <span>
              {productions.length} productions
            </span>

            <span>
              {readyCount} ready
            </span>

            <span>
              {attentionCount} need attention
            </span>

            <span>
              {existingCount} already existing
            </span>

            <span>
              {lockedCount} automatically locked
            </span>

            {isReadingDetails ? (
              <span>Reading production details…</span>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              marginBottom: "2rem",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              className="backstage-button"
              disabled={
                isProcessing ||
                readyCount === 0
              }
              onClick={() =>
                void processReadyProductions(1)
              }
            >
              Process first ready production
            </button>

            <button
              type="button"
              className="backstage-button"
              disabled={
                isProcessing ||
                readyCount === 0
              }
              onClick={() =>
                void processReadyProductions(5)
              }
            >
              Process first 5 ready productions
            </button>

            <button
              type="button"
              className="backstage-button"
              disabled={
                isProcessing ||
                !productions.some(
                  (production) =>
                    production.status === "ready" &&
                    production.locked,
                )
              }
              onClick={() =>
                void processFirstLockedProduction()
              }
            >
              Process first locked production
            </button>

            <button
              type="button"
              className="backstage-button"
              disabled={
                isProcessing ||
                readyCount === 0
              }
              onClick={() =>
                void processReadyProductions()
              }
            >
              Process all ready productions
            </button>

            {batchProgress.total > 0 ? (
              <span
                style={{
                  color:
                    "rgba(242, 238, 230, 0.68)",
                  fontSize: "0.72rem",
                }}
              >
                {batchProgress.current}/
                {batchProgress.total}
                {" · "}
                {batchProgress.stage}
              </span>
            ) : null}
          </div>

          <div
            style={{
              overflowX: "auto",
              borderTop:
                "1px solid rgba(242, 238, 230, 0.16)",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.75rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    textAlign: "left",
                    color:
                      "rgba(242, 238, 230, 0.5)",
                  }}
                >
                  <th style={{ padding: "1rem 0.75rem" }}>
                    Production
                  </th>
                  <th style={{ padding: "1rem 0.75rem" }}>
                    Month
                  </th>
                  <th style={{ padding: "1rem 0.75rem" }}>
                    Year
                  </th>
                  <th style={{ padding: "1rem 0.75rem" }}>
                    Images
                  </th>
                  <th style={{ padding: "1rem 0.75rem" }}>
                    Details
                  </th>
                  <th style={{ padding: "1rem 0.75rem" }}>
                    Access
                  </th>
                  <th style={{ padding: "1rem 0.75rem" }}>
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {productions.map(
                  (production) => (
                    <tr
                      key={production.folder}
                      style={{
                        borderTop:
                          "1px solid rgba(242, 238, 230, 0.1)",
                      }}
                    >
                      <td
                        style={{
                          padding:
                            "1rem 0.75rem",
                          minWidth: "18rem",
                        }}
                      >
                        <strong
                          style={{
                            display: "block",
                            fontWeight: 600,
                          }}
                        >
                          {production.title}
                        </strong>

                        <span
                          style={{
                            display: "block",
                            marginTop: "0.35rem",
                            color:
                              "rgba(242, 238, 230, 0.42)",
                            fontSize: "0.65rem",
                          }}
                        >
                          {production.folder}
                        </span>
                      </td>

                      <td style={{ padding: "1rem 0.75rem" }}>
                        {production.month
                          ? MONTHS[
                              production.month - 1
                            ]
                              .charAt(0)
                              .toUpperCase() +
                            MONTHS[
                              production.month - 1
                            ].slice(1)
                          : "—"}
                      </td>

                      <td style={{ padding: "1rem 0.75rem" }}>
                        {production.year ?? "—"}
                      </td>

                      <td style={{ padding: "1rem 0.75rem" }}>
                        {production.imageCount}
                      </td>

                      <td style={{ padding: "1rem 0.75rem" }}>
                        {production.detailsCount > 0
                          ? "Found"
                          : "Missing"}
                      </td>

                      <td style={{ padding: "1rem 0.75rem" }}>
                        {production.locked
                          ? "Locked"
                          : "Public"}
                      </td>

                      <td
                        style={{
                          padding: "1rem 0.75rem",
                          minWidth: "12rem",
                        }}
                      >
                        {batchResults[
                          production.folder
                        ]?.message ??
                          (production.status === "existing"
                            ? `Existing: ${production.existingSlug}`
                            : production.status === "ready"
                              ? "Ready"
                              : production.issues.join(", "))}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p
          style={{
            margin: 0,
            color:
              "rgba(242, 238, 230, 0.62)",
            lineHeight: 1.7,
          }}
        >
          Choose the parent folder containing
          all production folders. Nothing is
          uploaded or published during this
          preflight.
        </p>
      )}
    </section>
  );
}
