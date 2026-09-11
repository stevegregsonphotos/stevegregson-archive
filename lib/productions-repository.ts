import "server-only";

import { randomUUID } from "node:crypto";

import { neon } from "@neondatabase/serverless";

import type {
  Production,
  ProductionCredit,
  ProductionImage,
} from "../content/productions";

function getSql() {
  const databaseUrl =
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured.",
    );
  }

  return neon(databaseUrl);
}

type ProductionRow = {
  id: string;
  slug: string;
  title: string;
  venue: string;
  month: number | null;
  year: number;
  description: string;
  access: "public" | "password" | null;
  show_hero_when_locked: boolean | null;
  access_password_encrypted: string | null;
  hero_display_filename: string;
  hero_alt: string;
  hero_blur_data_url: string | null;
};

type CreditRow = {
  production_id: string;
  role: string;
  name: string;
  website: string | null;
  position: number;
};

type ImageRow = {
  production_id: string;
  display_filename: string;
  alt: string;
  layout: ProductionImage["layout"];
  blur_data_url: string | null;
  suggested_filename: string | null;
  position: number;
};

function productionMonth(
  production: Production,
) {
  return production.month ?? 0;
}

export async function getProductions():
  Promise<Production[]> {
  const sql = getSql();

  const [
    productionRows,
    creditRows,
    imageRows,
  ] = await Promise.all([
    sql`
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
        hero_display_filename,
        hero_alt,
        hero_blur_data_url
      FROM productions
      WHERE deleted_at IS NULL
    `,
    sql`
      SELECT
        production_id,
        role,
        name,
        website,
        position
      FROM production_credits
      WHERE deleted_at IS NULL
      ORDER BY production_id, position
    `,
    sql`
      SELECT
        production_id,
        display_filename,
        alt,
        layout,
        blur_data_url,
        suggested_filename,
        position
      FROM production_images
      WHERE deleted_at IS NULL
      ORDER BY production_id, position
    `,
  ]);

  const creditsByProduction =
    new Map<
      string,
      ProductionCredit[]
    >();

  for (
    const row of
    creditRows as CreditRow[]
  ) {
    const credits =
      creditsByProduction.get(
        row.production_id,
      ) ?? [];

    credits.push({
      role: row.role,
      name: row.name,
      ...(row.website
        ? {
            website:
              row.website,
          }
        : {}),
    });

    creditsByProduction.set(
      row.production_id,
      credits,
    );
  }

  const imagesByProduction =
    new Map<
      string,
      ProductionImage[]
    >();

  for (
    const row of
    imageRows as ImageRow[]
  ) {
    const images =
      imagesByProduction.get(
        row.production_id,
      ) ?? [];

    images.push({
      src:
        row.display_filename,
      alt:
        row.alt,
      layout:
        row.layout,
      ...(row.blur_data_url
        ? {
            blurDataURL:
              row.blur_data_url,
          }
        : {}),
      ...(row.suggested_filename
        ? {
            suggestedFilename:
              row.suggested_filename,
          }
        : {}),
    });

    imagesByProduction.set(
      row.production_id,
      images,
    );
  }

  const productions =
    (productionRows as ProductionRow[])
      .map(
        (row): Production => ({
          slug:
            row.slug,
          title:
            row.title,
          venue:
            row.venue,
          ...(row.month !== null
            ? {
                month:
                  row.month,
              }
            : {}),
          year:
            row.year,
          description:
            row.description,
          hero:
            row.hero_display_filename,
          heroAlt:
            row.hero_alt,
          ...(row.hero_blur_data_url
            ? {
                heroBlurDataURL:
                  row.hero_blur_data_url,
              }
            : {}),
          ...(row.access !== null
            ? {
                access:
                  row.access,
              }
            : {}),
          ...(row.show_hero_when_locked !== null
            ? {
                showHeroWhenLocked:
                  row.show_hero_when_locked,
              }
            : {}),
          ...(row.access_password_encrypted
            ? {
                accessPasswordEncrypted:
                  row.access_password_encrypted,
              }
            : {}),
          credits:
            creditsByProduction.get(
              row.id,
            ) ?? [],
          images:
            imagesByProduction.get(
              row.id,
            ) ?? [],
        }),
      );

  return productions.sort(
    (first, second) =>
      second.year - first.year ||
      productionMonth(second) -
        productionMonth(first) ||
      first.title.localeCompare(
        second.title,
      ),
  );
}

export function getProductionFromData(
  productions: Production[],
  slug: string,
) {
  const normalisedSlug =
    decodeURIComponent(slug)
      .trim()
      .toLowerCase();

  return productions.find(
    (production) =>
      production.slug
        .trim()
        .toLowerCase() ===
      normalisedSlug,
  );
}

export async function getProduction(
  slug: string,
) {
  const productions =
    await getProductions();

  return getProductionFromData(
    productions,
    slug,
  );
}

export function getNextProductionFromData(
  productions: Production[],
  slug: string,
) {
  const normalisedSlug =
    decodeURIComponent(slug)
      .trim()
      .toLowerCase();

  const currentIndex =
    productions.findIndex(
      (production) =>
        production.slug
          .trim()
          .toLowerCase() ===
        normalisedSlug,
    );

  if (
    currentIndex === -1 ||
    productions.length < 2
  ) {
    return undefined;
  }

  for (
    let offset = 1;
    offset < productions.length;
    offset += 1
  ) {
    const nextIndex =
      (currentIndex + offset) %
      productions.length;

    const candidate =
      productions[nextIndex];

    if (
      candidate.access !==
      "password"
    ) {
      return candidate;
    }
  }

  return undefined;
}


export type ProductionWriteData = {
  slug: string;
  title: string;
  venue: string;
  month?: number;
  year: number;
  description: string;
  access?: "public" | "password";
  showHeroWhenLocked?: boolean;
  accessPasswordEncrypted?: string;
  hero: string;
  heroAlt: string;
  heroBlurDataURL?: string;
  credits: ProductionCredit[];
  images: ProductionImage[];
};

function productionStorageKey(
  slug: string,
  filename: string,
) {
  return `${slug}/${filename}`;
}

export async function productionExists(
  slug: string,
) {
  const sql = getSql();
  const rows = await sql`
    SELECT id
    FROM productions
    WHERE lower(slug) = lower(${slug})
      AND deleted_at IS NULL
    LIMIT 1
  `;
  return Boolean(rows[0]);
}

function productionInsertQueries(
  sql: ReturnType<typeof getSql>,
  production: ProductionWriteData,
  productionId: string,
) {
  return [
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
        ${production.access ?? null},
        ${production.showHeroWhenLocked ?? null},
        ${production.accessPasswordEncrypted ?? null},
        ${productionStorageKey(production.slug, production.hero)},
        ${production.hero},
        ${production.heroAlt},
        ${production.heroBlurDataURL ?? null},
        1,
        now(),
        now(),
        null
      )
      RETURNING id
    `,
    ...production.credits.map((credit, position) => sql`
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
        ${randomUUID()},
        ${productionId},
        ${credit.role},
        ${credit.name},
        ${credit.website ?? null},
        ${position},
        now(),
        now(),
        null
      )
    `),
    ...production.images.map((image, position) => sql`
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
        ${randomUUID()},
        ${productionId},
        ${productionStorageKey(production.slug, image.src)},
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
    `),
  ];
}

export async function createProduction(
  production: ProductionWriteData,
) {
  const sql = getSql();
  const productionId = randomUUID();
  const queries = productionInsertQueries(
    sql,
    production,
    productionId,
  );
  const results = await sql.transaction(queries);
  if (results[0].length !== 1) {
    throw new Error("Production could not be created in Neon.");
  }
  return getProduction(production.slug);
}

export async function replaceProduction(
  production: ProductionWriteData,
) {
  const sql = getSql();
  const rows = await sql`
    SELECT id
    FROM productions
    WHERE lower(slug) = lower(${production.slug})
      AND deleted_at IS NULL
    LIMIT 1
  `;
  if (!rows[0]) {
    return null;
  }
  const productionId = rows[0].id as string;
  const queries = [
    sql`
      UPDATE productions
      SET
        title = ${production.title},
        venue = ${production.venue},
        month = ${production.month ?? null},
        year = ${production.year},
        description = ${production.description},
        access = ${production.access ?? null},
        show_hero_when_locked = ${production.showHeroWhenLocked ?? null},
        access_password_encrypted = ${production.accessPasswordEncrypted ?? null},
        hero_storage_key = ${productionStorageKey(production.slug, production.hero)},
        hero_display_filename = ${production.hero},
        hero_alt = ${production.heroAlt},
        hero_blur_data_url = ${production.heroBlurDataURL ?? null},
        version = version + 1,
        updated_at = now()
      WHERE id = ${productionId}
        AND deleted_at IS NULL
      RETURNING id
    `,
    sql`
      UPDATE production_credits
      SET deleted_at = now(), updated_at = now()
      WHERE production_id = ${productionId}
        AND deleted_at IS NULL
    `,
    sql`
      UPDATE production_images
      SET deleted_at = now(), updated_at = now()
      WHERE production_id = ${productionId}
        AND deleted_at IS NULL
    `,
    ...production.credits.map((credit, position) => sql`
      INSERT INTO production_credits (
        id, production_id, role, name, website, position,
        created_at, updated_at, deleted_at
      )
      VALUES (
        ${randomUUID()}, ${productionId}, ${credit.role}, ${credit.name},
        ${credit.website ?? null}, ${position}, now(), now(), null
      )
    `),
    ...production.images.map((image, position) => sql`
      INSERT INTO production_images (
        id, production_id, storage_key, display_filename, alt, layout,
        position, blur_data_url, suggested_filename,
        created_at, updated_at, deleted_at
      )
      VALUES (
        ${randomUUID()}, ${productionId},
        ${productionStorageKey(production.slug, image.src)},
        ${image.src}, ${image.alt}, ${image.layout}, ${position},
        ${image.blurDataURL ?? null}, ${image.suggestedFilename ?? null},
        now(), now(), null
      )
    `),
  ];
  const results = await sql.transaction(queries);
  if (results[0].length !== 1) {
    throw new Error("Production could not be updated in Neon.");
  }
  return getProduction(production.slug);
}

export async function softDeleteProduction(
  slug: string,
) {
  const sql = getSql();
  const rows = await sql`
    SELECT id
    FROM productions
    WHERE lower(slug) = lower(${slug})
      AND deleted_at IS NULL
    LIMIT 1
  `;
  if (!rows[0]) {
    return false;
  }
  const productionId = rows[0].id as string;
  const results = await sql.transaction([
    sql`
      UPDATE production_credits
      SET deleted_at = now(), updated_at = now()
      WHERE production_id = ${productionId}
        AND deleted_at IS NULL
    `,
    sql`
      UPDATE production_images
      SET deleted_at = now(), updated_at = now()
      WHERE production_id = ${productionId}
        AND deleted_at IS NULL
    `,
    sql`
      UPDATE productions
      SET deleted_at = now(), updated_at = now(), version = version + 1
      WHERE id = ${productionId}
        AND deleted_at IS NULL
      RETURNING id
    `,
  ]);
  return results[2].length === 1;
}
