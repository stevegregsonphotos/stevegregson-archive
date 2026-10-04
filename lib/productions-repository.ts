import "server-only";

import { randomUUID } from "node:crypto";

import { neon } from "@neondatabase/serverless";

import type {
  Production,
  ProductionCredit,
  ProductionImage,
} from "../content/productions";
import {
  DEFAULT_PRODUCTION_GALLERY_LAYOUT,
  parseStoredProductionGalleryLayout,
  productionGalleryLayoutKey,
  type ProductionGalleryLayout,
  type StoredProductionGalleryLayout,
} from "./production-gallery-layouts";
import { getSiteContent, saveSiteContent } from "./site-content-repository";

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
  archivePosition: number | null;
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
  original_display_filename: string | null;
  edit_aspect: ProductionImage["editAspect"] | null;
  edit_zoom: number | null;
  edit_pan_x: number | null;
  edit_pan_y: number | null;
  edit_brightness: number | null;
  edit_auto_strength: number | null;
  analysis_status: "pending" | "complete";
  analysed_at: Date | string | null;
  position: number;
};

function productionMonth(
  production: { month?: number | null },
) {
  return production.month ?? 0;
}

function sortProductions<
  T extends {
    year: number;
    month?: number | null;
    title: string;
    archivePosition?: number | null;
  },
>(productions: T[]) {
  return productions.sort(
    (first, second) =>
      second.year - first.year ||
      productionMonth(second) -
        productionMonth(first) ||
      (
        first.archivePosition ??
        Number.MAX_SAFE_INTEGER
      ) -
        (
          second.archivePosition ??
          Number.MAX_SAFE_INTEGER
        ) ||
      first.title.localeCompare(
        second.title,
      ),
  );
}

function mapCreditRow(
  row: CreditRow,
): ProductionCredit {
  return {
    role: row.role,
    name: row.name,
    ...(row.website
      ? { website: row.website }
      : {}),
  };
}

function mapImageRow(
  row: ImageRow,
): ProductionImage {
  return {
    src: row.display_filename,
    alt: row.alt,
    layout: row.layout,
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
    ...(row.original_display_filename
      ? {
          originalSrc:
            row.original_display_filename,
        }
      : {}),
    editAspect: row.edit_aspect ?? "original",
    editZoom: row.edit_zoom ?? 1,
    editPanX: row.edit_pan_x ?? 0,
    editPanY: row.edit_pan_y ?? 0,
    editBrightness: row.edit_brightness ?? 100,
    editAutoStrength:
      row.edit_auto_strength ?? 0,
    analysisStatus:
      row.analysis_status ?? "complete",
    ...(row.analysed_at
      ? {
          analysedAt:
            row.analysed_at instanceof Date
              ? row.analysed_at.toISOString()
              : new Date(
                  row.analysed_at,
                ).toISOString(),
        }
      : {}),
  };
}

export type ProductionIndexEntry = {
  slug: string;
  title: string;
  venue: string;
  month: number | null;
  year: number;
  access: "public" | "password" | null;
  updatedAt: string;
};

export async function getProductionIndex():
  Promise<ProductionIndexEntry[]> {
  const sql = getSql();

  const rows = await sql`
    SELECT
      slug,
      title,
      venue,
      month,
      year,
      access,
      updated_at AS "updatedAt"
    FROM productions
    WHERE deleted_at IS NULL
  `;

  return sortProductions(
    (rows as ProductionIndexEntry[])
      .map((row) => ({ ...row })),
  );
}

export type ArchiveProduction = {
  slug: string;
  title: string;
  venue: string;
  month: number | null;
  year: number;
  description: string;
  hero: string;
  heroAlt: string;
  access?: "public" | "password";
  showHeroWhenLocked?: boolean;
  credits: ProductionCredit[];
};

export async function getArchiveProductions():
  Promise<ArchiveProduction[]> {
  const sql = getSql();

  const [productionRows, creditRows] =
    await Promise.all([
      sql`
        SELECT
          id,
          slug,
          title,
          venue,
          month,
          year,
          archive_position,
          description,
          access,
          show_hero_when_locked,
          hero_display_filename,
          hero_alt
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
    ]);

  const creditsByProduction =
    new Map<string, ProductionCredit[]>();

  for (const row of creditRows as CreditRow[]) {
    const credits =
      creditsByProduction.get(
        row.production_id,
      ) ?? [];
    credits.push(mapCreditRow(row));
    creditsByProduction.set(
      row.production_id,
      credits,
    );
  }

  const productions =
    (productionRows as Array<{
    id: string;
    slug: string;
    title: string;
    venue: string;
    month: number | null;
    year: number;
    archive_position: number | null;
    description: string;
    access: "public" | "password" | null;
    show_hero_when_locked: boolean | null;
    hero_display_filename: string;
    hero_alt: string;
  }>).map((row) => ({
    slug: row.slug,
    title: row.title,
    venue: row.venue,
    month: row.month,
    year: row.year,
    archivePosition:
      row.archive_position,
    description: row.description,
    hero: row.hero_display_filename,
    heroAlt: row.hero_alt,
    ...(row.access !== null
      ? { access: row.access }
      : {}),
    ...(row.show_hero_when_locked !== null
      ? {
          showHeroWhenLocked:
            row.show_hero_when_locked,
        }
      : {}),
    credits:
      creditsByProduction.get(row.id) ?? [],
  }));

  return sortProductions(productions);
}

export type PeopleProduction = {
  slug: string;
  title: string;
  year: number;
  credits: ProductionCredit[];
};

export async function getPeopleProductions():
  Promise<PeopleProduction[]> {
  const sql = getSql();
  const [productionRows, creditRows] =
    await Promise.all([
      sql`
        SELECT id, slug, title, year
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
    ]);

  const creditsByProduction =
    new Map<string, ProductionCredit[]>();

  for (const row of creditRows as CreditRow[]) {
    const credits =
      creditsByProduction.get(
        row.production_id,
      ) ?? [];
    credits.push(mapCreditRow(row));
    creditsByProduction.set(
      row.production_id,
      credits,
    );
  }

  return (productionRows as Array<{
    id: string;
    slug: string;
    title: string;
    year: number;
  }>).map((row) => ({
    slug: row.slug,
    title: row.title,
    year: row.year,
    credits:
      creditsByProduction.get(row.id) ?? [],
  }));
}

export type AdminProductionSummary = {
  slug: string;
  title: string;
  venue: string;
  month: number | null;
  year: number;
  archivePosition: number | null;
  hero: string;
  imageCount: number;
};

export async function getAdminProductionSummaries():
  Promise<AdminProductionSummary[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      p.slug,
      p.title,
      p.venue,
      p.month,
      p.year,
      p.archive_position,
      p.hero_display_filename AS hero,
      COUNT(i.production_id)::int AS image_count
    FROM productions p
    LEFT JOIN production_images i
      ON i.production_id = p.id
      AND i.deleted_at IS NULL
    WHERE p.deleted_at IS NULL
    GROUP BY
      p.id,
      p.slug,
      p.title,
      p.venue,
      p.month,
      p.year,
      p.archive_position,
      p.hero_display_filename
  `;

  return sortProductions(
    (rows as Array<{
      slug: string;
      title: string;
      venue: string;
      month: number | null;
      year: number;
      archive_position: number | null;
      hero: string;
      image_count: number;
    }>).map((row) => ({
      slug: row.slug,
      title: row.title,
      venue: row.venue,
      month: row.month,
      year: row.year,
      archivePosition:
        row.archive_position,
      hero: row.hero,
      imageCount: Number(row.image_count),
    })),
  );
}

export async function moveProductionWithinArchiveMonth(
  slug: string,
  direction: "up" | "down",
) {
  const sql = getSql();

  const targetRows = await sql`
    SELECT
      id,
      slug,
      title,
      month,
      year,
      archive_position
    FROM productions
    WHERE lower(slug) = lower(${slug})
      AND deleted_at IS NULL
    LIMIT 1
  `;

  const target =
    targetRows[0] as
      | {
          id: string;
          slug: string;
          title: string;
          month: number | null;
          year: number;
          archive_position:
            | number
            | null;
        }
      | undefined;

  if (!target) {
    return null;
  }

  const monthRows = await sql`
    SELECT
      id,
      slug,
      title,
      archive_position
    FROM productions
    WHERE year = ${target.year}
      AND month IS NOT DISTINCT FROM
        ${target.month}::integer
      AND deleted_at IS NULL
    ORDER BY
      archive_position ASC NULLS LAST,
      title ASC
  `;

  const ordered =
    monthRows as Array<{
      id: string;
      slug: string;
      title: string;
      archive_position:
        | number
        | null;
    }>;

  const currentIndex =
    ordered.findIndex(
      (production) =>
        production.id ===
        target.id,
    );

  if (currentIndex < 0) {
    return null;
  }

  const destinationIndex =
    direction === "up"
      ? currentIndex - 1
      : currentIndex + 1;

  if (
    destinationIndex < 0 ||
    destinationIndex >=
      ordered.length
  ) {
    return {
      moved: false,
      slug: target.slug,
    };
  }

  const reordered =
    [...ordered];

  const [
    movedProduction,
  ] =
    reordered.splice(
      currentIndex,
      1,
    );

  reordered.splice(
    destinationIndex,
    0,
    movedProduction,
  );

  const queries =
    reordered.map(
      (production, position) =>
        sql`
          UPDATE productions
          SET
            archive_position =
              ${position},
            updated_at = now()
          WHERE id =
            ${production.id}
            AND deleted_at IS NULL
        `,
    );

  await sql.transaction(
    queries,
  );

  return {
    moved: true,
    slug: target.slug,
  };
}

export type ProductionNavigationEntry = {
  slug: string;
  title: string;
  venue: string;
  month: number | null;
  year: number;
  hero: string;
};

export async function getPublicProductionNavigation():
  Promise<ProductionNavigationEntry[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      slug,
      title,
      venue,
      month,
      year,
      hero_display_filename AS hero
    FROM productions
    WHERE deleted_at IS NULL
      AND COALESCE(access, 'public') <> 'password'
  `;

  return sortProductions(
    (rows as ProductionNavigationEntry[])
      .map((row) => ({ ...row })),
  );
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
        original_display_filename,
        edit_aspect,
        edit_zoom,
        edit_pan_x,
        edit_pan_y,
        edit_brightness,
        edit_auto_strength,
        analysis_status,
        analysed_at,
        position
      FROM production_images
      WHERE deleted_at IS NULL
      ORDER BY production_id, position
    `,
  ]);

  const creditsByProduction =
    new Map<string, ProductionCredit[]>();

  for (const row of creditRows as CreditRow[]) {
    const credits =
      creditsByProduction.get(
        row.production_id,
      ) ?? [];
    credits.push(mapCreditRow(row));
    creditsByProduction.set(
      row.production_id,
      credits,
    );
  }

  const imagesByProduction =
    new Map<string, ProductionImage[]>();

  for (const row of imageRows as ImageRow[]) {
    const images =
      imagesByProduction.get(
        row.production_id,
      ) ?? [];
    images.push(mapImageRow(row));
    imagesByProduction.set(
      row.production_id,
      images,
    );
  }

  const productions =
    (productionRows as ProductionRow[])
      .map((row): Production => ({
        slug: row.slug,
        title: row.title,
        venue: row.venue,
        ...(row.month !== null
          ? { month: row.month }
          : {}),
        year: row.year,
        description: row.description,
        hero: row.hero_display_filename,
        heroAlt: row.hero_alt,
        ...(row.hero_blur_data_url
          ? {
              heroBlurDataURL:
                row.hero_blur_data_url,
            }
          : {}),
        ...(row.access !== null
          ? { access: row.access }
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
          creditsByProduction.get(row.id) ?? [],
        images:
          imagesByProduction.get(row.id) ?? [],
      }));

  return sortProductions(productions);
}

export type ProductionSitemapImages = {
  slug: string;
  hero: string;
  images: string[];
};

/**
 * Just the photo filenames of every public production, in gallery order,
 * for the sitemap. Much lighter than getProductions(), which also loads
 * blur placeholders and edit settings for every photograph.
 */
export async function getPublicProductionSitemapImages():
  Promise<ProductionSitemapImages[]> {
  const sql = getSql();

  const [productionRows, imageRows] =
    await Promise.all([
      sql`
        SELECT id, slug, hero_display_filename AS hero
        FROM productions
        WHERE deleted_at IS NULL
          AND COALESCE(access, 'public') <> 'password'
      `,
      sql`
        SELECT i.production_id, i.display_filename
        FROM production_images i
        INNER JOIN productions p
          ON p.id = i.production_id
          AND p.deleted_at IS NULL
          AND COALESCE(p.access, 'public') <> 'password'
        WHERE i.deleted_at IS NULL
        ORDER BY i.production_id, i.position
      `,
    ]);

  const imagesByProduction =
    new Map<string, string[]>();

  for (const row of imageRows as Array<{
    production_id: string;
    display_filename: string;
  }>) {
    const images =
      imagesByProduction.get(
        row.production_id,
      ) ?? [];
    images.push(row.display_filename);
    imagesByProduction.set(
      row.production_id,
      images,
    );
  }

  return (productionRows as Array<{
    id: string;
    slug: string;
    hero: string;
  }>).map((row) => ({
    slug: row.slug,
    hero: row.hero,
    images:
      imagesByProduction.get(row.id) ?? [],
  }));
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

export type ProductionAccessSummary = {
  slug: string;
  title: string;
  venue: string;
  year: number;
  access: "public" | "password" | null;
  showHeroWhenLocked: boolean | null;
  hero: string;
  heroAlt: string;
};

export async function getProductionAccessSummary(
  slug: string,
): Promise<ProductionAccessSummary | undefined> {
  const normalisedSlug =
    decodeURIComponent(slug)
      .trim()
      .toLowerCase();

  if (!normalisedSlug) {
    return undefined;
  }

  const sql = getSql();
  const rows = await sql`
    SELECT
      slug,
      title,
      venue,
      year,
      access,
      show_hero_when_locked AS "showHeroWhenLocked",
      hero_display_filename AS hero,
      hero_alt AS "heroAlt"
    FROM productions
    WHERE deleted_at IS NULL
      AND lower(slug) = ${normalisedSlug}
    LIMIT 1
  `;

  return (
    rows as ProductionAccessSummary[]
  )[0];
}

export async function getProduction(
  slug: string,
) {
  const normalisedSlug =
    decodeURIComponent(slug)
      .trim()
      .toLowerCase();

  if (!normalisedSlug) {
    return undefined;
  }

  const sql = getSql();
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
      hero_display_filename,
      hero_alt,
      hero_blur_data_url
    FROM productions
    WHERE deleted_at IS NULL
      AND lower(slug) = ${normalisedSlug}
    LIMIT 1
  `;

  const row =
    (productionRows as ProductionRow[])[0];

  if (!row) {
    return undefined;
  }

  const [creditRows, imageRows, galleryLayout] =
    await Promise.all([
      sql`
        SELECT
          production_id,
          role,
          name,
          website,
          position
        FROM production_credits
        WHERE deleted_at IS NULL
          AND production_id = ${row.id}
        ORDER BY position
      `,
      sql`
        SELECT
          production_id,
          display_filename,
          alt,
          layout,
          blur_data_url,
          suggested_filename,
          original_display_filename,
          edit_aspect,
          edit_zoom,
          edit_pan_x,
          edit_pan_y,
          edit_brightness,
          edit_auto_strength,
          position
        FROM production_images
        WHERE deleted_at IS NULL
          AND production_id = ${row.id}
        ORDER BY position
      `,
      getProductionGalleryLayout(row.slug),
    ]);

  return {
    slug: row.slug,
    title: row.title,
    venue: row.venue,
    ...(row.month !== null
      ? { month: row.month }
      : {}),
    year: row.year,
    description: row.description,
    hero: row.hero_display_filename,
    heroAlt: row.hero_alt,
    ...(row.hero_blur_data_url
      ? {
          heroBlurDataURL:
            row.hero_blur_data_url,
        }
      : {}),
    ...(row.access !== null
      ? { access: row.access }
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
      (creditRows as CreditRow[])
        .map(mapCreditRow),
    images:
      (imageRows as ImageRow[])
        .map(mapImageRow),
    ...(galleryLayout && galleryLayout !== DEFAULT_PRODUCTION_GALLERY_LAYOUT
      ? { galleryLayout }
      : {}),
  } satisfies Production;
}

/**
 * The production's gallery layout preset, kept in site_content.
 * Never throws: any problem (no table yet, no key, bad value) means
 * the default per-photo layout, so public pages always render.
 */
export async function getProductionGalleryLayout(
  slug: string,
): Promise<ProductionGalleryLayout | undefined> {
  try {
    return parseStoredProductionGalleryLayout(
      await getSiteContent(productionGalleryLayoutKey(slug)),
    );
  } catch (error) {
    console.error("Production gallery layout could not be read:", error);
    return undefined;
  }
}

export async function saveProductionGalleryLayout(
  slug: string,
  layout: ProductionGalleryLayout,
) {
  const value: StoredProductionGalleryLayout = { layout };
  await saveSiteContent(productionGalleryLayoutKey(slug), value);
}

export function getNextProductionFromData<
  T extends {
    slug: string;
    access?: "public" | "password" | null;
  },
>(
  productions: T[],
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
      candidate.access !== "password"
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

export async function getProductionSlugRedirect(
  oldSlug: string,
) {
  const normalisedSlug =
    decodeURIComponent(oldSlug)
      .trim()
      .toLowerCase();

  if (!normalisedSlug) {
    return null;
  }

  const sql = getSql();

  const rows = await sql`
    SELECT p.slug
    FROM production_slug_redirects r
    INNER JOIN productions p
      ON p.id = r.production_id
      AND p.deleted_at IS NULL
    WHERE lower(r.old_slug) = ${normalisedSlug}
    LIMIT 1
  `;

  const slug = rows[0]?.slug;

  return typeof slug === "string"
    ? slug
    : null;
}

export async function renameProductionSlug(
  currentSlug: string,
  newSlug: string,
) {
  const sql = getSql();

  const sourceRows = await sql`
    SELECT
      id,
      slug,
      hero_display_filename
    FROM productions
    WHERE lower(slug) = lower(${currentSlug})
      AND deleted_at IS NULL
    LIMIT 1
  `;

  const source =
    sourceRows[0] as
      | {
          id: string;
          slug: string;
          hero_display_filename: string;
        }
      | undefined;

  if (!source) {
    throw new Error(
      "The production could not be found.",
    );
  }

  if (
    source.slug.toLowerCase() ===
    newSlug.toLowerCase()
  ) {
    return getProduction(source.slug);
  }

  const targetRows = await sql`
    SELECT id
    FROM productions
    WHERE lower(slug) = lower(${newSlug})
      AND deleted_at IS NULL
      AND id <> ${source.id}
    LIMIT 1
  `;

  if (targetRows[0]) {
    throw new Error(
      `A production already exists for "${newSlug}".`,
    );
  }

  const redirectRows = await sql`
    SELECT production_id
    FROM production_slug_redirects
    WHERE lower(old_slug) = lower(${newSlug})
    LIMIT 1
  `;

  if (redirectRows[0]) {
    throw new Error(
      `The URL "${newSlug}" is already reserved by a previous production URL.`,
    );
  }

  const existingOldRedirect = await sql`
    SELECT id
    FROM production_slug_redirects
    WHERE lower(old_slug) = lower(${source.slug})
    LIMIT 1
  `;

  if (existingOldRedirect[0]) {
    throw new Error(
      `The current URL "${source.slug}" is already recorded as a redirect.`,
    );
  }

  const results = await sql.transaction([
    sql`
      UPDATE productions
      SET
        slug = ${newSlug},
        hero_storage_key = ${productionStorageKey(
          newSlug,
          source.hero_display_filename,
        )},
        version = version + 1,
        updated_at = now()
      WHERE id = ${source.id}
        AND deleted_at IS NULL
        AND lower(slug) = lower(${source.slug})
      RETURNING id
    `,
    sql`
      UPDATE production_images
      SET
        storage_key =
          ${newSlug} || '/' || display_filename,
        updated_at = now()
      WHERE production_id = ${source.id}
        AND deleted_at IS NULL
    `,
    sql`
      INSERT INTO production_slug_redirects (
        id,
        production_id,
        old_slug,
        created_at
      )
      VALUES (
        ${randomUUID()},
        ${source.id},
        ${source.slug},
        now()
      )
      RETURNING id
    `,
  ]);

  if (
    results[0].length !== 1 ||
    results[2].length !== 1
  ) {
    throw new Error(
      "The production URL could not be updated in Neon.",
    );
  }

  return getProduction(newSlug);
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
        original_display_filename,
        edit_aspect,
        edit_zoom,
        edit_pan_x,
        edit_pan_y,
        edit_brightness,
        edit_auto_strength,
        analysis_status,
        analysed_at,
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
        ${image.originalSrc ?? null},
        ${image.editAspect ?? "original"},
        ${image.editZoom ?? 1},
        ${image.editPanX ?? 0},
        ${image.editPanY ?? 0},
        ${image.editBrightness ?? 100},
        ${image.editAutoStrength ?? 0},
        ${image.analysisStatus ?? "complete"},
        ${image.analysedAt ?? null},
        now(),
        now(),
        null
      )
    `),
  ];
}

function explicitYearFromSlug(
  slug: string,
) {
  const matches = [
    ...slug.matchAll(
      /(?:^|-)(20\d{2})(?=-|$)/g,
    ),
  ];

  if (matches.length !== 1) {
    return null;
  }

  return Number(matches[0][1]);
}

async function assertProductionCanBeCreated(
  sql: ReturnType<typeof getSql>,
  production: ProductionWriteData,
) {
  const slugYear =
    explicitYearFromSlug(production.slug);

  if (
    slugYear !== null &&
    slugYear !== production.year
  ) {
    throw new Error(
      `Production URL year ${slugYear} does not match production year ${production.year}.`,
    );
  }

  const duplicateRows = await sql`
    SELECT slug
    FROM productions
    WHERE deleted_at IS NULL
      AND lower(trim(title)) =
        lower(trim(${production.title}))
      AND lower(trim(venue)) =
        lower(trim(${production.venue}))
      AND year = ${production.year}
      AND month IS NOT DISTINCT FROM
        ${production.month ?? null}
    LIMIT 1
  `;

  const duplicateSlug =
    duplicateRows[0]?.slug;

  if (typeof duplicateSlug === "string") {
    throw new Error(
      `A production with the same title, venue and date already exists as "${duplicateSlug}".`,
    );
  }
}

export async function createProduction(
  production: ProductionWriteData,
) {
  const sql = getSql();

  await assertProductionCanBeCreated(
    sql,
    production,
  );

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
        original_display_filename, edit_aspect, edit_zoom,
        edit_pan_x, edit_pan_y, edit_brightness,
        edit_auto_strength, analysis_status, analysed_at,
        created_at, updated_at, deleted_at
      )
      VALUES (
        ${randomUUID()}, ${productionId},
        ${productionStorageKey(production.slug, image.src)},
        ${image.src}, ${image.alt}, ${image.layout}, ${position},
        ${image.blurDataURL ?? null}, ${image.suggestedFilename ?? null},
        ${image.originalSrc ?? null},
        ${image.editAspect ?? "original"},
        ${image.editZoom ?? 1},
        ${image.editPanX ?? 0},
        ${image.editPanY ?? 0},
        ${image.editBrightness ?? 100},
        ${image.editAutoStrength ?? 0},
        ${image.analysisStatus ?? "complete"},
        ${image.analysedAt ?? null},
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
