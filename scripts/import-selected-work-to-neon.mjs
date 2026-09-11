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
      "./migration-selected-work-source.json",
      import.meta.url
    ),
    "utf8"
  )
);

if (snapshot.total !== 47) {
  throw new Error(
    `Expected 47 Selected Work items, found ${snapshot.total}.`
  );
}

const categories = [
  "production",
  "rehearsal",
  "campaign",
];

let imported = 0;

for (const category of categories) {
  const items =
    snapshot.categories[category];

  const queries = [
    sql`
      UPDATE selected_work_items
      SET
        deleted_at = now(),
        updated_at = now()
      WHERE category = ${category}
        AND deleted_at IS NULL
    `,
  ];

  items.forEach((item) => {
    const storageKey =
      `selected-work/${category}/${item.filename}`;

    const id =
      deterministicUuid(
        `selected-work:${category}:${item.filename}`
      );

    queries.push(
      sql`
        INSERT INTO selected_work_items (
          id,
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
          position,
          version,
          created_at,
          updated_at,
          deleted_at
        )
        VALUES (
          ${id},
          ${category},
          ${storageKey},
          ${item.filename},
          ${item.suggestedFilename || null},
          ${item.alt},
          ${item.uploadedAt},
          ${item.width ?? null},
          ${item.height ?? null},
          ${item.analysisStatus},
          ${item.analysedAt ?? null},
          ${item.position},
          1,
          now(),
          now(),
          null
        )
        ON CONFLICT (id)
        DO UPDATE SET
          category = EXCLUDED.category,
          storage_key = EXCLUDED.storage_key,
          display_filename =
            EXCLUDED.display_filename,
          suggested_filename =
            EXCLUDED.suggested_filename,
          alt = EXCLUDED.alt,
          uploaded_at = EXCLUDED.uploaded_at,
          width = EXCLUDED.width,
          height = EXCLUDED.height,
          analysis_status =
            EXCLUDED.analysis_status,
          analysed_at =
            EXCLUDED.analysed_at,
          position = EXCLUDED.position,
          updated_at = now(),
          deleted_at = null
      `
    );
  });

  await sql.transaction(queries);

  imported += items.length;

  console.log(
    `${category}: ${items.length} imported`
  );
}

console.log("");
console.log(
  `Selected Work imported: ${imported}`
);

if (imported !== 47) {
  throw new Error(
    `Imported count mismatch: ${imported}`
  );
}

console.log("");
console.log("IMPORT COMPLETED");
