CREATE TABLE IF NOT EXISTS curated_archive_overrides (
  production text PRIMARY KEY,
  access text,
  curated_override jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curated_archive_overrides_access_check
    CHECK (
      access IS NULL OR
      access IN ('public', 'password')
    )
);

CREATE INDEX IF NOT EXISTS curated_archive_overrides_updated_at_idx
ON curated_archive_overrides (updated_at);
