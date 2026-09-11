const DEFAULT_SELECTED_WORK_IMAGE_BASE_URL =
  "https://selected-work-images.stevegregson.com";

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
      `Invalid Selected Work image ${label}.`,
    );
  }

  return value;
}

export function getSelectedWorkImageUrl(
  category: string,
  filename: string,
) {
  const baseUrl =
    process.env
      .NEXT_PUBLIC_SELECTED_WORK_IMAGE_BASE_URL
      ?.trim()
      .replace(/\/+$/, "") ||
    DEFAULT_SELECTED_WORK_IMAGE_BASE_URL;

  return [
    baseUrl,
    "selected-work",
    encodeURIComponent(
      safeSegment(
        category,
        "category",
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
