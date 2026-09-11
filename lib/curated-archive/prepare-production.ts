import {
  createProductionSlug,
} from "@/lib/publishing/production-slug";
import {
  getProductions,
} from "@/lib/productions-repository";
import {
  getCuratedArchiveAccessOverrides,
  getCuratedArchiveOverrides,
  type CuratedArchiveOverride,
} from "@/lib/curated-archive-overrides-repository";
import {
  getDeterministicGalleryLayout,
  type GalleryOrientation,
} from "@/lib/publishing/gallery-layout";
import type {
  PublishPayload,
} from "@/lib/publishing/production-source";

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

const CURATION_ROOT = path.join(
  os.homedir(),
  "Downloads",
  "Archive Download",
  "Automated Curation",
);

const EXCLUSION_PATH = path.resolve(
  "scripts/archive-curator/excluded-productions.txt",
);

type CuratedCredit = {
  role: string;
  name: string;
  website?: string;
};

type CuratedImageOverride = {
  heroIndex: number;
  selectedIndexes: number[];
};

type CuratedOverride =
  CuratedArchiveOverride;

type SourceImage = {
  sequence: number;
  index: number;
  hero: boolean;
  stagedFile: string;
  sourceName: string;
  absolutePath: string;
  alt?: string;
};

export type PreparedCuratedProduction = {
  production: string;
  folder: string;
  status:
    | "ready"
    | "excluded"
    | "existing"
    | "attention";
  access:
    | "public"
    | "password";
  issues: string[];
  existingSlug: string | null;
  stagedDirectory: string;
  payload: PublishPayload | null;
  images: SourceImage[];
};

function normaliseProductionName(
  value: string,
) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[—–−]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parseMetadata(
  text: string,
) {
  const result:
    Record<string, string> = {};

  for (
    const rawLine of
    text.split(/\r?\n/)
  ) {
    const line =
      rawLine.trim();

    if (!line) {
      continue;
    }

    const separator =
      line.indexOf(":");

    if (separator === -1) {
      continue;
    }

    const key =
      line
        .slice(0, separator)
        .trim();

    const value =
      line
        .slice(separator + 1)
        .trim();

    if (key) {
      result[key] = value;
    }
  }

  return result;
}

function parseMonth(
  value: string | undefined,
) {
  const months:
    Record<string, number> = {
      january: 1,
      february: 2,
      march: 3,
      april: 4,
      may: 5,
      june: 6,
      july: 7,
      august: 8,
      september: 9,
      october: 10,
      november: 11,
      december: 12,
    };

  return value
    ? months[
        value
          .trim()
          .toLowerCase()
      ] ?? null
    : null;
}

async function getImageOrientation(
  imagePath: string,
): Promise<GalleryOrientation> {
  const metadata =
    await sharp(
      imagePath,
      {
        failOn: "none",
      },
    ).metadata();

  const width =
    metadata.width ?? 0;

  const height =
    metadata.height ?? 0;

  if (!width || !height) {
    return "landscape";
  }

  const ratio =
    width / height;

  if (ratio > 1.08) {
    return "landscape";
  }

  if (ratio < 0.92) {
    return "portrait";
  }

  return "square";
}

function metadataCredits(
  metadata:
    Record<string, string>,
): CuratedCredit[] {
  const fields = [
    ["Director", "Director"],
    [
      "Associate Director",
      "Associate Director",
    ],
    [
      "Musical Director",
      "Musical Director",
    ],
    [
      "Choreographer",
      "Choreographer",
    ],
    [
      "Movement Director",
      "Movement Director",
    ],
    [
      "Lighting Design",
      "Lighting Design",
    ],
    [
      "Set Design",
      "Set Design",
    ],
    [
      "Costume Design",
      "Costume Design",
    ],
    [
      "Set & Costume Design",
      "Set & Costume Design",
    ],
    [
      "Sound Design",
      "Sound Design",
    ],
    [
      "Commissioned by",
      "Commissioned by",
    ],
  ] as const;

  return fields.flatMap(
    ([key, role]) => {
      const name =
        metadata[key]?.trim();

      return name
        ? [{ role, name }]
        : [];
    },
  );
}

async function readJsonFile<T>(
  filePath: string,
  fallback: T,
): Promise<T> {
  try {
    return JSON.parse(
      await fs.readFile(
        filePath,
        "utf8",
      ),
    ) as T;
  } catch {
    return fallback;
  }
}

async function loadMetadata(
  production: string,
  entries:
    Array<
      import("node:fs").Dirent
    >,
) {
  const wanted =
    normaliseProductionName(
      production,
    );

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const directory =
      path.join(
        CURATION_ROOT,
        entry.name,
      );

    try {
      const research =
        JSON.parse(
          await fs.readFile(
            path.join(
              directory,
              "metadata-research.json",
            ),
            "utf8",
          ),
        ) as {
          production?: unknown;
        };

      if (
        typeof research.production !==
          "string" ||
        normaliseProductionName(
          research.production,
        ) !== wanted
      ) {
        continue;
      }

      return parseMetadata(
        await fs.readFile(
          path.join(
            directory,
            "metadata-proposed.txt",
          ),
          "utf8",
        ),
      );
    } catch {
      continue;
    }
  }

  return {};
}

async function findExistingSlug(
  title: string,
) {
  if (!title.trim()) {
    return null;
  }

  const slug =
    createProductionSlug(
      title,
    );

  const productions =
    await getProductions();

  return productions.some(
    (production) =>
      production.slug === slug,
  )
    ? slug
    : null;
}

export async function prepareCuratedProduction(
  requestedFolder: string,
): Promise<
  PreparedCuratedProduction | null
> {
  const folderName =
    requestedFolder.trim();

  if (!folderName) {
    return null;
  }

  const entries =
    await fs.readdir(
      CURATION_ROOT,
      {
        withFileTypes: true,
      },
    );

  const exclusionsText =
    await fs.readFile(
      EXCLUSION_PATH,
      "utf8",
    ).catch(() => "");

  const exclusions =
    new Set(
      exclusionsText
        .split(/\r?\n/)
        .map((value) =>
          normaliseProductionName(
            value.trim(),
          ),
        )
        .filter(Boolean),
    );

  const [
    accessOverrides,
    curatedOverrides,
  ] = await Promise.all([
    getCuratedArchiveAccessOverrides(),
    getCuratedArchiveOverrides(),
  ]);

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const directory =
      path.join(
        CURATION_ROOT,
        entry.name,
      );

    let finalSelection:
      | {
          production?: unknown;
          hero?: unknown;
          images?: Array<{
            sequence?: unknown;
            index?: unknown;
            hero?: unknown;
            stagedFile?: unknown;
            sourceName?: unknown;
            alt?: unknown;
          }>;
        }
      | null = null;

    try {
      finalSelection =
        JSON.parse(
          await fs.readFile(
            path.join(
              directory,
              "final-selection.json",
            ),
            "utf8",
          ),
        );
    } catch {
      continue;
    }

    if (
      entry.name !== folderName ||
      !finalSelection ||
      typeof finalSelection.production !==
        "string"
    ) {
      continue;
    }

    const production =
      finalSelection.production.trim();

    const metadata =
      await loadMetadata(
        production,
        entries,
      );

    const override =
      curatedOverrides[
        production
      ] ?? {};

    const title =
      override.title ??
      metadata.Production?.trim() ??
      "";

    const venue =
      override.venue ??
      metadata.Venue?.trim() ??
      "";

    const month =
      override.month ??
      parseMonth(
        metadata.Month,
      );

    const metadataYear =
      Number.parseInt(
        metadata.Year || "",
        10,
      );

    const year =
      override.year ??
      (
        Number.isInteger(
          metadataYear,
        )
          ? metadataYear
          : null
      );

    const description =
      override.description ??
      metadata.Description?.trim() ??
      "";

    const credits =
      override.credits ??
      metadataCredits(
        metadata,
      );

    const sourceImages =
      Array.isArray(
        finalSelection.images,
      )
        ? finalSelection.images
        : [];

    const validSourceImages =
      sourceImages.flatMap(
        (image) => {
          if (
            typeof image.index !==
              "number" ||
            typeof image.stagedFile !==
              "string"
          ) {
            return [];
          }

          return [
            {
              index:
                image.index,
              stagedFile:
                image.stagedFile,
              sourceName:
                typeof image.sourceName ===
                  "string"
                  ? image.sourceName
                  : image.stagedFile,
              alt:
                typeof image.alt === "string" &&
                image.alt.trim()
                  ? image.alt.trim()
                  : undefined,
              sourceHero:
                image.hero === true,
            },
          ];
        },
      );

    const sourceByIndex =
      new Map(
        validSourceImages.map(
          (image) => [
            image.index,
            image,
          ],
        ),
      );

    const imageOverride =
      override.images;

    const selectedIndexes =
      imageOverride
        ?.selectedIndexes ??
      validSourceImages.map(
        (image) =>
          image.index,
      );

    const heroIndex =
      imageOverride?.heroIndex ??
      validSourceImages.find(
        (image) =>
          image.sourceHero,
      )?.index ??
      (
        typeof finalSelection.hero ===
          "number"
          ? finalSelection.hero
          : null
      );

    const stagedDirectory =
      path.join(
        directory,
        "selected-web-staging",
      );

    const invalidIndexes =
      selectedIndexes.filter(
        (index) =>
          !sourceByIndex.has(index),
      );

    const resolvedStagedDirectory =
      path.resolve(
        stagedDirectory,
      );

    const images:
      SourceImage[] =
      selectedIndexes.flatMap(
        (index, position) => {
          const source =
            sourceByIndex.get(
              index,
            );

          if (!source) {
            return [];
          }

          const absolutePath =
            path.resolve(
              stagedDirectory,
              source.stagedFile,
            );

          return [
            {
              sequence:
                position + 1,
              index,
              hero:
                index ===
                heroIndex,
              stagedFile:
                source.stagedFile,
              sourceName:
                source.sourceName,
              absolutePath,
              alt: source.alt,
            },
          ];
        },
      );

    const unsafeImages =
      images.filter(
        (image) =>
          !image.absolutePath.startsWith(
            `${resolvedStagedDirectory}${path.sep}`,
          ),
      );

    const issues:
      string[] = [];

    if (unsafeImages.length > 0) {
      issues.push(
        `${unsafeImages.length} selected image path${unsafeImages.length === 1 ? "" : "s"} fall outside the staging directory.`,
      );
    }

    if (!title) {
      issues.push(
        "Production title is missing.",
      );
    }

    if (!venue) {
      issues.push(
        "Venue is missing.",
      );
    }

    if (
      !month ||
      month < 1 ||
      month > 12
    ) {
      issues.push(
        "Month is missing or invalid.",
      );
    }

    if (
      year === null ||
      !Number.isInteger(year) ||
      year < 1800 ||
      year > 2200
    ) {
      issues.push(
        "Year is missing or invalid.",
      );
    }

    if (!description) {
      issues.push(
        "Description is missing.",
      );
    }

    if (
      images.length === 0
    ) {
      issues.push(
        "Final selection contains no images.",
      );
    }

    if (
      invalidIndexes.length > 0
    ) {
      issues.push(
        `${invalidIndexes.length} image override index(es) are not present in the curator source.`,
      );
    }

    if (
      heroIndex === null ||
      !selectedIndexes.includes(
        heroIndex,
      )
    ) {
      issues.push(
        "Final hero is not part of the selected images.",
      );
    }

    for (const image of images) {
      try {
        const stat =
          await fs.stat(
            image.absolutePath,
          );

        if (!stat.isFile()) {
          issues.push(
            `Staged image "${image.stagedFile}" is missing.`,
          );
        }
      } catch {
        issues.push(
          `Staged image "${image.stagedFile}" is missing.`,
        );
      }
    }

    const existingSlug =
      await findExistingSlug(
        title,
      );

    const excluded =
      exclusions.has(
        normaliseProductionName(
          production,
        ),
      );

    const normalisedProduction =
      normaliseProductionName(
        production,
      );

    const accessOverrideEntry =
      Object.entries(
        accessOverrides,
      ).find(
        ([name]) =>
          normaliseProductionName(
            name,
          ) ===
          normalisedProduction,
      )?.[1];

    const thumbnailCatalogue =
      await readJsonFile<
        Array<{
          sourcePath?: unknown;
        }>
      >(
        path.join(
          directory,
          "thumbnail-catalogue.json",
        ),
        [],
      );

    const sourcePaths =
      thumbnailCatalogue
        .flatMap(
          (item) =>
            typeof item.sourcePath ===
            "string"
              ? [item.sourcePath]
              : [],
        );

    const schoolIdentity =
      [
        entry.name,
        production,
        title,
        venue,
        ...sourcePaths,
      ].join(" ");

    const locked =
      accessOverrideEntry ===
        "password" ||
      (
        accessOverrideEntry !==
          "public" &&
        /school/i.test(
          schoolIdentity,
        ) &&
        !/guildford[ -]school[ -]of[ -]acting/i.test(
          schoolIdentity,
        ) &&
        !/guildhall[ -]school[ -]of[ -]music[ -]and[ -]drama/i.test(
          schoolIdentity,
        ) &&
        !/london[ -]school[ -]of[ -]musical[ -]theatre/i.test(
          schoolIdentity,
        )
      );

    const status =
      excluded
        ? "excluded"
        : existingSlug
          ? "existing"
          : issues.length > 0
            ? "attention"
            : "ready";

    const slug =
      createProductionSlug(
        title,
      );

    const hero =
      images.find(
        (image) =>
          image.hero,
      );

    const gallery =
      images.filter(
        (image) =>
          !image.hero,
      );

    const totalPublishedImages =
      gallery.length + 1;

    const heroAlt =
      hero?.alt?.trim() ||
      `${title} at ${venue} — production hero photograph`;

    const preparedGallery =
      await Promise.all(
        gallery.map(
          async (
            image,
            index,
          ) => {
            const orientation =
              await getImageOrientation(
                image.absolutePath,
              );

            return {
              filepath:
                image.stagedFile,
              filename:
                image.sourceName,
              alt:
                image.alt?.trim() ||
                `${title} at ${venue} — production photograph ${index + 2} of ${totalPublishedImages}`,
              layout:
                getDeterministicGalleryLayout(
                  orientation,
                  index,
                ),
            };
          },
        ),
      );

    const payload:
      PublishPayload | null =
      status === "ready" &&
      hero &&
      month !== null &&
      year !== null
        ? {
            slug,
            title,
            venue,
            month,
            year,
            description,
            access:
              locked
                ? "password"
                : "public",
            hero: {
              filepath:
                hero.stagedFile,
              filename:
                hero.sourceName,
              alt:
                heroAlt,
            },
            credits,
            images:
              preparedGallery,
          }
        : null;

    return {
      production,
      folder:
        entry.name,
      status,
      access:
        locked
          ? "password"
          : "public",
      issues,
      existingSlug,
      stagedDirectory,
      payload,
      images,
    };
  }

  return null;
}
