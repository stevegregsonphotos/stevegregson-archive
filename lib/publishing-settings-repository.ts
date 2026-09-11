import { neon } from "@neondatabase/serverless";

import {
  DEFAULT_PUBLISHING_SETTINGS,
  isPublishingSettings,
  type PublishingSettings,
} from "./publishing-settings";

function getSql() {
  const databaseUrl =
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured.",
    );
  }

  return neon(databaseUrl);
}

type PublishingSettingsRow = {
  max_image_size: number;
  output_format: string;
  quality: number;
  preserve_copyright: boolean;
  preserve_photographer: boolean;
  optimise_images: boolean;
  generate_sitemap: boolean;
  generate_structured_data: boolean;
};

function mapPublishingSettings(
  row: PublishingSettingsRow,
): PublishingSettings {
  const settings = {
    maxImageSize:
      row.max_image_size,
    outputFormat:
      row.output_format,
    quality:
      row.quality,
    preserveCopyright:
      row.preserve_copyright,
    preservePhotographer:
      row.preserve_photographer,
    optimiseImages:
      row.optimise_images,
    generateSitemap:
      row.generate_sitemap,
    generateStructuredData:
      row.generate_structured_data,
  };

  if (!isPublishingSettings(settings)) {
    throw new Error(
      "Stored publishing settings are invalid.",
    );
  }

  return settings;
}

export async function getPublishingSettings():
  Promise<PublishingSettings> {
  const sql = getSql();

  const rows = await sql`
    SELECT
      max_image_size,
      output_format,
      quality,
      preserve_copyright,
      preserve_photographer,
      optimise_images,
      generate_sitemap,
      generate_structured_data
    FROM publishing_settings
    WHERE id = 'default'
    LIMIT 1
  `;

  if (!rows[0]) {
    return DEFAULT_PUBLISHING_SETTINGS;
  }

  return mapPublishingSettings(
    rows[0] as PublishingSettingsRow,
  );
}

export async function savePublishingSettings(
  settings: PublishingSettings,
): Promise<PublishingSettings> {
  if (!isPublishingSettings(settings)) {
    throw new Error(
      "Publishing settings are invalid.",
    );
  }

  const sql = getSql();

  await sql`
    INSERT INTO publishing_settings (
      id,
      max_image_size,
      output_format,
      quality,
      preserve_copyright,
      preserve_photographer,
      optimise_images,
      generate_sitemap,
      generate_structured_data,
      version,
      created_at,
      updated_at
    )
    VALUES (
      'default',
      ${settings.maxImageSize},
      ${settings.outputFormat},
      ${settings.quality},
      ${settings.preserveCopyright},
      ${settings.preservePhotographer},
      ${settings.optimiseImages},
      ${settings.generateSitemap},
      ${settings.generateStructuredData},
      1,
      now(),
      now()
    )
    ON CONFLICT (id)
    DO UPDATE SET
      max_image_size =
        EXCLUDED.max_image_size,
      output_format =
        EXCLUDED.output_format,
      quality =
        EXCLUDED.quality,
      preserve_copyright =
        EXCLUDED.preserve_copyright,
      preserve_photographer =
        EXCLUDED.preserve_photographer,
      optimise_images =
        EXCLUDED.optimise_images,
      generate_sitemap =
        EXCLUDED.generate_sitemap,
      generate_structured_data =
        EXCLUDED.generate_structured_data,
      version =
        publishing_settings.version + 1,
      updated_at = now()
  `;

  return getPublishingSettings();
}
