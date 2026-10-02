-- Page settings edited in Backstage (Selected Work page, Commissions images).
-- lib/site-content-repository.ts creates this automatically on first save;
-- this file is kept for reference.
CREATE TABLE IF NOT EXISTS site_content (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
