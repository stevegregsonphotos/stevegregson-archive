BEGIN;

CREATE TABLE productions (
  id uuid PRIMARY KEY,
  slug text NOT NULL,
  title text NOT NULL,
  venue text NOT NULL,
  month integer,
  year integer NOT NULL,
  description text NOT NULL,
  access text NOT NULL DEFAULT 'public',
  show_hero_when_locked boolean,
  access_password_encrypted text,
  hero_storage_key text NOT NULL,
  hero_display_filename text NOT NULL,
  hero_alt text NOT NULL,
  hero_blur_data_url text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT productions_month_check
    CHECK (month IS NULL OR month BETWEEN 1 AND 12),

  CONSTRAINT productions_access_check
    CHECK (access IN ('public', 'password')),

  CONSTRAINT productions_version_check
    CHECK (version >= 1)
);

CREATE UNIQUE INDEX productions_slug_lower_unique
  ON productions (lower(slug))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX productions_hero_storage_key_unique
  ON productions (hero_storage_key)
  WHERE deleted_at IS NULL;


CREATE TABLE production_credits (
  id uuid PRIMARY KEY,
  production_id uuid NOT NULL
    REFERENCES productions(id)
    ON DELETE CASCADE,
  role text NOT NULL,
  name text NOT NULL,
  website text,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT production_credits_position_check
    CHECK (position >= 0)
);

CREATE UNIQUE INDEX production_credits_position_unique
  ON production_credits (production_id, position)
  WHERE deleted_at IS NULL;

CREATE INDEX production_credits_production_id_idx
  ON production_credits (production_id);


CREATE TABLE production_images (
  id uuid PRIMARY KEY,
  production_id uuid NOT NULL
    REFERENCES productions(id)
    ON DELETE CASCADE,
  storage_key text NOT NULL,
  display_filename text NOT NULL,
  alt text NOT NULL,
  layout text NOT NULL,
  position integer NOT NULL,
  blur_data_url text,
  suggested_filename text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT production_images_layout_check
    CHECK (
      layout IN (
        'wide',
        'left',
        'right',
        'medium',
        'full',
        'left-small',
        'right-small',
        'wide-left',
        'wide-right'
      )
    ),

  CONSTRAINT production_images_position_check
    CHECK (position >= 0)
);

CREATE UNIQUE INDEX production_images_storage_key_unique
  ON production_images (storage_key)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX production_images_position_unique
  ON production_images (production_id, position)
  WHERE deleted_at IS NULL;

CREATE INDEX production_images_production_id_idx
  ON production_images (production_id);

COMMIT;
