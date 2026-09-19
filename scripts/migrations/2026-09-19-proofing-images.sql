BEGIN;

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
);

CREATE INDEX IF NOT EXISTS proofing_images_gallery_sort_idx
  ON proofing_images (gallery_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS proofing_images_gallery_web_filename_unique
  ON proofing_images (gallery_id, web_filename);

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
ON CONFLICT (id) DO NOTHING;

UPDATE proofing_galleries
SET
  data = jsonb_set(
    data,
    '{images}',
    '[]'::jsonb,
    true
  ),
  updated_at = now()
WHERE jsonb_typeof(data->'images') = 'array'
  AND jsonb_array_length(data->'images') > 0;

COMMIT;
