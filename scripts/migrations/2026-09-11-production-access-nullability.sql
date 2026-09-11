BEGIN;

ALTER TABLE productions
  ALTER COLUMN access DROP NOT NULL,
  ALTER COLUMN access DROP DEFAULT;

ALTER TABLE productions
  DROP CONSTRAINT productions_access_check;

ALTER TABLE productions
  ADD CONSTRAINT productions_access_check
    CHECK (
      access IS NULL OR
      access IN ('public', 'password')
    );

COMMIT;
