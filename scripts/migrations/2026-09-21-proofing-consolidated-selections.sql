CREATE TABLE IF NOT EXISTS proofing_consolidated_selections (
  id uuid PRIMARY KEY,
  gallery_id text NOT NULL,
  title text NOT NULL DEFAULT 'Consolidated favourites from all participants',
  visible boolean NOT NULL DEFAULT false,
  definitive_image_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS
  proofing_consolidated_selections_gallery_id_key
ON proofing_consolidated_selections (gallery_id);

CREATE TABLE IF NOT EXISTS proofing_consolidated_participants (
  id uuid PRIMARY KEY,
  consolidated_selection_id uuid NOT NULL,
  visitor_id text NOT NULL,
  public_label text,
  image_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proofing_consolidated_participants_selection_fkey
    FOREIGN KEY (consolidated_selection_id)
    REFERENCES proofing_consolidated_selections(id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS
  proofing_consolidated_participants_selection_visitor_key
ON proofing_consolidated_participants (
  consolidated_selection_id,
  visitor_id
);
