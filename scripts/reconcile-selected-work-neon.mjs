import fs from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  requiredEnv("DATABASE_URL_UNPOOLED");

const sql = neon(databaseUrl);

const snapshot = JSON.parse(
  await fs.readFile(
    new URL(
      "./migration-selected-work-source.json",
      import.meta.url
    ),
    "utf8"
  )
);

const rows = await sql`
  SELECT
    category,
    storage_key,
    display_filename,
    suggested_filename,
    alt,
    uploaded_at,
    width,
    height,
    analysis_status,
    analysed_at,
    position
  FROM selected_work_items
  WHERE deleted_at IS NULL
  ORDER BY
    CASE category
      WHEN 'production' THEN 1
      WHEN 'rehearsal' THEN 2
      WHEN 'campaign' THEN 3
    END,
    position
`;

const errors = [];

function check(label, actual, expected) {
  if (actual !== expected) {
    errors.push(
      `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`
    );
  }
}

check("total count", rows.length, 47);

const categories = [
  "production",
  "rehearsal",
  "campaign",
];

for (const category of categories) {
  const expected =
    snapshot.categories[category];

  const actual =
    rows.filter(
      (row) => row.category === category
    );

  check(
    `${category}.count`,
    actual.length,
    expected.length
  );

  expected.forEach((item, position) => {
    const row = actual[position];

    if (!row) {
      errors.push(
        `Missing ${category}[${position}]`
      );
      return;
    }

    check(
      `${category}[${position}].position`,
      row.position,
      position
    );

    check(
      `${category}[${position}].storageKey`,
      row.storage_key,
      `selected-work/${category}/${item.filename}`
    );

    check(
      `${category}[${position}].displayFilename`,
      row.display_filename,
      item.filename
    );

    check(
      `${category}[${position}].suggestedFilename`,
      row.suggested_filename || "",
      item.suggestedFilename || ""
    );

    check(
      `${category}[${position}].alt`,
      row.alt,
      item.alt
    );

    check(
      `${category}[${position}].uploadedAt`,
      new Date(row.uploaded_at).toISOString(),
      new Date(item.uploadedAt).toISOString()
    );

    check(
      `${category}[${position}].width`,
      row.width,
      item.width ?? null
    );

    check(
      `${category}[${position}].height`,
      row.height,
      item.height ?? null
    );

    check(
      `${category}[${position}].analysisStatus`,
      row.analysis_status,
      item.analysisStatus
    );

    check(
      `${category}[${position}].analysedAt`,
      row.analysed_at
        ? new Date(row.analysed_at).toISOString()
        : null,
      item.analysedAt
        ? new Date(item.analysedAt).toISOString()
        : null
    );
  });
}

console.log(
  `Selected Work rows checked: ${rows.length}`
);

if (errors.length) {
  console.error("");
  console.error(
    `RECONCILIATION FAILED: ${errors.length} mismatch(es)`
  );

  for (const error of errors.slice(0, 50)) {
    console.error("");
    console.error(error);
  }

  if (errors.length > 50) {
    console.error(
      `\n... ${errors.length - 50} further mismatch(es)`
    );
  }

  process.exit(1);
}

console.log("");
console.log(
  "SELECTED WORK NEON RECONCILIATION PASSED"
);
