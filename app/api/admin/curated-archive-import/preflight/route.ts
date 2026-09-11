import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import {
  getProductions,
} from "@/lib/productions-repository";
import {
  getCuratedArchiveAccessOverrides,
  getCuratedArchiveOverrides,
} from "@/lib/curated-archive-overrides-repository";

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ARCHIVE_ROOT = path.join(
  os.homedir(),
  "Downloads",
  "Archive Download",
);

const CURATION_ROOT = path.join(
  ARCHIVE_ROOT,
  "Automated Curation",
);

const EXCLUSION_PATH = path.resolve(
  "scripts/archive-curator/excluded-productions.txt",
);

function normaliseProductionName(value: string) {
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

function parseMetadata(text: string) {
  const result: Record<string, string> = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const separator = line.indexOf(":");

    if (separator === -1) {
      continue;
    }

    const key =
      line.slice(0, separator).trim();

    const value =
      line.slice(separator + 1).trim();

    if (key) {
      result[key] = value;
    }
  }

  return result;
}

async function readExclusions() {
  try {
    const text =
      await fs.readFile(
        EXCLUSION_PATH,
        "utf8",
      );

    return new Set(
      text
        .split(/\r?\n/)
        .map((value) =>
          normaliseProductionName(
            value.trim(),
          ),
        )
        .filter(Boolean),
    );
  } catch {
    return new Set<string>();
  }
}

type CuratedCredit = {
  role: string;
  name: string;
  website?: string;
};

type CuratedImageOverride = {
  heroIndex: number;
  selectedIndexes: number[];
};

type CuratedOverride = {
  title?: string;
  venue?: string;
  month?: number;
  year?: number;
  description?: string;
  credits?: CuratedCredit[];
  images?: CuratedImageOverride;
};

function metadataCredits(
  metadata: Record<string, string>,
): CuratedCredit[] {
  const fields = [
    ["Director", "Director"],
    ["Associate Director", "Associate Director"],
    ["Musical Director", "Musical Director"],
    ["Choreographer", "Choreographer"],
    ["Movement Director", "Movement Director"],
    ["Lighting Design", "Lighting Design"],
    ["Set Design", "Set Design"],
    ["Costume Design", "Costume Design"],
    ["Set & Costume Design", "Set & Costume Design"],
    ["Sound Design", "Sound Design"],
    ["Commissioned by", "Commissioned by"],
  ] as const;

  return fields.flatMap(
    ([key, role]) => {
      const name =
        metadata[key]?.trim();

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
}

function parseMonth(value: string | undefined) {
  if (!value) {
    return null;
  }

  const months: Record<string, number> = {
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

  return months[value.trim().toLowerCase()] ?? null;
}

export async function GET(
  request: Request,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  const productions =
    await getProductions();

  const exclusions =
    await readExclusions();

  const [
    accessOverridesRecord,
    curatedOverrides,
  ] = await Promise.all([
    getCuratedArchiveAccessOverrides(),
    getCuratedArchiveOverrides(),
  ]);

  const accessOverrides =
    new Map(
      Object.entries(
        accessOverridesRecord,
      ).map(
        ([production, access]) => [
          normaliseProductionName(
            production,
          ),
          access,
        ],
      ),
    );

  function findExistingSlug(
    title: string,
    month: number | null,
    year: number | null,
  ) {
    if (
      !title.trim() ||
      year === null
    ) {
      return null;
    }

    const normalisedTitle =
      normaliseProductionName(
        title,
      );

    const existing =
      productions.find(
        (production) =>
          normaliseProductionName(
            production.title,
          ) === normalisedTitle &&
          production.year === year &&
          (
            production.month ===
              undefined ||
            production.month ===
              null ||
            production.month === month
          ),
      );

    return existing?.slug ?? null;
  }

  const entries =
    await fs.readdir(
      CURATION_ROOT,
      {
        withFileTypes: true,
      },
    );

  const metadataByProduction =
    new Map<
      string,
      Record<string, string>
    >();

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const metadataResearchPath =
      path.join(
        CURATION_ROOT,
        entry.name,
        "metadata-research.json",
      );

    const metadataProposedPath =
      path.join(
        CURATION_ROOT,
        entry.name,
        "metadata-proposed.txt",
      );

    try {
      const research =
        JSON.parse(
          await fs.readFile(
            metadataResearchPath,
            "utf8",
          ),
        ) as {
          production?: unknown;
        };

      if (
        typeof research.production !==
          "string" ||
        !research.production.trim()
      ) {
        continue;
      }

      const proposed =
        parseMetadata(
          await fs.readFile(
            metadataProposedPath,
            "utf8",
          ),
        );

      metadataByProduction.set(
        normaliseProductionName(
          research.production,
        ),
        proposed,
      );
    } catch {
      continue;
    }
  }

  const results = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const directory =
      path.join(
        CURATION_ROOT,
        entry.name,
      );

    const finalSelectionPath =
      path.join(
        directory,
        "final-selection.json",
      );

    const stagingDirectory =
      path.join(
        directory,
        "selected-web-staging",
      );

    let finalSelection:
      | {
          production?: string;
          hero?: number;
          selectedCount?: number;
          images?: Array<{
            sequence?: number;
            index?: number;
            hero?: boolean;
            stagedFile?: string;
            sourceName?: string;
          }>;
        }
      | null = null;

    try {
      finalSelection =
        JSON.parse(
          await fs.readFile(
            finalSelectionPath,
            "utf8",
          ),
        );
    } catch {
      continue;
    }

    if (!finalSelection) {
      continue;
    }

    const production =
      finalSelection.production?.trim() ||
      entry.name;

    const normalisedProduction =
      normaliseProductionName(
        production,
      );

    const excluded =
      exclusions.has(
        normalisedProduction,
      );

    const accessOverride =
      accessOverrides.get(
        normalisedProduction,
      );

    const automaticLocked =
      /school/i.test(
        entry.name,
      ) &&
      !/guildford-school-of-acting/i.test(
        entry.name,
      ) &&
      !/guildhall-school-of-music-and-drama/i.test(
        entry.name,
      );

    const locked =
      accessOverride === "password" ||
      (
        accessOverride !== "public" &&
        automaticLocked
      );

    const accessSource =
      accessOverride
        ? "manual"
        : "automatic";

    const metadata =
      metadataByProduction.get(
        normalisedProduction,
      ) ?? {};

    const curatedOverride =
      curatedOverrides[production] ?? {};

    const title =
      curatedOverride.title ??
      metadata.Production?.trim() ??
      "";

    const venue =
      curatedOverride.venue ??
      metadata.Venue?.trim() ??
      "";

    const month =
      curatedOverride.month ??
      parseMonth(
        metadata.Month,
      );

    const metadataYear =
      Number.parseInt(
        metadata.Year || "",
        10,
      );

    const year =
      curatedOverride.year ??
      metadataYear;

    const description =
      curatedOverride.description ??
      metadata.Description?.trim() ??
      "";

    const credits =
      curatedOverride.credits ??
      metadataCredits(metadata);

    const sourceImages =
      Array.isArray(
        finalSelection.images,
      )
        ? finalSelection.images
        : [];

    const sourceImageByIndex =
      new Map(
        sourceImages.flatMap(
          (image) =>
            typeof image.index ===
            "number"
              ? [[image.index, image] as const]
              : [],
        ),
      );

    const imageOverride =
      curatedOverride.images;

    const requestedIndexes =
      imageOverride?.selectedIndexes ??
      sourceImages.flatMap(
        (image) =>
          typeof image.index ===
          "number"
            ? [image.index]
            : [],
      );

    const effectiveHeroIndex =
      imageOverride?.heroIndex ??
      sourceImages.find(
        (image) =>
          image.hero === true,
      )?.index ??
      finalSelection.hero ??
      null;

    const effectiveImages =
      requestedIndexes.flatMap(
        (index, position) => {
          const image =
            sourceImageByIndex.get(
              index,
            );

          if (!image) {
            return [];
          }

          return [
            {
              ...image,
              sequence:
                position + 1,
              hero:
                index ===
                effectiveHeroIndex,
            },
          ];
        },
      );

    const invalidOverrideIndexes =
      imageOverride
        ? imageOverride.selectedIndexes.filter(
            (index) =>
              !sourceImageByIndex.has(
                index,
              ),
          )
        : [];

    const heroImages =
      effectiveImages.filter(
        (image) =>
          image.hero === true,
      );

    let stagingFiles:
      Set<string> = new Set();

    try {
      stagingFiles =
        new Set(
          (
            await fs.readdir(
              stagingDirectory,
            )
          ),
        );
    } catch {}

    const expectedFiles =
      effectiveImages
        .map(
          (image) =>
            image.stagedFile,
        )
        .filter(
          (
            value,
          ): value is string =>
            typeof value === "string" &&
            Boolean(value),
        );

    const missingFiles =
      expectedFiles.filter(
        (filename) =>
          !stagingFiles.has(
            filename,
          ),
      );

    const issues: string[] = [];

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

    if (!month) {
      issues.push(
        "Month is missing or invalid.",
      );
    }

    if (
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

    if (effectiveImages.length === 0) {
      issues.push(
        "Final selection contains no images.",
      );
    }

    if (
      invalidOverrideIndexes.length > 0
    ) {
      issues.push(
        `${invalidOverrideIndexes.length} image override index(es) are not present in the curator source.`,
      );
    }

    if (
      imageOverride &&
      !imageOverride.selectedIndexes.includes(
        imageOverride.heroIndex,
      )
    ) {
      issues.push(
        "Image override hero is not part of the selected images.",
      );
    }

    if (heroImages.length !== 1) {
      issues.push(
        `Expected one hero image; found ${heroImages.length}.`,
      );
    }

    if (missingFiles.length > 0) {
      issues.push(
        `${missingFiles.length} staged image file(s) are missing.`,
      );
    }

    const existingSlug =
      findExistingSlug(
        title,
        month,
        Number.isInteger(year)
          ? year
          : null,
      );

    const status =
      excluded
        ? "excluded"
        : existingSlug
          ? "existing"
          : issues.length > 0
            ? "attention"
            : "ready";

    results.push({
      folder: entry.name,
      production,
      title,
      venue,
      month,
      year:
        Number.isInteger(year)
          ? year
          : null,
      description,
      credits,
      edited:
        Object.keys(
          curatedOverride,
        ).length > 0,
      selectedCount:
        effectiveImages.length,
      heroIndex:
        heroImages[0]?.index ??
        effectiveHeroIndex,
      excluded,
      locked,
      automaticLocked,
      accessOverride:
        accessOverride ?? null,
      accessSource,
      existingSlug,
      status,
      issues,
    });
  }

  results.sort(
    (first, second) =>
      first.production.localeCompare(
        second.production,
      ),
  );

  const summary =
    results.reduce(
      (current, result) => {
        current.total += 1;

        if (result.locked) {
          current.locked += 1;
        }

        if (
          result.status ===
          "ready"
        ) {
          current.ready += 1;
        } else if (
          result.status ===
          "excluded"
        ) {
          current.excluded += 1;
        } else if (
          result.status ===
          "existing"
        ) {
          current.existing += 1;
        } else {
          current.attention += 1;
        }

        return current;
      },
      {
        total: 0,
        ready: 0,
        excluded: 0,
        existing: 0,
        attention: 0,
        locked: 0,
      },
    );

  return Response.json({
    ok: true,
    summary,
    productions: results,
  });
}
