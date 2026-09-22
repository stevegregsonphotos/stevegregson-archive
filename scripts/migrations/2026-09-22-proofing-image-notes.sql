CREATE UNIQUE INDEX IF NOT EXISTS
  proofing_images_gallery_id_image_id_key
ON proofing_images (
  gallery_id,
  id
);

CREATE TABLE IF NOT EXISTS proofing_image_notes (
  id uuid PRIMARY KEY,
  gallery_id text NOT NULL,
  visitor_id text NOT NULL,
  image_id text NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proofing_image_notes_image_fkey
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
  proofing_image_notes_gallery_visitor_image_key
ON proofing_image_notes (
  gallery_id,
  visitor_id,
  image_id
);

CREATE INDEX IF NOT EXISTS
  proofing_image_notes_gallery_updated_idx
ON proofing_image_notes (
  gallery_id,
  updated_at DESC
);

CREATE INDEX IF NOT EXISTS
  proofing_image_notes_visitor_idx
ON proofing_image_notes (
  visitor_id
);
