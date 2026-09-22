CREATE TABLE IF NOT EXISTS proofing_download_events (
  id uuid PRIMARY KEY,
  gallery_id text NOT NULL,
  visitor_id text NOT NULL,
  visitor_email text NOT NULL,
  download_type text NOT NULL,
  download_permission text NOT NULL,
  image_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  filenames jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_count integer NOT NULL DEFAULT 0,
  archive_filename text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proofing_download_events_type_check
    CHECK (download_type IN ('single', 'archive')),
  CONSTRAINT proofing_download_events_permission_check
    CHECK (
      download_permission IN (
        'none',
        'web',
        'full',
        'selected'
      )
    )
);

CREATE INDEX IF NOT EXISTS
  proofing_download_events_gallery_created_idx
ON proofing_download_events (
  gallery_id,
  created_at DESC
);

CREATE INDEX IF NOT EXISTS
  proofing_download_events_visitor_idx
ON proofing_download_events (
  visitor_id
);
