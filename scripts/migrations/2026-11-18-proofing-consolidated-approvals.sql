-- Created automatically on first use (lib/proofing/consolidated-repository.ts); kept here for the record.
CREATE TABLE IF NOT EXISTS proofing_consolidated_approvals (
  gallery_id text NOT NULL,
  visitor_id text NOT NULL,
  name text NOT NULL,
  image_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (gallery_id, visitor_id)
);
