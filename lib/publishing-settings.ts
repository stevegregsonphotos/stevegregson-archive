export type PublishingSettings = {
  maxImageSize: number;
  outputFormat: "webp";
  quality: number;
  preserveCopyright: boolean;
  preservePhotographer: boolean;
  optimiseImages: boolean;
  generateSitemap: boolean;
  generateStructuredData: boolean;
};

export const DEFAULT_PUBLISHING_SETTINGS: PublishingSettings = {
  maxImageSize: 2048,
  outputFormat: "webp",
  quality: 85,
  preserveCopyright: true,
  preservePhotographer: true,
  optimiseImages: true,
  generateSitemap: true,
  generateStructuredData: true,
};

export function isPublishingSettings(
  value: unknown,
): value is PublishingSettings {
  if (!value || typeof value !== "object") {
    return false;
  }

  const settings = value as Record<string, unknown>;

  return (
    Number.isInteger(settings.maxImageSize) &&
    Number(settings.maxImageSize) >= 800 &&
    Number(settings.maxImageSize) <= 4096 &&
    settings.outputFormat === "webp" &&
    Number.isInteger(settings.quality) &&
    Number(settings.quality) >= 50 &&
    Number(settings.quality) <= 100 &&
    typeof settings.preserveCopyright === "boolean" &&
    typeof settings.preservePhotographer === "boolean" &&
    typeof settings.optimiseImages === "boolean" &&
    typeof settings.generateSitemap === "boolean" &&
    typeof settings.generateStructuredData === "boolean"
  );
}
