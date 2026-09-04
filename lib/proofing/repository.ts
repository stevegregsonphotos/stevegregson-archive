import { neon } from "@neondatabase/serverless";

import type { ProofingGallery } from "./types";

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured.",
    );
  }

  return neon(databaseUrl);
}

type GalleryRow = {
  data: unknown;
};

function mapGallery(
  row: GalleryRow,
): ProofingGallery {
  return row.data as ProofingGallery;
}

export async function getProofingGalleries():
  Promise<ProofingGallery[]> {
  const sql = getSql();

  const rows = await sql`
    SELECT data
    FROM proofing_galleries
    ORDER BY created_at DESC
  `;

  return rows.map((row) =>
    mapGallery(row as GalleryRow),
  );
}

export async function getProofingGallery(
  id: string,
): Promise<ProofingGallery | undefined> {
  const sql = getSql();

  const rows = await sql`
    SELECT data
    FROM proofing_galleries
    WHERE id = ${id}
    LIMIT 1
  `;

  if (!rows[0]) {
    return undefined;
  }

  return mapGallery(rows[0] as GalleryRow);
}

export async function getProofingGalleryBySlug(
  slug: string,
): Promise<ProofingGallery | undefined> {
  const normalisedSlug = decodeURIComponent(slug)
    .trim()
    .toLowerCase();

  const sql = getSql();

  const rows = await sql`
    SELECT data
    FROM proofing_galleries
    WHERE LOWER(slug) = ${normalisedSlug}
    LIMIT 1
  `;

  if (!rows[0]) {
    return undefined;
  }

  return mapGallery(rows[0] as GalleryRow);
}

export async function saveProofingGallery(
  gallery: ProofingGallery,
): Promise<void> {
  const sql = getSql();

  await sql`
    INSERT INTO proofing_galleries (
      id,
      slug,
      title,
      created_at,
      updated_at,
      data
    )
    VALUES (
      ${gallery.id},
      ${gallery.slug},
      ${gallery.title},
      ${gallery.createdAt},
      ${gallery.updatedAt},
      ${JSON.stringify(gallery)}::jsonb
    )
    ON CONFLICT (id)
    DO UPDATE SET
      slug = EXCLUDED.slug,
      title = EXCLUDED.title,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at,
      data = EXCLUDED.data
  `;
}

export async function updateProofingGallery(
  id: string,
  updater: (
    gallery: ProofingGallery,
  ) => ProofingGallery,
): Promise<ProofingGallery | undefined> {
  const gallery = await getProofingGallery(id);

  if (!gallery) {
    return undefined;
  }

  const updatedGallery = updater(gallery);

  updatedGallery.updatedAt =
    new Date().toISOString();

  await saveProofingGallery(updatedGallery);

  return updatedGallery;
}
