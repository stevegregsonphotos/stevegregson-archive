BEGIN;

ALTER TABLE productions
  ADD COLUMN IF NOT EXISTS archive_position integer;

ALTER TABLE productions
  DROP CONSTRAINT IF EXISTS productions_archive_position_check;

ALTER TABLE productions
  ADD CONSTRAINT productions_archive_position_check
    CHECK (
      archive_position IS NULL OR
      archive_position >= 0
    );

COMMIT;
