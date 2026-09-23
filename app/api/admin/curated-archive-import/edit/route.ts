import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  rememberDirectoryCredits,
} from "@/lib/directory-writer";

import {
  materializeCuratedImport,
  readCuratedImportDirectFile,
} from "@/lib/curated-archive/staging";

import fs from "node:fs/promises";
import path from "node:path";
import {
  getCuratedArchiveOverrides,
  setCuratedArchiveOverride,
  type CuratedArchiveImageEditSettings,
  type CuratedArchiveOverride,
} from "@/lib/curated-archive-overrides-repository";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CuratedCredit = {
  role: string;
  name: string;
  website?: string;
};

type CuratedOverride =
  CuratedArchiveOverride;

type EditPayload = {
  production?: unknown;
  title?: unknown;
  venue?: unknown;
  month?: unknown;
  year?: unknown;
  description?: unknown;
  credits?: unknown;
};

type MetadataMap =
  Record<string, string>;

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

async function loadMetadataForProduction(
  production: string,
  entries: Array<
    import("node:fs").Dirent
  >,
  curationRoot: string,
) {
  const key =
    normaliseProductionName(
      production,
    );

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const directory =
      path.join(
        curationRoot,
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
        ) !== key
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

function parseMetadata(
  text: string,
): MetadataMap {
  const result: MetadataMap = {};

  for (const line of text.split(/\r?\n/)) {
    const separator =
      line.indexOf(":");

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

function parseMonth(
  value: string | undefined,
) {
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

  return value
    ? months[
        value.trim().toLowerCase()
      ] ?? null
    : null;
}

function metadataCredits(
  metadata: MetadataMap,
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
        ? [{ role, name }]
        : [];
    },
  );
}

async function loadCuratedProduction(
  production: string,
  curationRoot: string,
  requestedFolder?: string,
) {
  const entries =
    await fs.readdir(
      curationRoot,
      {
        withFileTypes: true,
      },
    );

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (
      requestedFolder &&
      entry.name !== requestedFolder
    ) {
      continue;
    }

    const directory =
      path.join(
        curationRoot,
        entry.name,
      );

    try {
      const finalSelection =
        JSON.parse(
          await fs.readFile(
            path.join(
              directory,
              "final-selection.json",
            ),
            "utf8",
          ),
        ) as {
          production?: unknown;
          hero?: unknown;
          images?: Array<{
            sequence?: unknown;
            index?: unknown;
            hero?: unknown;
            stagedFile?: unknown;
            sourceName?: unknown;
          }>;
        };

      if (
        typeof finalSelection.production !==
          "string" ||
        (production &&
          finalSelection.production.trim() !==
            production)
      ) {
        continue;
      }

      const resolvedProduction =
        finalSelection.production.trim();

      let metadata: MetadataMap = {};

      try {
        const localResearch = JSON.parse(
          await fs.readFile(
            path.join(directory, "metadata-research.json"),
            "utf8",
          ),
        ) as { production?: unknown };

        if (
          typeof localResearch.production === "string" &&
          normaliseProductionName(localResearch.production) ===
            normaliseProductionName(resolvedProduction)
        ) {
          metadata = parseMetadata(
            await fs.readFile(
              path.join(directory, "metadata-proposed.txt"),
              "utf8",
            ),
          );
        }
      } catch {}

      if (Object.keys(metadata).length === 0) {
        metadata = await loadMetadataForProduction(
          resolvedProduction,
          entries,
          curationRoot,
        );
      }

      const overrides =
        await getCuratedArchiveOverrides();

      const override =
        overrides[resolvedProduction];

      const metadataYear =
        Number.parseInt(
          metadata.Year || "",
          10,
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
              typeof image.stagedFile !==
                "string" ||
              typeof image.index !==
                "number"
            ) {
              return [];
            }

            return [
              {
                sequence:
                  typeof image.sequence ===
                  "number"
                    ? image.sequence
                    : null,
                index: image.index,
                hero:
                  image.hero === true,
                stagedFile:
                  image.stagedFile,
                sourceName:
                  typeof image.sourceName ===
                  "string"
                    ? image.sourceName
                    : image.stagedFile,
              },
            ];
          },
        );

      const imageOverride =
        override?.images;

      const sourceImageByIndex =
        new Map(
          validSourceImages.map(
            (image) => [
              image.index,
              image,
            ],
          ),
        );

      const selectedIndexes =
        imageOverride?.selectedIndexes ??
        validSourceImages.map(
          (image) =>
            image.index,
        );

      const effectiveImages =
        selectedIndexes.flatMap(
          (index, position) => {
            const image =
              sourceImageByIndex.get(
                index,
              );

            if (!image) {
              return [];
            }

            const heroIndex =
              imageOverride?.heroIndex ??
              (
                validSourceImages.find(
                  (candidate) =>
                    candidate.hero,
                )?.index ??
                (
                  typeof finalSelection.hero ===
                  "number"
                    ? finalSelection.hero
                    : null
                )
              );

            return [
              {
                ...image,
                sequence:
                  position + 1,
                hero:
                  image.index ===
                  heroIndex,
                editSettings:
                  imageOverride?.edits?.[String(image.index)],
              },
            ];
          },
        );

      const effectiveHeroIndex =
        effectiveImages.find(
          (image) =>
            image.hero,
        )?.index ?? null;

      return {
        production: resolvedProduction,
        folder: entry.name,
        title:
          override?.title ??
          metadata.Production?.trim() ??
          "",
        venue:
          override?.venue ??
          metadata.Venue?.trim() ??
          "",
        month:
          override?.month ??
          parseMonth(
            metadata.Month,
          ),
        year:
          override?.year ??
          (
            Number.isInteger(
              metadataYear,
            )
              ? metadataYear
              : null
          ),
        description:
          override?.description ??
          metadata.Description?.trim() ??
          "",
        credits:
          override?.credits ??
          metadataCredits(
            metadata,
          ),
        edited:
          Boolean(override),
        metadataEdited:
          Boolean(
            override &&
              (
                override.title !==
                  undefined ||
                override.venue !==
                  undefined ||
                override.month !==
                  undefined ||
                override.year !==
                  undefined ||
                override.description !==
                  undefined ||
                override.credits !==
                  undefined
              ),
          ),
        heroIndex:
          effectiveHeroIndex,
        selectedCount:
          effectiveImages.length,
        images:
          effectiveImages,
        imageEdited:
          Boolean(
            override?.images,
          ),
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function curatedProductionExists(
  production: string,
  curationRoot: string,
) {
  const entries =
    await fs.readdir(
      curationRoot,
      {
        withFileTypes: true,
      },
    );

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    try {
      const finalSelection =
        JSON.parse(
          await fs.readFile(
            path.join(
              curationRoot,
              entry.name,
              "final-selection.json",
            ),
            "utf8",
          ),
        ) as {
          production?: unknown;
        };

      if (
        typeof finalSelection.production ===
          "string" &&
        finalSelection.production.trim() ===
          production
      ) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

async function loadDirectCuratedProduction(
  folder: string,
) {
  try {
    const finalSelection =
      JSON.parse(
        (
          await readCuratedImportDirectFile(
            `${folder}/final-selection.json`,
          )
        ).toString("utf8"),
      ) as {
        production?: unknown;
        hero?: unknown;
        images?: Array<{
          sequence?: unknown;
          index?: unknown;
          hero?: unknown;
          stagedFile?: unknown;
          sourceName?: unknown;
        }>;
      };

    if (
      typeof finalSelection.production !==
      "string"
    ) {
      return null;
    }

    const resolvedProduction =
      finalSelection.production.trim();

    let metadata: MetadataMap = {};

    try {
      metadata = parseMetadata(
        (
          await readCuratedImportDirectFile(
            `${folder}/metadata-proposed.txt`,
          )
        ).toString("utf8"),
      );
    } catch {}

    const overrides =
      await getCuratedArchiveOverrides();

    const override =
      overrides[resolvedProduction];

    const metadataYear =
      Number.parseInt(
        metadata.Year || "",
        10,
      );

    const validSourceImages =
      (
        Array.isArray(finalSelection.images)
          ? finalSelection.images
          : []
      ).flatMap((image) => {
        if (
          typeof image.stagedFile !== "string" ||
          typeof image.index !== "number"
        ) {
          return [];
        }

        return [{
          sequence:
            typeof image.sequence === "number"
              ? image.sequence
              : null,
          index: image.index,
          hero: image.hero === true,
          stagedFile: image.stagedFile,
          sourceName:
            typeof image.sourceName === "string"
              ? image.sourceName
              : image.stagedFile,
        }];
      });

    const imageOverride =
      override?.images;

    const sourceImageByIndex =
      new Map(
        validSourceImages.map(
          (image) => [image.index, image],
        ),
      );

    const selectedIndexes =
      imageOverride?.selectedIndexes ??
      validSourceImages.map(
        (image) => image.index,
      );

    const heroIndex =
      imageOverride?.heroIndex ??
      (
        validSourceImages.find(
          (image) => image.hero,
        )?.index ??
        (
          typeof finalSelection.hero === "number"
            ? finalSelection.hero
            : null
        )
      );

    const effectiveImages =
      selectedIndexes.flatMap(
        (index, position) => {
          const image =
            sourceImageByIndex.get(index);

          if (!image) {
            return [];
          }

          return [{
            ...image,
            sequence: position + 1,
            hero: image.index === heroIndex,
          }];
        },
      );

    const effectiveHeroIndex =
      effectiveImages.find(
        (image) => image.hero,
      )?.index ?? null;

    return {
      production: resolvedProduction,
      folder,
      title:
        override?.title ??
        metadata.Production?.trim() ??
        "",
      venue:
        override?.venue ??
        metadata.Venue?.trim() ??
        "",
      month:
        override?.month ??
        parseMonth(metadata.Month),
      year:
        override?.year ??
        (
          Number.isInteger(metadataYear)
            ? metadataYear
            : null
        ),
      description:
        override?.description ??
        metadata.Description?.trim() ??
        "",
      credits:
        override?.credits ??
        metadataCredits(metadata),
      edited: Boolean(override),
      metadataEdited: Boolean(
        override &&
          (
            override.title !== undefined ||
            override.venue !== undefined ||
            override.month !== undefined ||
            override.year !== undefined ||
            override.description !== undefined ||
            override.credits !== undefined
          )
      ),
      imageEdited:
        Boolean(override?.images),
      heroIndex: effectiveHeroIndex,
      images: effectiveImages,
    };
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  const url =
    new URL(request.url);

  const production =
    url.searchParams
      .get("production")
      ?.trim() ?? "";

  const folder =
    url.searchParams
      .get("folder")
      ?.trim() ?? "";

  if (!production && !folder) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Curated folder or production is required.",
      },
      {
        status: 400,
      },
    );
  }

  let curated =
    folder
      ? await loadDirectCuratedProduction(
          folder,
        )
      : null;

  if (!curated) {
    const curationRoot =
      await materializeCuratedImport();

    if (!curationRoot) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Choose a curated folder before using Curated Archive Import.",
        },
        { status: 409 },
      );
    }

    curated =
      await loadCuratedProduction(
        production,
        curationRoot,
        folder || undefined,
      );
  }

  if (!curated) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Curated production was not found.",
      },
      {
        status: 404,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    production: curated,
  });
}

export async function DELETE(
  request: Request,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  const curationRoot =
    await materializeCuratedImport();

  if (!curationRoot) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Choose a curated folder before using Curated Archive Import.",
      },
      { status: 409 },
    );
  }

  const url =
    new URL(request.url);

  const production =
    url.searchParams
      .get("production")
      ?.trim() ?? "";

  if (!production) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Production is required.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !(await curatedProductionExists(
      production,
      curationRoot,
    ))
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Curated production was not found.",
      },
      {
        status: 404,
      },
    );
  }

  const overrides =
    await getCuratedArchiveOverrides();

  const existingOverride =
    overrides[production];

  const hadMetadataOverride =
    Boolean(
      existingOverride &&
        (
          existingOverride.title !==
            undefined ||
          existingOverride.venue !==
            undefined ||
          existingOverride.month !==
            undefined ||
          existingOverride.year !==
            undefined ||
          existingOverride.description !==
            undefined ||
          existingOverride.credits !==
            undefined
        ),
    );

  if (
    existingOverride &&
    hadMetadataOverride
  ) {
    const {
      title: _title,
      venue: _venue,
      month: _month,
      year: _year,
      description: _description,
      credits: _credits,
      ...remainingOverride
    } = existingOverride;

    if (
      Object.keys(
        remainingOverride,
      ).length > 0
    ) {
      overrides[production] =
        remainingOverride;
    } else {
      delete overrides[production];
    }

    await setCuratedArchiveOverride(
      production,
      overrides[production] ?? null,
    );
  }

  return NextResponse.json({
    ok: true,
    production,
    reset: hadMetadataOverride,
  });
}

export async function PATCH(
  request: Request,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  const curationRoot =
    await materializeCuratedImport();

  if (!curationRoot) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Choose a curated folder before using Curated Archive Import.",
      },
      { status: 409 },
    );
  }

  let body: {
    production?: unknown;
    reset?: unknown;
  };

  try {
    body =
      (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid request.",
      },
      {
        status: 400,
      },
    );
  }

  const production =
    typeof body.production === "string"
      ? body.production.trim()
      : "";

  if (
    !production ||
    body.reset !== "images"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Invalid image reset request.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !(await curatedProductionExists(
      production,
      curationRoot,
    ))
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Curated production was not found.",
      },
      {
        status: 404,
      },
    );
  }

  const overrides =
    await getCuratedArchiveOverrides();

  const existingOverride =
    overrides[production];

  const hadImageOverride =
    Boolean(
      existingOverride?.images,
    );

  if (
    existingOverride &&
    hadImageOverride
  ) {
    const {
      images: _images,
      ...remainingOverride
    } = existingOverride;

    if (
      Object.keys(
        remainingOverride,
      ).length > 0
    ) {
      overrides[production] =
        remainingOverride;
    } else {
      delete overrides[production];
    }

    await setCuratedArchiveOverride(
      production,
      overrides[production] ?? null,
    );
  }

  return NextResponse.json({
    ok: true,
    production,
    reset: hadImageOverride,
  });
}

export async function PUT(
  request: Request,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  const curationRoot =
    await materializeCuratedImport();

  if (!curationRoot) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Choose a curated folder before using Curated Archive Import.",
      },
      { status: 409 },
    );
  }

  let body: {
    production?: unknown;
    heroIndex?: unknown;
    selectedIndexes?: unknown;
    imageEdits?: unknown;
  };

  try {
    body =
      (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Invalid request.",
      },
      {
        status: 400,
      },
    );
  }

  const production =
    typeof body.production === "string"
      ? body.production.trim()
      : "";

  const heroIndex =
    Number(body.heroIndex);

  const selectedIndexes =
    Array.isArray(
      body.selectedIndexes,
    )
      ? body.selectedIndexes.map(
          (value) =>
            Number(value),
        )
      : [];

  const rawImageEdits =
    body.imageEdits &&
    typeof body.imageEdits === "object" &&
    !Array.isArray(body.imageEdits)
      ? body.imageEdits as Record<string, unknown>
      : {};

  const validAspects =
    new Set([
      "original",
      "3:2",
      "4:5",
      "1:1",
      "16:9",
    ]);

  const imageEdits:
    Record<string, CuratedArchiveImageEditSettings> = {};

  for (const [key, value] of Object.entries(rawImageEdits)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return NextResponse.json(
        { ok: false, message: "Image edit settings are invalid." },
        { status: 400 },
      );
    }

    const candidate = value as Record<string, unknown>;
    const aspect = candidate.aspect;
    const zoom = Number(candidate.zoom);
    const panX = Number(candidate.panX);
    const panY = Number(candidate.panY);
    const brightness = Number(candidate.brightness);
    const autoStrength = Number(candidate.autoStrength);

    if (
      typeof aspect !== "string" ||
      !validAspects.has(aspect) ||
      !Number.isFinite(zoom) || zoom < 1 || zoom > 4 ||
      !Number.isFinite(panX) || panX < -1 || panX > 1 ||
      !Number.isFinite(panY) || panY < -1 || panY > 1 ||
      !Number.isFinite(brightness) || brightness < 50 || brightness > 150 ||
      !Number.isFinite(autoStrength) || autoStrength < 0 || autoStrength > 100
    ) {
      return NextResponse.json(
        { ok: false, message: "Image edit settings are invalid." },
        { status: 400 },
      );
    }

    imageEdits[key] = {
      aspect: aspect as CuratedArchiveImageEditSettings["aspect"],
      zoom,
      panX,
      panY,
      brightness,
      autoStrength,
    };
  }

  if (!production) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Production is required.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !Number.isInteger(
      heroIndex,
    ) ||
    selectedIndexes.length === 0 ||
    selectedIndexes.some(
      (index) =>
        !Number.isInteger(
          index,
        ),
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Image selection is invalid.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    new Set(
      selectedIndexes,
    ).size !==
    selectedIndexes.length
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Image selection contains duplicates.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !selectedIndexes.includes(
      heroIndex,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The hero must remain in the selected images.",
      },
      {
        status: 400,
      },
    );
  }

  const entries =
    await fs.readdir(
      curationRoot,
      {
        withFileTypes: true,
      },
    );

  let allowedIndexes:
    Set<number> | null = null;

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    try {
      const finalSelection =
        JSON.parse(
          await fs.readFile(
            path.join(
              curationRoot,
              entry.name,
              "final-selection.json",
            ),
            "utf8",
          ),
        ) as {
          production?: unknown;
          images?: Array<{
            index?: unknown;
          }>;
        };

      if (
        typeof finalSelection.production !==
          "string" ||
        (production &&
          finalSelection.production.trim() !==
            production)
      ) {
        continue;
      }

      allowedIndexes =
        new Set(
          (
            Array.isArray(
              finalSelection.images,
            )
              ? finalSelection.images
              : []
          ).flatMap(
            (image) =>
              typeof image.index ===
              "number"
                ? [image.index]
                : [],
          ),
        );

      break;
    } catch {
      continue;
    }
  }

  if (!allowedIndexes) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Curated production was not found.",
      },
      {
        status: 404,
      },
    );
  }

  const editedIndexes =
    Object.keys(imageEdits).map(
      (value) => Number(value),
    );

  if (
    selectedIndexes.some(
      (index) =>
        !allowedIndexes?.has(
          index,
        ),
    ) ||
    !allowedIndexes.has(
      heroIndex,
    ) ||
    editedIndexes.some(
      (index) =>
        !Number.isInteger(index) ||
        !selectedIndexes.includes(index) ||
        !allowedIndexes?.has(index),
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Image selection contains an image outside the curated source.",
      },
      {
        status: 400,
      },
    );
  }

  const overrides =
    await getCuratedArchiveOverrides();

  const existingOverride =
    overrides[production] ?? {};

  overrides[production] = {
    ...existingOverride,
    images: {
      heroIndex,
      selectedIndexes,
      ...(Object.keys(imageEdits).length > 0
        ? { edits: imageEdits }
        : {}),
    },
  };

  await setCuratedArchiveOverride(
    production,
    overrides[production] ?? null,
  );

  return NextResponse.json({
    ok: true,
    production,
    images:
      overrides[production]
        .images,
  });
}

export async function POST(
  request: Request,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  const curationRoot =
    await materializeCuratedImport();

  if (!curationRoot) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Choose a curated folder before using Curated Archive Import.",
      },
      { status: 409 },
    );
  }

  let body: EditPayload;

  try {
    body =
      (await request.json()) as EditPayload;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid request.",
      },
      {
        status: 400,
      },
    );
  }

  const production =
    typeof body.production === "string"
      ? body.production.trim()
      : "";

  const title =
    typeof body.title === "string"
      ? body.title.trim()
      : "";

  const venue =
    typeof body.venue === "string"
      ? body.venue.trim()
      : "";

  const description =
    typeof body.description === "string"
      ? body.description.trim()
      : "";

  const month = Number(body.month);
  const year = Number(body.year);

  if (!production) {
    return NextResponse.json(
      {
        ok: false,
        message: "Production is required.",
      },
      {
        status: 400,
      },
    );
  }

  if (!title) {
    return NextResponse.json(
      {
        ok: false,
        message: "A production title is required.",
      },
      {
        status: 400,
      },
    );
  }

  if (!venue) {
    return NextResponse.json(
      {
        ok: false,
        message: "A venue is required.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "A valid month is required.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !Number.isInteger(year) ||
    year < 1900 ||
    year > 2100
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "A valid year is required.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !Array.isArray(body.credits)
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "Credits are invalid.",
      },
      {
        status: 400,
      },
    );
  }

  const credits: CuratedCredit[] =
    [];

  for (const value of body.credits) {
    if (
      !value ||
      typeof value !== "object"
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "Credits are invalid.",
        },
        {
          status: 400,
        },
      );
    }

    const credit =
      value as {
        role?: unknown;
        name?: unknown;
        website?: unknown;
      };

    const role =
      typeof credit.role === "string"
        ? credit.role.trim()
        : "";

    const name =
      typeof credit.name === "string"
        ? credit.name.trim()
        : "";

    const website =
      typeof credit.website === "string"
        ? credit.website.trim()
        : "";

    if (!role || !name) {
      continue;
    }

    credits.push({
      role,
      name,
      ...(website
        ? {
            website,
          }
        : {}),
    });
  }

  if (
    !(await curatedProductionExists(
      production,
      curationRoot,
    ))
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Curated production was not found.",
      },
      {
        status: 404,
      },
    );
  }

  const overrides =
    await getCuratedArchiveOverrides();

  const existingOverride =
    overrides[production] ?? {};

  overrides[production] = {
    ...existingOverride,
    title,
    venue,
    month,
    year,
    description,
    credits,
  };

  await setCuratedArchiveOverride(
    production,
    overrides[production] ?? null,
  );

  let directorySync:
    Awaited<
      ReturnType<
        typeof rememberDirectoryCredits
      >
    > | null = null;

  let directoryWarning:
    string | null = null;

  try {
    directorySync =
      await rememberDirectoryCredits(
        credits,
      );
  } catch (directoryError) {
    console.error(
      "Directory sync failed:",
      directoryError,
    );

    directoryWarning =
      directoryError instanceof Error
        ? directoryError.message
        : "The global website directory could not be updated.";
  }

  return NextResponse.json({
    ok: true,
    production,
    override:
      overrides[production],
    directorySync,
    directoryWarning,
  });
}
