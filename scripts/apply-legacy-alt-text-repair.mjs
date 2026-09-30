import fs from "node:fs/promises";
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const PLAN =
  "scripts/legacy-alt-text-repair-plan.json";

const PROPOSALS =
  "scripts/legacy-alt-text-repair-proposals.json";

const APPLY =
  process.argv.includes("--apply");

function legacyGeneric(value) {
  return /\bproduction\s*photograph(?:\s+\d+\s+of\s+\d+)?\b/i
    .test(String(value ?? ""));
}

function cleanAlt(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function validateReplacement(value) {
  const alt =
    cleanAlt(value);

  if (!alt) {
    throw new Error(
      "Replacement alt is empty.",
    );
  }

  if (
    legacyGeneric(
      alt,
    )
  ) {
    throw new Error(
      `Replacement still contains legacy boilerplate: ${alt}`,
    );
  }

  if (
    /^(image|photo|photograph)\s+of\b/i
      .test(alt)
  ) {
    throw new Error(
      `Replacement starts with prohibited wording: ${alt}`,
    );
  }

  if (alt.length > 240) {
    throw new Error(
      `Replacement exceeds 240 characters: ${alt.length}`,
    );
  }

  return alt;
}

const plan =
  JSON.parse(
    await fs.readFile(
      PLAN,
      "utf8",
    ),
  );

let proposals;

try {
  proposals =
    JSON.parse(
      await fs.readFile(
        PROPOSALS,
        "utf8",
      ),
    );
} catch (error) {
  if (
    error?.code === "ENOENT"
  ) {
    console.log(
      "\n=== LEGACY ALT APPLY ===",
    );
    console.log(
      "Mode: DRY RUN",
    );
    console.log(
      "Proposal file: NOT YET CREATED",
    );
    console.log(
      "Expected proposals:",
      plan.imageCount,
    );
    console.log(
      "\nNO DATABASE CHANGES MADE.",
    );
    process.exit(0);
  }

  throw error;
}

const proposalMap =
  proposals.proposals ??
  {};

const proposalIds =
  Object.keys(
    proposalMap,
  );

console.log(
  "\n=== LEGACY ALT APPLY ===",
);

console.log(
  "Mode:",
  APPLY
    ? "APPLY"
    : "DRY RUN",
);

console.log(
  "Plan images:",
  plan.imageCount,
);

console.log(
  "Proposals:",
  proposalIds.length,
);

if (
  proposalIds.length !==
  plan.imageCount
) {
  console.log(
    `\nSTOP: proposal set is incomplete (${proposalIds.length}/${plan.imageCount}).`,
  );

  console.log(
    "NO DATABASE CHANGES MADE.",
  );

  process.exit(
    APPLY ? 1 : 0,
  );
}

const planById =
  new Map(
    plan.images.map(
      image => [
        image.imageId,
        image,
      ],
    ),
  );

for (
  const id
  of proposalIds
) {
  const source =
    planById.get(id);

  if (!source) {
    throw new Error(
      `STOP: proposal ${id} is not in the frozen repair plan.`,
    );
  }

  const proposal =
    proposalMap[id];

  if (
    proposal.originalAlt !==
    source.originalAlt
  ) {
    throw new Error(
      `STOP: original-alt mismatch inside proposal ${id}.`,
    );
  }

  validateReplacement(
    proposal.proposedAlt,
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

const ids =
  plan.images.map(
    image => image.imageId,
  );

const current =
  await sql`
    SELECT
      pi.id,
      pi.alt,
      pi.deleted_at,
      p.deleted_at AS production_deleted_at
    FROM production_images pi
    JOIN productions p
      ON p.id = pi.production_id
    WHERE pi.id = ANY(${ids}::uuid[])
  `;

const currentById =
  new Map(
    current.map(
      row => [
        row.id,
        row,
      ],
    ),
  );

const conflicts = [];

for (
  const image
  of plan.images
) {
  const row =
    currentById.get(
      image.imageId,
    );

  if (
    !row ||
    row.deleted_at !== null ||
    row.production_deleted_at !== null ||
    String(row.alt ?? "") !==
      String(image.originalAlt ?? "")
  ) {
    conflicts.push({
      imageId:
        image.imageId,
      slug:
        image.slug,
      filename:
        image.filename,
      expectedAlt:
        image.originalAlt,
      currentAlt:
        row?.alt ?? null,
    });
  }
}

console.log(
  "Current rows found:",
  current.length,
);

console.log(
  "Conflicts:",
  conflicts.length,
);

if (conflicts.length) {
  console.log(
    conflicts.slice(
      0,
      20,
    ),
  );

  throw new Error(
    "STOP: frozen database state has changed. No repair applied.",
  );
}

console.log(
  "Validation: PASS",
);

if (!APPLY) {
  console.log(
    "\nDRY RUN PASS.",
  );

  console.log(
    "NO DATABASE CHANGES MADE.",
  );

  process.exit(0);
}

const updatePayload =
  plan.images.map(
    image => ({
      id:
        image.imageId,
      original_alt:
        image.originalAlt,
      replacement_alt:
        validateReplacement(
          proposalMap[
            image.imageId
          ].proposedAlt,
        ),
    }),
  );

const updatePayloadJson =
  JSON.stringify(
    updatePayload,
  );

const updateResult =
  await sql`
    WITH payload AS (
      SELECT
        id,
        original_alt,
        replacement_alt
      FROM jsonb_to_recordset(
        ${updatePayloadJson}::jsonb
      ) AS x(
        id uuid,
        original_alt text,
        replacement_alt text
      )
    ),
    eligibility AS (
      SELECT
        COUNT(*)::integer AS eligible_count
      FROM payload
      JOIN production_images pi
        ON pi.id = payload.id
      JOIN productions p
        ON p.id = pi.production_id
      WHERE pi.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND pi.alt =
          payload.original_alt
    ),
    updated AS (
      UPDATE production_images pi
      SET
        alt =
          payload.replacement_alt,
        analysis_status =
          'complete',
        analysed_at =
          NOW(),
        updated_at =
          NOW()
      FROM
        payload,
        eligibility
      WHERE pi.id =
          payload.id
        AND pi.deleted_at
          IS NULL
        AND pi.alt =
          payload.original_alt
        AND eligibility.eligible_count =
          ${plan.imageCount}
      RETURNING pi.id
    )
    SELECT
      (
        SELECT eligible_count
        FROM eligibility
      ) AS eligible_count,
      COUNT(*)::integer
        AS updated_count
    FROM updated
  `;

const eligibleCount =
  Number(
    updateResult[0]
      ?.eligible_count ??
    -1,
  );

const updated =
  Number(
    updateResult[0]
      ?.updated_count ??
    -1,
  );

if (
  eligibleCount !==
  plan.imageCount
) {
  if (updated !== 0) {
    throw new Error(
      `STOP: atomic guard failed unexpectedly: ${updated} rows changed while only ${eligibleCount}/${plan.imageCount} were eligible.`,
    );
  }

  throw new Error(
    `STOP: atomic compare-and-swap guard found only ${eligibleCount}/${plan.imageCount} eligible rows. ZERO rows were changed.`,
  );
}

if (
  updated !==
  plan.imageCount
) {
  throw new Error(
    `STOP: expected ${plan.imageCount} atomic updates, received ${updated}.`,
  );
}

console.log(
  `\nUpdated atomically: ${updated}`,
);

const remaining =
  await sql`
    SELECT COUNT(*)::integer AS count
    FROM production_images pi
    JOIN productions p
      ON p.id = pi.production_id
    WHERE p.deleted_at IS NULL
      AND pi.deleted_at IS NULL
      AND pi.alt ~* 'production[[:space:]]*photograph'
  `;

console.log(
  "Remaining active legacy boilerplate:",
  remaining[0]?.count ?? "UNKNOWN",
);

if (
  Number(
    remaining[0]?.count ??
    -1,
  ) !== 0
) {
  throw new Error(
    "STOP: legacy boilerplate remains after apply.",
  );
}

console.log(
  "\nLEGACY ALT REPAIR APPLY: PASS",
);
