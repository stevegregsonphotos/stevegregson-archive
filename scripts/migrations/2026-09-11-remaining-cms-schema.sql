BEGIN;

CREATE TABLE selected_work_items (
  id uuid PRIMARY KEY,
  category text NOT NULL,
  storage_key text NOT NULL,
  display_filename text NOT NULL,
  suggested_filename text,
  alt text NOT NULL,
  uploaded_at timestamptz NOT NULL,
  width integer,
  height integer,
  analysis_status text NOT NULL,
  analysed_at timestamptz,
  position integer NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT selected_work_category_check
    CHECK (
      category IN (
        'production',
        'rehearsal',
        'campaign'
      )
    ),

  CONSTRAINT selected_work_analysis_status_check
    CHECK (
      analysis_status IN (
        'pending',
        'complete'
      )
    ),

  CONSTRAINT selected_work_width_check
    CHECK (
      width IS NULL OR width > 0
    ),

  CONSTRAINT selected_work_height_check
    CHECK (
      height IS NULL OR height > 0
    ),

  CONSTRAINT selected_work_position_check
    CHECK (position >= 0),

  CONSTRAINT selected_work_version_check
    CHECK (version >= 1)
);

CREATE UNIQUE INDEX selected_work_storage_key_unique
  ON selected_work_items (storage_key)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX selected_work_category_position_unique
  ON selected_work_items (category, position)
  WHERE deleted_at IS NULL;

CREATE INDEX selected_work_category_idx
  ON selected_work_items (category);


CREATE TABLE directory_venues (
  id uuid PRIMARY KEY,
  display_name text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX directory_venues_name_unique
  ON directory_venues (lower(display_name))
  WHERE deleted_at IS NULL;


CREATE TABLE directory_companies (
  id uuid PRIMARY KEY,
  display_name text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX directory_companies_name_unique
  ON directory_companies (lower(display_name))
  WHERE deleted_at IS NULL;


CREATE TABLE directory_people (
  id uuid PRIMARY KEY,
  display_name text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX directory_people_name_unique
  ON directory_people (lower(display_name))
  WHERE deleted_at IS NULL;


CREATE TABLE publishing_settings (
  id text PRIMARY KEY,
  max_image_size integer NOT NULL,
  output_format text NOT NULL,
  quality integer NOT NULL,
  preserve_copyright boolean NOT NULL,
  preserve_photographer boolean NOT NULL,
  optimise_images boolean NOT NULL,
  generate_sitemap boolean NOT NULL,
  generate_structured_data boolean NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT publishing_settings_singleton_check
    CHECK (id = 'default'),

  CONSTRAINT publishing_settings_image_size_check
    CHECK (
      max_image_size BETWEEN 800 AND 4096
    ),

  CONSTRAINT publishing_settings_format_check
    CHECK (output_format = 'webp'),

  CONSTRAINT publishing_settings_quality_check
    CHECK (quality BETWEEN 50 AND 100),

  CONSTRAINT publishing_settings_version_check
    CHECK (version >= 1)
);

COMMIT;
