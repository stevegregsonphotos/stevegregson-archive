import JSZip from "jszip";

export const runtime = "nodejs";

const MAX_UPLOAD_SIZE = 500 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

const DETAILS_EXTENSIONS = new Set([
  ".txt",
  ".rtf",
  ".docx",
  ".pdf",
]);

function getExtension(filename: string) {
  const finalDot = filename.lastIndexOf(".");

  if (finalDot === -1) {
    return "";
  }

  return filename.slice(finalDot).toLowerCase();
}

function getFilename(filepath: string) {
  return filepath.split("/").at(-1) ?? filepath;
}

function createSuggestedSlug(filename: string) {
  return filename
    .replace(/\.zip$/i, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const upload = formData.get("productionArchive");

    if (!(upload instanceof File)) {
      return Response.json(
        {
          ok: false,
          message: "Please choose a ZIP archive.",
        },
        {
          status: 400,
        },
      );
    }

    if (!upload.name.toLowerCase().endsWith(".zip")) {
      return Response.json(
        {
          ok: false,
          message: "The selected file must be a ZIP archive.",
        },
        {
          status: 400,
        },
      );
    }

    if (upload.size === 0) {
      return Response.json(
        {
          ok: false,
          message: "The selected ZIP archive is empty.",
        },
        {
          status: 400,
        },
      );
    }

    if (upload.size > MAX_UPLOAD_SIZE) {
      return Response.json(
        {
          ok: false,
          message: "The ZIP archive is larger than 500 MB.",
        },
        {
          status: 413,
        },
      );
    }

    const archiveBuffer = await upload.arrayBuffer();
    const zip = await JSZip.loadAsync(archiveBuffer);

    const allFiles = Object.values(zip.files)
      .filter((entry) => !entry.dir)
      .filter(
        (entry) =>
          !entry.name.startsWith("__MACOSX/") &&
          !getFilename(entry.name).startsWith("."),
      )
      .map((entry) => entry.name)
      .sort((a, b) =>
        a.localeCompare(b, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );

    const images = allFiles.filter((filepath) =>
      IMAGE_EXTENSIONS.has(getExtension(filepath)),
    );

    const detailsFiles = allFiles.filter((filepath) =>
      DETAILS_EXTENSIONS.has(getExtension(filepath)),
    );

    const otherFiles = allFiles.filter(
      (filepath) =>
        !IMAGE_EXTENSIONS.has(getExtension(filepath)) &&
        !DETAILS_EXTENSIONS.has(getExtension(filepath)),
    );

    return Response.json({
      ok: true,
      message: "Archive inspected successfully.",
      archive: {
        name: upload.name,
        size: upload.size,
        type: upload.type || "application/zip",
        suggestedSlug: createSuggestedSlug(upload.name),
      },
      contents: {
        imageCount: images.length,
        images,
        detailsFiles,
        otherFiles,
      },
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        ok: false,
        message:
          "The ZIP could not be opened. Check that it is a valid archive.",
      },
      {
        status: 500,
      },
    );
  }
}