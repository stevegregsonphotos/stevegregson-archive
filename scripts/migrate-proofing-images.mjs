import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

const sql = neon(databaseUrl);

await sql.transaction([
  sql`
    CREATE TABLE IF NOT EXISTS proofing_images (
      id text PRIMARY KEY,
      gallery_id text NOT NULL,
      original_filename text NOT NULL,
      web_filename text NOT NULL,
      width integer NOT NULL,
      height integer NOT NULL,
      alt text NOT NULL,
      sort_order integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      blur_data_url text
    )
  `,
  sql`
    CREATE INDEX IF NOT EXISTS proofing_images_gallery_sort_idx
      ON proofing_images (gallery_id, sort_order)
  `,
  sql`
    CREATE UNIQUE INDEX IF NOT EXISTS proofing_images_gallery_web_filename_unique
      ON proofing_images (gallery_id, web_filename)
  `,
  sql`
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
    SELECT
      image->>'id',
      gallery.id::text,
      image->>'originalFilename',
      image->>'webFilename',
      (image->>'width')::integer,
      (image->>'height')::integer,
      COALESCE(NULLIF(image->>'alt', ''), image->>'originalFilename'),
      (image->>'sortOrder')::integer,
      COALESCE(
        NULLIF(image->>'createdAt', '')::timestamptz,
        gallery.created_at
      ),
      NULLIF(image->>'blurDataURL', '')
    FROM proofing_galleries AS gallery
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(gallery.data->'images') = 'array'
          THEN gallery.data->'images'
        ELSE '[]'::jsonb
      END
    ) AS image
    WHERE
      image->>'id' IS NOT NULL
      AND image->>'originalFilename' IS NOT NULL
      AND image->>'webFilename' IS NOT NULL
      AND image->>'width' IS NOT NULL
      AND image->>'height' IS NOT NULL
      AND image->>'sortOrder' IS NOT NULL
    ON CONFLICT (id) DO NOTHING
  `,

]);

if (process.env.PROOFING_MIGRATION_CLEANUP === "1") {
  await sql.transaction([
  sql`
    UPDATE proofing_galleries AS gallery
    SET
      data = jsonb_set(
        gallery.data,
        '{images}',
        '[]'::jsonb,
        true
      ),
      updated_at = now()
    WHERE
      jsonb_typeof(gallery.data->'images') = 'array'
      AND jsonb_array_length(gallery.data->'images') > 0

      /*
       * Never clear the legacy JSON until every source
       * image has a matching row in proofing_images.
       */
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          gallery.data->'images'
        ) AS source_image
        WHERE
          source_image->>'id' IS NULL
          OR NOT EXISTS (
            SELECT 1
            FROM proofing_images AS migrated_image
            WHERE
              migrated_image.id =
                source_image->>'id'
              AND migrated_image.gallery_id =
                gallery.id::text
          )
      )
  `,
  ]);
}


const [galleryCount] = await sql`
  SELECT COUNT(*)::integer AS count
  FROM proofing_galleries
`;

const [imageCount] = await sql`
  SELECT COUNT(*)::integer AS count
  FROM proofing_images
`;

console.log(
  `Proofing migration complete: ${galleryCount?.count ?? 0} galleries, ${imageCount?.count ?? 0} images.`,
);
