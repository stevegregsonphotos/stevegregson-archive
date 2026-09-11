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
      "./migration-directory-settings-source.json",
      import.meta.url
    ),
    "utf8"
  )
);

const errors = [];

function check(label, actual, expected) {
  if (actual !== expected) {
    errors.push(
      `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`
    );
  }
}

const directoryTables = {
  venues: "directory_venues",
  companies: "directory_companies",
  people: "directory_people",
};

for (const [category, tableName] of Object.entries(directoryTables)) {
  const rows = await sql`
    SELECT display_name, url
    FROM ${sql.unsafe(tableName)}
    WHERE deleted_at IS NULL
    ORDER BY lower(display_name)
  `;

  const expectedEntries =
    Object.entries(snapshot.directory[category])
      .sort(([a], [b]) =>
        a.localeCompare(b, "en-GB", {
          sensitivity: "base",
        })
      );

  check(
    `${category}.count`,
    rows.length,
    expectedEntries.length
  );

  for (const [displayName, entry] of expectedEntries) {
    const row = rows.find(
      (candidate) =>
        candidate.display_name === displayName
    );

    if (!row) {
      errors.push(
        `Missing ${category} entry: ${displayName}`
      );
      continue;
    }

    check(
      `${category}.${displayName}.url`,
      row.url,
      entry.url
    );
  }

  const expectedNames = new Set(
    expectedEntries.map(([name]) => name)
  );

  for (const row of rows) {
    if (!expectedNames.has(row.display_name)) {
      errors.push(
        `Unexpected ${category} entry: ${row.display_name}`
      );
    }
  }

  console.log(
    `${category}: ${rows.length} rows checked`
  );
}

const settingsRows = await sql`
  SELECT
    id,
    max_image_size,
    output_format,
    quality,
    preserve_copyright,
    preserve_photographer,
    optimise_images,
    generate_sitemap,
    generate_structured_data
  FROM publishing_settings
  WHERE id = 'default'
`;

check(
  "publishing_settings.count",
  settingsRows.length,
  1
);

if (settingsRows[0]) {
  const row = settingsRows[0];
  const expected = snapshot.settings;

  check(
    "settings.maxImageSize",
    row.max_image_size,
    expected.maxImageSize
  );
  check(
    "settings.outputFormat",
    row.output_format,
    expected.outputFormat
  );
  check(
    "settings.quality",
    row.quality,
    expected.quality
  );
  check(
    "settings.preserveCopyright",
    row.preserve_copyright,
    expected.preserveCopyright
  );
  check(
    "settings.preservePhotographer",
    row.preserve_photographer,
    expected.preservePhotographer
  );
  check(
    "settings.optimiseImages",
    row.optimise_images,
    expected.optimiseImages
  );
  check(
    "settings.generateSitemap",
    row.generate_sitemap,
    expected.generateSitemap
  );
  check(
    "settings.generateStructuredData",
    row.generate_structured_data,
    expected.generateStructuredData
  );
}

console.log(
  `publishing settings rows checked: ${settingsRows.length}`
);

if (errors.length) {
  console.error("");
  console.error(
    `RECONCILIATION FAILED: ${errors.length} mismatch(es)`
  );

  for (const error of errors) {
    console.error("");
    console.error(error);
  }

  process.exit(1);
}

console.log("");
console.log(
  "DIRECTORY + SETTINGS NEON RECONCILIATION PASSED"
);
