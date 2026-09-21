ALTER TABLE selected_work_items
  ADD COLUMN IF NOT EXISTS original_display_filename text,
  ADD COLUMN IF NOT EXISTS edit_aspect text NOT NULL DEFAULT 'original',
  ADD COLUMN IF NOT EXISTS edit_zoom double precision NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS edit_pan_x double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS edit_pan_y double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS edit_brightness integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS edit_auto_strength integer NOT NULL DEFAULT 0;
