CREATE TABLE IF NOT EXISTS proofing_image_annotations (
  id uuid PRIMARY KEY,
  gallery_id text NOT NULL,
  visitor_id text NOT NULL,
  image_id text NOT NULL,
  annotation jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proofing_image_annotations_image_fkey
    FOREIGN KEY (
      gallery_id,
      image_id
    )
    REFERENCES proofing_images (
      gallery_id,
      id
    )
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS
  proofing_image_annotations_gallery_visitor_image_key
ON proofing_image_annotations (
  gallery_id,
  visitor_id,
  image_id
);

CREATE INDEX IF NOT EXISTS
  proofing_image_annotations_gallery_updated_idx
ON proofing_image_annotations (
  gallery_id,
  updated_at DESC
);

CREATE INDEX IF NOT EXISTS
  proofing_image_annotations_visitor_idx
ON proofing_image_annotations (
  visitor_id
);
