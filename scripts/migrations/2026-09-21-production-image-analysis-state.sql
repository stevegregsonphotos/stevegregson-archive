BEGIN;

ALTER TABLE production_images
  ADD COLUMN IF NOT EXISTS analysis_status text
    NOT NULL DEFAULT 'complete',
  ADD COLUMN IF NOT EXISTS analysed_at timestamptz;

ALTER TABLE production_images
  DROP CONSTRAINT IF EXISTS
    production_images_analysis_status_check;

ALTER TABLE production_images
  ADD CONSTRAINT
    production_images_analysis_status_check
  CHECK (
    analysis_status IN (
      'pending',
      'complete'
    )
  );

COMMIT;
