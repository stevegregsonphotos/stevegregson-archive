import { neon } from "@neondatabase/serverless";

import type {
  ProofingGallery,
  ProofingImage,
} from "./types";

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

type ProofingImageRow = {
  id: string;
  gallery_id: string;
  original_filename: string;
  web_filename: string;
  width: number;
  height: number;
  alt: string;
  sort_order: number;
  created_at: string | Date;
  blur_data_url: string | null;
};

function mapGallery(
  row: GalleryRow,
): ProofingGallery {
  return row.data as ProofingGallery;
}

function mapProofingImage(
  row: ProofingImageRow,
): ProofingImage {
  return {
    id: row.id,
    originalFilename: row.original_filename,
    webFilename: row.web_filename,
    width: Number(row.width),
    height: Number(row.height),
    alt: row.alt,
    sortOrder: Number(row.sort_order),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
    ...(row.blur_data_url
      ? {
          blurDataURL:
            row.blur_data_url,
        }
      : {}),
  };
}

function galleryForStorage(
  gallery: ProofingGallery,
): ProofingGallery {
  return {
    ...gallery,
    images: [],
  };
}

function attachImages(
  gallery: ProofingGallery,
  imageRows: ProofingImageRow[],
) {
  return {
    ...gallery,
    images:
      imageRows
        .map(mapProofingImage)
        .sort(
          (first, second) =>
            first.sortOrder -
            second.sortOrder,
        ),
  };
}

export async function getProofingGalleries():
  Promise<ProofingGallery[]> {
  const sql = getSql();

  const [galleryRows, imageRows] =
    await sql.transaction([
      sql`
        SELECT data
        FROM proofing_galleries
        ORDER BY created_at DESC
      `,
      sql`
        SELECT
          id,
          gallery_id,
          original_filename,
          web_filename,
          width,
          height,
          alt,
          sort_order,
          created_at,
          blur_data_url
        FROM proofing_images
        ORDER BY gallery_id, sort_order
      `,
    ]);

  const imagesByGallery =
    new Map<string, ProofingImageRow[]>();

  for (const rawRow of imageRows) {
    const row = rawRow as ProofingImageRow;
    const current =
      imagesByGallery.get(
        row.gallery_id,
      ) ?? [];
    current.push(row);
    imagesByGallery.set(
      row.gallery_id,
      current,
    );
  }

  return galleryRows.map((row) => {
    const gallery =
      mapGallery(row as GalleryRow);

    return attachImages(
      gallery,
      imagesByGallery.get(
        gallery.id,
      ) ?? [],
    );
  });
}

export async function getProofingGallery(
  id: string,
): Promise<ProofingGallery | undefined> {
  const sql = getSql();

  const [galleryRows, imageRows] =
    await sql.transaction([
      sql`
        SELECT data
        FROM proofing_galleries
        WHERE id = ${id}
        LIMIT 1
      `,
      sql`
        SELECT
          id,
          gallery_id,
          original_filename,
          web_filename,
          width,
          height,
          alt,
          sort_order,
          created_at,
          blur_data_url
        FROM proofing_images
        WHERE gallery_id = ${id}
        ORDER BY sort_order
      `,
    ]);

  if (!galleryRows[0]) {
    return undefined;
  }

  return attachImages(
    mapGallery(
      galleryRows[0] as GalleryRow,
    ),
    imageRows as ProofingImageRow[],
  );
}

export async function getProofingGalleryBySlug(
  slug: string,
): Promise<ProofingGallery | undefined> {
  const normalisedSlug = decodeURIComponent(slug)
    .trim()
    .toLowerCase();

  const sql = getSql();

  const [galleryRows, imageRows] =
    await sql.transaction([
      sql`
        SELECT data
        FROM proofing_galleries
        WHERE LOWER(slug) = ${normalisedSlug}
        LIMIT 1
      `,
      sql`
        SELECT
          pi.id,
          pi.gallery_id,
          pi.original_filename,
          pi.web_filename,
          pi.width,
          pi.height,
          pi.alt,
          pi.sort_order,
          pi.created_at,
          pi.blur_data_url
        FROM proofing_images pi
        WHERE pi.gallery_id = (
          SELECT id::text
          FROM proofing_galleries
          WHERE LOWER(slug) = ${normalisedSlug}
          LIMIT 1
        )
        ORDER BY pi.sort_order
      `,
    ]);

  if (!galleryRows[0]) {
    return undefined;
  }

  return attachImages(
    mapGallery(
      galleryRows[0] as GalleryRow,
    ),
    imageRows as ProofingImageRow[],
  );
}

async function getProofingGalleryBase(
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

  return {
    ...mapGallery(
      rows[0] as GalleryRow,
    ),
    images: [],
  };
}

export async function proofingGalleryExists(
  id: string,
) {
  const sql = getSql();
  const rows = await sql`
    SELECT 1
    FROM proofing_galleries
    WHERE id = ${id}
    LIMIT 1
  `;
  return Boolean(rows[0]);
}

export async function saveProofingGallery(
  gallery: ProofingGallery,
): Promise<void> {
  const sql = getSql();
  const storedGallery =
    galleryForStorage(gallery);

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
      ${JSON.stringify(storedGallery)}::jsonb
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

export async function insertProofingImages(
  galleryId: string,
  images: ProofingImage[],
) {
  if (images.length === 0) {
    return {
      inserted: 0,
      imageCount: 0,
    };
  }

  const sql = getSql();

  const maxRows = await sql`
    SELECT COALESCE(MAX(sort_order), -1) AS max_sort_order
    FROM proofing_images
    WHERE gallery_id = ${galleryId}
  `;

  const firstSortOrder =
    Number(
      maxRows[0]?.max_sort_order ?? -1,
    ) + 1;

  const queries = images.map(
    (image, index) => sql`
      INSERT INTO proofing_images (
        id,
        gallery_id,
        original_filename,
        web_filename,
        width,
        height,
        alt,
        sort_order,
        created_at,
        blur_data_url
      )
      VALUES (
        ${image.id},
        ${galleryId},
        ${image.originalFilename},
        ${image.webFilename},
        ${image.width},
        ${image.height},
        ${image.alt},
        ${firstSortOrder + index},
        ${image.createdAt ?? new Date().toISOString()},
        ${image.blurDataURL ?? null}
      )
      ON CONFLICT (id) DO NOTHING
    `,
  );

  queries.push(sql`
    UPDATE proofing_galleries
    SET updated_at = now()
    WHERE id = ${galleryId}
  `);

  await sql.transaction(queries);

  const countRows = await sql`
    SELECT COUNT(*)::integer AS image_count
    FROM proofing_images
    WHERE gallery_id = ${galleryId}
  `;

  return {
    inserted: images.length,
    imageCount:
      Number(
        countRows[0]?.image_count ?? 0,
      ),
  };
}

export async function deleteProofingImageRecord(
  galleryId: string,
  imageId: string,
) {
  const sql = getSql();

  await sql.transaction([
    sql`
      DELETE FROM proofing_images
      WHERE gallery_id = ${galleryId}
        AND id = ${imageId}
    `,
    sql`
      WITH ordered AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            ORDER BY sort_order, id
          ) - 1 AS next_sort_order
        FROM proofing_images
        WHERE gallery_id = ${galleryId}
      )
      UPDATE proofing_images AS image
      SET sort_order = ordered.next_sort_order
      FROM ordered
      WHERE image.id = ordered.id
    `,
  ]);
}

export async function deleteProofingGallery(
  galleryId: string,
) {
  const sql = getSql();

  const results =
    await sql.transaction([
      sql`
        DELETE FROM proofing_images
        WHERE gallery_id = ${galleryId}
      `,
      sql`
        DELETE FROM proofing_galleries
        WHERE id = ${galleryId}
        RETURNING id
      `,
    ]);

  return results[1].length === 1;
}

export async function reorderProofingImages(
  galleryId: string,
  imageIds: string[],
) {
  const sql = getSql();

  await sql.transaction(
    imageIds.map(
      (imageId, index) => sql`
        UPDATE proofing_images
        SET sort_order = ${index}
        WHERE gallery_id = ${galleryId}
          AND id = ${imageId}
      `,
    ),
  );
}

export async function updateProofingGallery(
  id: string,
  updater: (
    gallery: ProofingGallery,
  ) => ProofingGallery,
): Promise<ProofingGallery | undefined> {
  const gallery =
    await getProofingGalleryBase(id);

  if (!gallery) {
    return undefined;
  }

  const updatedGallery = updater(gallery);

  updatedGallery.updatedAt =
    new Date().toISOString();

  await saveProofingGallery(updatedGallery);

  return updatedGallery;
}
