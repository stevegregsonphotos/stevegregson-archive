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
  process.env.DATABASE_URL;

const sql = neon(
  databaseUrl?.trim() ||
    requiredEnv("DATABASE_URL_UNPOOLED")
);

const snapshot = JSON.parse(
  await fs.readFile(
    new URL(
      "./migration-production-source.json",
      import.meta.url
    ),
    "utf8"
  )
);

if (
  !Array.isArray(snapshot.productions) ||
  snapshot.productions.length !== 92
) {
  throw new Error(
    `Expected exactly 92 productions, found ${
      snapshot.productions?.length ?? "invalid"
    }.`
  );
}

let importedProductions = 0;
let importedCredits = 0;
let importedImages = 0;

for (const production of snapshot.productions) {
  const productionId =
    deterministicUuid(
      `production:${production.slug}`
    );

  const heroStorageKey =
    `${production.slug}/${production.hero}`;

  const queries = [
    sql`
      UPDATE production_credits
      SET
        deleted_at = now(),
        updated_at = now()
      WHERE production_id = ${productionId}
        AND deleted_at IS NULL
    `,
    sql`
      UPDATE production_images
      SET
        deleted_at = now(),
        updated_at = now()
      WHERE production_id = ${productionId}
        AND deleted_at IS NULL
    `,
    sql`
      INSERT INTO productions (
        id,
        slug,
        title,
        venue,
        month,
        year,
        description,
        access,
        show_hero_when_locked,
        access_password_encrypted,
        hero_storage_key,
        hero_display_filename,
        hero_alt,
        hero_blur_data_url,
        version,
        created_at,
        updated_at,
        deleted_at
      )
      VALUES (
        ${productionId},
        ${production.slug},
        ${production.title},
        ${production.venue},
        ${production.month ?? null},
        ${production.year},
        ${production.description},
        ${Object.prototype.hasOwnProperty.call(
          production,
          "access"
        )
          ? production.access
          : null},
        ${production.showHeroWhenLocked ?? null},
        ${production.accessPasswordEncrypted ?? null},
        ${heroStorageKey},
        ${production.hero},
        ${production.heroAlt},
        ${production.heroBlurDataURL ?? null},
        1,
        now(),
        now(),
        null
      )
      ON CONFLICT (id)
      DO UPDATE SET
        slug = EXCLUDED.slug,
        title = EXCLUDED.title,
        venue = EXCLUDED.venue,
        month = EXCLUDED.month,
        year = EXCLUDED.year,
        description = EXCLUDED.description,
        access = EXCLUDED.access,
        show_hero_when_locked =
          EXCLUDED.show_hero_when_locked,
        access_password_encrypted =
          EXCLUDED.access_password_encrypted,
        hero_storage_key =
          EXCLUDED.hero_storage_key,
        hero_display_filename =
          EXCLUDED.hero_display_filename,
        hero_alt = EXCLUDED.hero_alt,
        hero_blur_data_url =
          EXCLUDED.hero_blur_data_url,
        updated_at = now(),
        deleted_at = null
    `,
  ];

  production.credits.forEach(
    (credit, position) => {
      const creditId =
        deterministicUuid(
          `production-credit:${production.slug}:${position}`
        );

      queries.push(
        sql`
          INSERT INTO production_credits (
            id,
            production_id,
            role,
            name,
            website,
            position,
            created_at,
            updated_at,
            deleted_at
          )
          VALUES (
            ${creditId},
            ${productionId},
            ${credit.role},
            ${credit.name},
            ${credit.website ?? null},
            ${position},
            now(),
            now(),
            null
          )
          ON CONFLICT (id)
          DO UPDATE SET
            production_id =
              EXCLUDED.production_id,
            role = EXCLUDED.role,
            name = EXCLUDED.name,
            website = EXCLUDED.website,
            position = EXCLUDED.position,
            updated_at = now(),
            deleted_at = null
        `
      );
    }
  );

  production.images.forEach(
    (image, position) => {
      const storageKey =
        `${production.slug}/${image.src}`;

      const imageId =
        deterministicUuid(
          `production-image:${storageKey}`
        );

      queries.push(
        sql`
          INSERT INTO production_images (
            id,
            production_id,
            storage_key,
            display_filename,
            alt,
            layout,
            position,
            blur_data_url,
            suggested_filename,
            created_at,
            updated_at,
            deleted_at
          )
          VALUES (
            ${imageId},
            ${productionId},
            ${storageKey},
            ${image.src},
            ${image.alt},
            ${image.layout},
            ${position},
            ${image.blurDataURL ?? null},
            ${image.suggestedFilename ?? null},
            now(),
            now(),
            null
          )
          ON CONFLICT (id)
          DO UPDATE SET
            production_id =
              EXCLUDED.production_id,
            storage_key =
              EXCLUDED.storage_key,
            display_filename =
              EXCLUDED.display_filename,
            alt = EXCLUDED.alt,
            layout = EXCLUDED.layout,
            position = EXCLUDED.position,
            blur_data_url =
              EXCLUDED.blur_data_url,
            suggested_filename =
              EXCLUDED.suggested_filename,
            updated_at = now(),
            deleted_at = null
        `
      );
    }
  );

  await sql.transaction(queries);

  importedProductions += 1;
  importedCredits +=
    production.credits.length;
  importedImages +=
    production.images.length;

  if (
    importedProductions % 10 === 0 ||
    importedProductions ===
      snapshot.productions.length
  ) {
    console.log(
      `Prepared/importable: ${importedProductions}/` +
      `${snapshot.productions.length}`
    );
  }
}

console.log("");
console.log(
  `Productions imported: ${importedProductions}`
);
console.log(
  `Credits imported: ${importedCredits}`
);
console.log(
  `Gallery images imported: ${importedImages}`
);

if (
  importedProductions !== 92 ||
  importedCredits !== 401 ||
  importedImages !== 2585
) {
  throw new Error(
    "Imported counts do not match source manifest."
  );
}

console.log("");
console.log("IMPORT COMPLETED");
