import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const IMAGE_ID =
  "c9e8e925-878a-57ce-8392-a95fc081c192";

const EXPECTED_CURRENT =
  "Two suited performers stand beneath a screen showing Liz Truss versus a lettuce, with stage haze and purple-blue light.";

const REPLACEMENT =
  "Two suited performers stand beneath a screen showing a political figure beside a lettuce, with stage haze and purple-blue light.";

const APPLY =
  process.argv.includes("--apply");

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

const rows =
  await sql`
    SELECT
      pi.id,
      pi.alt,
      pi.deleted_at,
      p.deleted_at AS production_deleted_at
    FROM production_images pi
    JOIN productions p
      ON p.id = pi.production_id
    WHERE pi.id = ${IMAGE_ID}::uuid
  `;

if (rows.length !== 1) {
  throw new Error(
    `STOP: expected exactly one row, found ${rows.length}.`,
  );
}

const row = rows[0];

if (
  row.deleted_at !== null ||
  row.production_deleted_at !== null
) {
  throw new Error(
    "STOP: image or production is deleted.",
  );
}

if (
  String(row.alt ?? "") !==
  EXPECTED_CURRENT
) {
  throw new Error(
    "STOP: live alt no longer matches the one verified mismatch. No change made.",
  );
}

console.log(
  "\n=== SINGLE ALT CORRECTION ===",
);

console.log(
  "Mode:",
  APPLY ? "APPLY" : "DRY RUN",
);

console.log(
  "Image ID:",
  IMAGE_ID,
);

console.log(
  "Current:",
  row.alt,
);

console.log(
  "Replacement:",
  REPLACEMENT,
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

const updated =
  await sql`
    UPDATE production_images
    SET
      alt = ${REPLACEMENT},
      analysis_status = 'complete',
      analysed_at = NOW(),
      updated_at = NOW()
    WHERE id = ${IMAGE_ID}::uuid
      AND deleted_at IS NULL
      AND alt = ${EXPECTED_CURRENT}
    RETURNING id, alt
  `;

if (
  updated.length !== 1 ||
  updated[0].id !== IMAGE_ID ||
  updated[0].alt !== REPLACEMENT
) {
  throw new Error(
    "STOP: guarded single-row update did not return the expected result.",
  );
}

console.log(
  "\nSINGLE ALT CORRECTION: PASS",
);
