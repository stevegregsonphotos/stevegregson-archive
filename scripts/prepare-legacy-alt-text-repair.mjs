import fs from "node:fs/promises";
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const MANIFEST =
  "scripts/legacy-alt-text-repair-manifest.json";

const PLAN =
  "scripts/legacy-alt-text-repair-plan.json";

const EXPECTED_IMAGES = 2389;
const EXPECTED_PRODUCTIONS = 72;

function legacyGeneric(value) {
  return /\bproduction\s*photograph(?:\s+\d+\s+of\s+\d+)?\b/i
    .test(String(value ?? ""));
}

const manifest =
  JSON.parse(
    await fs.readFile(MANIFEST, "utf8"),
  );

if (
  manifest.imageCount !== EXPECTED_IMAGES ||
  manifest.productionCount !== EXPECTED_PRODUCTIONS ||
  !Array.isArray(manifest.images) ||
  manifest.images.length !== EXPECTED_IMAGES
) {
  throw new Error(
    `STOP: frozen manifest is not the expected ${EXPECTED_IMAGES}-image / ${EXPECTED_PRODUCTIONS}-production cohort.`,
  );
}

const ids =
  manifest.images.map(
    image => image.imageId,
  );

if (
  new Set(ids).size !== ids.length
) {
  throw new Error(
    "STOP: duplicate image IDs in frozen manifest.",
  );
}

const badFrozen =
  manifest.images.filter(
    image =>
      !legacyGeneric(
        image.currentAlt,
      ),
  );

if (badFrozen.length) {
  throw new Error(
    `STOP: ${badFrozen.length} frozen records no longer satisfy the legacy-alt selection rule.`,
  );
}

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not configured.",
  );
}

const sql =
  neon(databaseUrl);

const current =
  await sql`
    SELECT
      pi.id AS image_id,
      pi.production_id,
      pi.storage_key,
      pi.display_filename,
      pi.alt,
      pi.position,
      pi.analysis_status,
      pi.analysed_at,
      pi.deleted_at AS image_deleted_at,
      p.slug,
      p.title,
      p.venue,
      p.year,
      p.description,
      p.deleted_at AS production_deleted_at
    FROM production_images pi
    JOIN productions p
      ON p.id = pi.production_id
    WHERE pi.id = ANY(${ids}::uuid[])
  `;

const byId =
  new Map(
    current.map(
      row => [
        row.image_id,
        row,
      ],
    ),
  );

const missing = [];
const changed = [];
const deleted = [];
const ready = [];

for (
  const frozen
  of manifest.images
) {
  const row =
    byId.get(
      frozen.imageId,
    );

  if (!row) {
    missing.push(
      frozen.imageId,
    );
    continue;
  }

  if (
    row.image_deleted_at !== null ||
    row.production_deleted_at !== null
  ) {
    deleted.push({
      imageId:
        frozen.imageId,
      slug:
        frozen.slug,
      filename:
        frozen.filename,
    });

    continue;
  }

  if (
    String(row.alt ?? "") !==
    String(frozen.currentAlt ?? "")
  ) {
    changed.push({
      imageId:
        frozen.imageId,
      slug:
        frozen.slug,
      filename:
        frozen.filename,
      frozenAlt:
        frozen.currentAlt,
      currentAlt:
        row.alt,
    });

    continue;
  }

  if (
    !legacyGeneric(
      row.alt,
    )
  ) {
    changed.push({
      imageId:
        frozen.imageId,
      slug:
        frozen.slug,
      filename:
        frozen.filename,
      frozenAlt:
        frozen.currentAlt,
      currentAlt:
        row.alt,
      reason:
        "Current alt no longer matches legacy boilerplate rule.",
    });

    continue;
  }

  ready.push({
    imageId:
      frozen.imageId,

    productionId:
      frozen.productionId,

    slug:
      row.slug,

    title:
      row.title,

    venue:
      row.venue,

    year:
      row.year,

    description:
      row.description ?? "",

    storageKey:
      row.storage_key,

    filename:
      row.display_filename,

    position:
      row.position,

    originalAlt:
      row.alt,

    originalAnalysisStatus:
      row.analysis_status,

    originalAnalysedAt:
      row.analysed_at,

    imageUrl:
      `https://images.stevegregson.com/${
        String(row.storage_key)
          .split("/")
          .map(encodeURIComponent)
          .join("/")
      }`,
  });
}

console.log(
  "\n=== FROZEN COHORT RECONCILIATION ===",
);

console.log(
  "Manifest images:",
  manifest.images.length,
);

console.log(
  "Database rows found:",
  current.length,
);

console.log(
  "Ready:",
  ready.length,
);

console.log(
  "Missing:",
  missing.length,
);

console.log(
  "Deleted since freeze:",
  deleted.length,
);

console.log(
  "Changed since freeze:",
  changed.length,
);

if (
  missing.length ||
  deleted.length ||
  changed.length
) {
  console.log(
    "\nNo repair plan written because the frozen cohort changed.",
  );

  if (missing.length) {
    console.log(
      "\nMissing IDs:",
      missing.slice(0, 20),
    );
  }

  if (deleted.length) {
    console.log(
      "\nDeleted:",
      deleted.slice(0, 20),
    );
  }

  if (changed.length) {
    console.log(
      "\nChanged:",
      changed.slice(0, 10),
    );
  }

  process.exitCode = 1;
} else {
  const productions =
    new Map();

  for (
    const image
    of ready
  ) {
    const group =
      productions.get(
        image.slug,
      ) ?? {
        slug:
          image.slug,
        title:
          image.title,
        venue:
          image.venue,
        year:
          image.year,
        description:
          image.description,
        imageCount:
          0,
      };

    group.imageCount += 1;

    productions.set(
      image.slug,
      group,
    );
  }

  const plan = {
    version: 1,
    generatedAt:
      new Date()
        .toISOString(),

    sourceManifest:
      MANIFEST,

    purpose:
      "Generate image-specific replacement alt text for the frozen legacy Dropbox-curation cohort.",

    preservationRule:
      "Never update an image unless its ID is unchanged and its current database alt text exactly equals originalAlt.",

    validationRules: [
      "Replacement must be non-empty.",
      "Replacement must not contain legacy 'production photograph' boilerplate.",
      "Replacement must describe visible content rather than merely production metadata.",
      "Replacement should normally remain concise.",
      "No other production metadata, filenames, layouts, selections, heroes or image files may be changed.",
    ],

    imageCount:
      ready.length,

    productionCount:
      productions.size,

    productions:
      [...productions.values()],

    images:
      ready,
  };

  await fs.writeFile(
    PLAN,
    JSON.stringify(
      plan,
      null,
      2,
    ) + "\n",
  );

  console.log(
    "\n=== REPAIR PLAN ===",
  );

  console.log(
    "Images:",
    plan.imageCount,
  );

  console.log(
    "Productions:",
    plan.productionCount,
  );

  console.log(
    "File:",
    PLAN,
  );

  if (
    plan.imageCount !== EXPECTED_IMAGES ||
    plan.productionCount !== EXPECTED_PRODUCTIONS
  ) {
    throw new Error(
      "STOP: reconciled plan does not match frozen cohort size.",
    );
  }

  console.log(
    "\nREPAIR PLAN FREEZE: PASS",
  );

  console.log(
    "NO OPENAI CALLS MADE.",
  );

  console.log(
    "NO DATABASE CHANGES MADE.",
  );
}
