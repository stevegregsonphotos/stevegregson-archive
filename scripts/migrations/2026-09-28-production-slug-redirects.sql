BEGIN;

CREATE TABLE production_slug_redirects (
  id uuid PRIMARY KEY,
  production_id uuid NOT NULL
    REFERENCES productions(id)
    ON DELETE CASCADE,
  old_slug text NOT NULL,
  created_at timestamptz NOT NULL
    DEFAULT now()
);

CREATE UNIQUE INDEX production_slug_redirects_old_slug_lower_unique
  ON production_slug_redirects (lower(old_slug));

CREATE INDEX production_slug_redirects_production_id_idx
  ON production_slug_redirects (production_id);

COMMIT;
