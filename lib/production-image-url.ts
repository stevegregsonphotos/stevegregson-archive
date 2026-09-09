const DEFAULT_PRODUCTION_IMAGE_BASE_URL =
  "https://images.stevegregson.com";

function safeSegment(
  value: string,
  label: string,
) {
  if (
    !value ||
    value.includes("/") ||
    value.includes("\\") ||
    value === "." ||
    value === ".."
  ) {
    throw new Error(
      `Invalid production image ${label}.`,
    );
  }

  return value;
}

export function getProductionImageUrl(
  productionSlug: string,
  filename: string,
) {
  const baseUrl =
    process.env
      .NEXT_PUBLIC_PRODUCTION_IMAGE_BASE_URL
      ?.trim()
      .replace(/\/+$/, "") ||
    DEFAULT_PRODUCTION_IMAGE_BASE_URL;

  return [
    baseUrl,
    encodeURIComponent(
      safeSegment(
        productionSlug,
        "production slug",
      ),
    ),
    encodeURIComponent(
      safeSegment(
        filename,
        "filename",
      ),
    ),
  ].join("/");
}
