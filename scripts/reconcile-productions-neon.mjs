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
      "./migration-production-source.json",
      import.meta.url
    ),
    "utf8"
  )
);

const productionRows = await sql`
  SELECT
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
    hero_blur_data_url
  FROM productions
  WHERE deleted_at IS NULL
  ORDER BY lower(slug)
`;

const creditRows = await sql`
  SELECT
    p.slug,
    c.role,
    c.name,
    c.website,
    c.position
  FROM production_credits c
  JOIN productions p
    ON p.id = c.production_id
  WHERE c.deleted_at IS NULL
    AND p.deleted_at IS NULL
  ORDER BY lower(p.slug), c.position
`;

const imageRows = await sql`
  SELECT
    p.slug,
    i.storage_key,
    i.display_filename,
    i.alt,
    i.layout,
    i.position,
    i.blur_data_url,
    i.suggested_filename
  FROM production_images i
  JOIN productions p
    ON p.id = i.production_id
  WHERE i.deleted_at IS NULL
    AND p.deleted_at IS NULL
  ORDER BY lower(p.slug), i.position
`;

const errors = [];

function check(label, actual, expected) {
  if (actual !== expected) {
    errors.push(
      `${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`
    );
  }
}

const dbProductions = new Map(
  productionRows.map((row) => [
    row.slug.toLowerCase(),
    row,
  ])
);

const dbCredits = new Map();
for (const row of creditRows) {
  const key = row.slug.toLowerCase();

  if (!dbCredits.has(key)) {
    dbCredits.set(key, []);
  }

  dbCredits.get(key).push(row);
}

const dbImages = new Map();
for (const row of imageRows) {
  const key = row.slug.toLowerCase();

  if (!dbImages.has(key)) {
    dbImages.set(key, []);
  }

  dbImages.get(key).push(row);
}

check(
  "production count",
  productionRows.length,
  snapshot.productions.length
);

check(
  "credit count",
  creditRows.length,
  snapshot.creditCount
);

check(
  "image count",
  imageRows.length,
  snapshot.imageCount
);

for (const production of snapshot.productions) {
  const key = production.slug.toLowerCase();
  const row = dbProductions.get(key);

  if (!row) {
    errors.push(
      `Missing production in Neon: ${production.slug}`
    );
    continue;
  }

  check(
    `${production.slug}.slug`,
    row.slug,
    production.slug
  );
  check(
    `${production.slug}.title`,
    row.title,
    production.title
  );
  check(
    `${production.slug}.venue`,
    row.venue,
    production.venue
  );
  check(
    `${production.slug}.month`,
    row.month,
    production.month ?? null
  );
  check(
    `${production.slug}.year`,
    row.year,
    production.year
  );
  check(
    `${production.slug}.description`,
    row.description,
    production.description
  );
  check(
    `${production.slug}.access`,
    row.access ?? "public",
    production.access ?? "public"
  );
  check(
    `${production.slug}.showHeroWhenLocked`,
    row.show_hero_when_locked,
    production.showHeroWhenLocked ?? null
  );
  check(
    `${production.slug}.accessPasswordEncrypted`,
    row.access_password_encrypted,
    production.accessPasswordEncrypted ?? null
  );
  check(
    `${production.slug}.heroStorageKey`,
    row.hero_storage_key,
    `${production.slug}/${production.hero}`
  );
  check(
    `${production.slug}.heroDisplayFilename`,
    row.hero_display_filename,
    production.hero
  );
  check(
    `${production.slug}.heroAlt`,
    row.hero_alt,
    production.heroAlt
  );
  check(
    `${production.slug}.heroBlurDataURL`,
    row.hero_blur_data_url,
    production.heroBlurDataURL ?? null
  );

  const credits = dbCredits.get(key) ?? [];

  check(
    `${production.slug}.creditCount`,
    credits.length,
    production.credits.length
  );

  production.credits.forEach(
    (credit, position) => {
      const dbCredit = credits[position];

      if (!dbCredit) {
        errors.push(
          `Missing credit ${production.slug}[${position}]`
        );
        return;
      }

      check(
        `${production.slug}.credits[${position}].position`,
        dbCredit.position,
        position
      );
      check(
        `${production.slug}.credits[${position}].role`,
        dbCredit.role,
        credit.role
      );
      check(
        `${production.slug}.credits[${position}].name`,
        dbCredit.name,
        credit.name
      );
      check(
        `${production.slug}.credits[${position}].website`,
        dbCredit.website,
        credit.website ?? null
      );
    }
  );

  const images = dbImages.get(key) ?? [];

  check(
    `${production.slug}.imageCount`,
    images.length,
    production.images.length
  );

  production.images.forEach(
    (image, position) => {
      const dbImage = images[position];

      if (!dbImage) {
        errors.push(
          `Missing image ${production.slug}[${position}]`
        );
        return;
      }

      check(
        `${production.slug}.images[${position}].position`,
        dbImage.position,
        position
      );
      check(
        `${production.slug}.images[${position}].storageKey`,
        dbImage.storage_key,
        `${production.slug}/${image.src}`
      );
      check(
        `${production.slug}.images[${position}].displayFilename`,
        dbImage.display_filename,
        image.src
      );
      check(
        `${production.slug}.images[${position}].alt`,
        dbImage.alt,
        image.alt
      );
      check(
        `${production.slug}.images[${position}].layout`,
        dbImage.layout,
        image.layout
      );
      check(
        `${production.slug}.images[${position}].blurDataURL`,
        dbImage.blur_data_url,
        image.blurDataURL ?? null
      );
      check(
        `${production.slug}.images[${position}].suggestedFilename`,
        dbImage.suggested_filename,
        image.suggestedFilename ?? null
      );
    }
  );
}

const snapshotSlugs = new Set(
  snapshot.productions.map(
    (production) => production.slug.toLowerCase()
  )
);

for (const row of productionRows) {
  if (!snapshotSlugs.has(row.slug.toLowerCase())) {
    errors.push(
      `Unexpected active production in Neon: ${row.slug}`
    );
  }
}

console.log(`Productions checked: ${productionRows.length}`);
console.log(`Credits checked: ${creditRows.length}`);
console.log(`Gallery images checked: ${imageRows.length}`);

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
console.log("NEON RECONCILIATION PASSED");
