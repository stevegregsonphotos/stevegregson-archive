import JSZip from "jszip";
import sharp from "sharp";

export const runtime = "nodejs";

const MAX_UPLOAD_SIZE = 500 * 1024 * 1024;
const MAX_PREVIEW_IMAGES = 120;

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

type PreviewImage = {
  filename: string;
  filepath: string;
  previewUrl: string;
  width: number | null;
  height: number | null;
  orientation: "landscape" | "portrait" | "square" | "unknown";
  heroScore: number;
};

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

function getOrientation(
  width: number | null,
  height: number | null,
): PreviewImage["orientation"] {
  if (!width || !height) {
    return "unknown";
  }

  const ratio = width / height;

  if (ratio > 1.08) {
    return "landscape";
  }

  if (ratio < 0.92) {
    return "portrait";
  }

  return "square";
}

function calculateHeroScore(
  width: number | null,
  height: number | null,
) {
  if (!width || !height) {
    return 0;
  }

  const ratio = width / height;
  const pixelScore = Math.min((width * height) / 1_000_000, 20);

  // Give landscape photographs a modest advantage because they generally
  // suit the full-width production hero more naturally.
  const landscapeScore =
    ratio >= 1.35 && ratio <= 2.1
      ? 30
      : ratio > 1
        ? 15
        : 0;

  return pixelScore + landscapeScore;
}

async function createPreviewImage(
  zip: JSZip,
  filepath: string,
): Promise<PreviewImage | null> {
  const entry = zip.file(filepath);

  if (!entry) {
    return null;
  }

  try {
    const sourceBuffer = await entry.async("nodebuffer");

    const image = sharp(sourceBuffer, {
      failOn: "none",
    }).rotate();

    const metadata = await image.metadata();

    const width = metadata.width ?? null;
    const height = metadata.height ?? null;

    const thumbnailBuffer = await image
      .clone()
      .resize({
        width: 420,
        height: 300,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 72,
        progressive: true,
      })
      .toBuffer();

    return {
      filename: getFilename(filepath),
      filepath,
      previewUrl: `data:image/jpeg;base64,${thumbnailBuffer.toString(
        "base64",
      )}`,
      width,
      height,
      orientation: getOrientation(width, height),
      heroScore: calculateHeroScore(width, height),
    };
  } catch (error) {
    console.error(`Could not preview ${filepath}:`, error);
    return null;
  }
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

    const imagePaths = allFiles.filter((filepath) =>
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

    const previewPaths = imagePaths.slice(0, MAX_PREVIEW_IMAGES);

    // Process previews one at a time to avoid large bursts of memory usage.
    const previewImages: PreviewImage[] = [];

    for (const filepath of previewPaths) {
      const preview = await createPreviewImage(zip, filepath);

      if (preview) {
        previewImages.push(preview);
      }
    }

    previewImages.sort((a, b) =>
      a.filename.localeCompare(b.filename, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );

    const suggestedHero =
      [...previewImages].sort(
        (a, b) => b.heroScore - a.heroScore,
      )[0] ?? null;

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
        imageCount: imagePaths.length,
        previewCount: previewImages.length,
        previewLimitReached:
          imagePaths.length > MAX_PREVIEW_IMAGES,
        images: previewImages,
        detailsFiles,
        otherFiles,
        suggestedHeroPath: suggestedHero?.filepath ?? null,
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