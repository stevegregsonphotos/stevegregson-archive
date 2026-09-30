import fs from "node:fs/promises";
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const PLAN =
  "scripts/legacy-alt-text-repair-plan.json";

const PROPOSALS =
  "scripts/legacy-alt-text-repair-proposals.json";

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

const plan =
  JSON.parse(
    await fs.readFile(
      PLAN,
      "utf8",
    ),
  );

const proposalsFile =
  JSON.parse(
    await fs.readFile(
      PROPOSALS,
      "utf8",
    ),
  );

if (
  plan.imageCount !== 2389 ||
  plan.productionCount !== 72 ||
  !Array.isArray(plan.images) ||
  plan.images.length !== 2389
) {
  throw new Error(
    "STOP: authoritative repair plan is missing or has changed.",
  );
}

const proposalMap =
  proposalsFile.proposals ?? {};

if (
  Object.keys(proposalMap).length !==
  plan.imageCount
) {
  throw new Error(
    `STOP: proposal set is incomplete (${Object.keys(proposalMap).length}/${plan.imageCount}).`,
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

const rows =
  await sql`
    SELECT
      pi.id,
      pi.alt,
      pi.analysis_status,
      pi.analysed_at,
      pi.deleted_at,
      p.deleted_at AS production_deleted_at
    FROM production_images pi
    JOIN productions p
      ON p.id = pi.production_id
    WHERE pi.id = ANY(${ids}::uuid[])
  `;

const currentById =
  new Map(
    rows.map(
      row => [row.id, row],
    ),
  );

const summary = {
  total: plan.imageCount,
  rowsFound: rows.length,
  exactProposalMatches: 0,
  stillOriginal: 0,
  otherMismatch: 0,
  deleted: 0,
  missing: 0,
};

const mismatches = [];

for (const image of plan.images) {
  const row =
    currentById.get(
      image.imageId,
    );

  const proposal =
    proposalMap[
      image.imageId
    ];

  if (!row) {
    summary.missing += 1;
    mismatches.push({
      imageId: image.imageId,
      slug: image.slug,
      filename: image.filename,
      reason: "missing-row",
      expectedProposal:
        proposal?.proposedAlt ?? null,
      currentAlt: null,
    });
    continue;
  }

  if (
    row.deleted_at !== null ||
    row.production_deleted_at !== null
  ) {
    summary.deleted += 1;
    mismatches.push({
      imageId: image.imageId,
      slug: image.slug,
      filename: image.filename,
      reason: "deleted",
      expectedProposal:
        proposal?.proposedAlt ?? null,
      currentAlt: row.alt ?? null,
    });
    continue;
  }

  const currentAlt =
    clean(row.alt);

  const expectedProposal =
    clean(
      proposal?.proposedAlt,
    );

  const originalAlt =
    clean(image.originalAlt);

  if (
    currentAlt ===
    expectedProposal
  ) {
    summary.exactProposalMatches += 1;
    continue;
  }

  if (
    currentAlt ===
    originalAlt
  ) {
    summary.stillOriginal += 1;
    mismatches.push({
      imageId: image.imageId,
      slug: image.slug,
      filename: image.filename,
      reason: "still-original",
      expectedProposal:
        proposal?.proposedAlt ?? null,
      currentAlt: row.alt ?? null,
    });
    continue;
  }

  summary.otherMismatch += 1;

  mismatches.push({
    imageId: image.imageId,
    slug: image.slug,
    filename: image.filename,
    reason: "different-current-alt",
    expectedProposal:
      proposal?.proposedAlt ?? null,
    currentAlt: row.alt ?? null,
  });
}

console.log(
  "\n=== LEGACY ALT LIVE VERIFICATION ===",
);

console.log(
  "Plan images:",
  summary.total,
);

console.log(
  "Current rows found:",
  summary.rowsFound,
);

console.log(
  "Exact proposal matches:",
  summary.exactProposalMatches,
);

console.log(
  "Still original:",
  summary.stillOriginal,
);

console.log(
  "Other mismatches:",
  summary.otherMismatch,
);

console.log(
  "Deleted:",
  summary.deleted,
);

console.log(
  "Missing:",
  summary.missing,
);

if (mismatches.length) {
  console.log(
    "\nFirst mismatches:",
  );

  console.dir(
    mismatches.slice(0, 25),
    {
      depth: null,
    },
  );
}

if (
  summary.exactProposalMatches ===
    summary.total &&
  summary.stillOriginal === 0 &&
  summary.otherMismatch === 0 &&
  summary.deleted === 0 &&
  summary.missing === 0
) {
  console.log(
    "\nLIVE VERIFY: PASS",
  );

  console.log(
    "All 2,389 live alt values exactly match the proposal set.",
  );
} else {
  console.log(
    "\nLIVE VERIFY: REVIEW REQUIRED",
  );
}

console.log(
  "\nNO DATABASE CHANGES MADE.",
);
