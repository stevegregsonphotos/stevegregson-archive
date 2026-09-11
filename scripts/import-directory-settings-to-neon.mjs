import fs from "node:fs/promises";
import crypto from "node:crypto";

import { neon } from "@neondatabase/serverless";

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

function deterministicUuid(namespace) {
  const hex = crypto
    .createHash("sha256")
    .update(namespace)
    .digest("hex")
    .slice(0, 32)
    .split("");

  hex[12] = "5";

  const variant =
    (parseInt(hex[16], 16) & 0x3) | 0x8;

  hex[16] = variant.toString(16);

  const value = hex.join("");

  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20, 32),
  ].join("-");
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

const expectedCounts = {
  venues: 20,
  companies: 12,
  people: 17,
};

for (const [category, expected] of Object.entries(expectedCounts)) {
  const actual =
    Object.keys(
      snapshot.directory?.[category] ?? {}
    ).length;

  if (actual !== expected) {
    throw new Error(
      `${category}: expected ${expected}, found ${actual}.`
    );
  }
}

const directoryTables = {
  venues: "directory_venues",
  companies: "directory_companies",
  people: "directory_people",
};

for (const [category, tableName] of Object.entries(directoryTables)) {
  const entries =
    Object.entries(
      snapshot.directory[category]
    );

  const queries = [
    sql`
      UPDATE ${sql.unsafe(tableName)}
      SET
        deleted_at = now(),
        updated_at = now()
      WHERE deleted_at IS NULL
    `,
  ];

  for (const [displayName, entry] of entries) {
    const id =
      deterministicUuid(
        `directory:${category}:${displayName}`
      );

    queries.push(
      sql`
        INSERT INTO ${sql.unsafe(tableName)} (
          id,
          display_name,
          url,
          created_at,
          updated_at,
          deleted_at
        )
        VALUES (
          ${id},
          ${displayName},
          ${entry.url},
          now(),
          now(),
          null
        )
        ON CONFLICT (id)
        DO UPDATE SET
          display_name = EXCLUDED.display_name,
          url = EXCLUDED.url,
          updated_at = now(),
          deleted_at = null
      `
    );
  }

  await sql.transaction(queries);

  console.log(
    `${category}: ${entries.length} imported`
  );
}

const settings =
  snapshot.settings;

await sql`
  INSERT INTO publishing_settings (
    id,
    max_image_size,
    output_format,
    quality,
    preserve_copyright,
    preserve_photographer,
    optimise_images,
    generate_sitemap,
    generate_structured_data,
    version,
    created_at,
    updated_at
  )
  VALUES (
    'default',
    ${settings.maxImageSize},
    ${settings.outputFormat},
    ${settings.quality},
    ${settings.preserveCopyright},
    ${settings.preservePhotographer},
    ${settings.optimiseImages},
    ${settings.generateSitemap},
    ${settings.generateStructuredData},
    1,
    now(),
    now()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    max_image_size =
      EXCLUDED.max_image_size,
    output_format =
      EXCLUDED.output_format,
    quality =
      EXCLUDED.quality,
    preserve_copyright =
      EXCLUDED.preserve_copyright,
    preserve_photographer =
      EXCLUDED.preserve_photographer,
    optimise_images =
      EXCLUDED.optimise_images,
    generate_sitemap =
      EXCLUDED.generate_sitemap,
    generate_structured_data =
      EXCLUDED.generate_structured_data,
    updated_at = now()
`;

console.log("");
console.log("Publishing settings imported: 1");
console.log("");
console.log("IMPORT COMPLETED");
