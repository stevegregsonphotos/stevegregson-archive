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

type ExtractedProductionFields = {
  title: string;
  venue: string;
  year: string;
  director: string;
  associateDirector: string;
  musicalDirector: string;
  choreographer: string;
  lightingDesign: string;
  setDesign: string;
  costumeDesign: string;
  setCostumeDesign: string;
  soundDesign: string;
  commissionedBy: string;
  description: string;
};

type ExtractedProductionDetails = {
  sourceFile: string | null;
  fields: ExtractedProductionFields;
  plainText: string;
};

const DETAIL_LABELS: Record<
  string,
  keyof ExtractedProductionFields
> = {
  production: "title",
  title: "title",
  venue: "venue",
  theatre: "venue",
  year: "year",
  director: "director",
  "associate director": "associateDirector",
  "musical director": "musicalDirector",
  choreographer: "choreographer",
  lighting: "lightingDesign",
  "lighting design": "lightingDesign",
  "lighting designer": "lightingDesign",
  "set design": "setDesign",
  "set designer": "setDesign",
  "costume design": "costumeDesign",
  "costume designer": "costumeDesign",
  "set & costume design": "setCostumeDesign",
  "set and costume design": "setCostumeDesign",
  "sound design": "soundDesign",
  "sound designer": "soundDesign",
  "commissioned by": "commissionedBy",
  description: "description",
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
  const pixelScore = Math.min(
    (width * height) / 1_000_000,
    20,
  );

  const landscapeScore =
    ratio >= 1.35 && ratio <= 2.1
      ? 30
      : ratio > 1
        ? 15
        : 0;

  return pixelScore + landscapeScore;
}

function emptyExtractedFields(): ExtractedProductionFields {
  return {
    title: "",
    venue: "",
    year: "",
    director: "",
    associateDirector: "",
    musicalDirector: "",
    choreographer: "",
    lightingDesign: "",
    setDesign: "",
    costumeDesign: "",
    setCostumeDesign: "",
    soundDesign: "",
    commissionedBy: "",
    description: "",
  };
}

function decodeWindows1252Byte(hex: string) {
  const byte = Number.parseInt(hex, 16);

  return new TextDecoder("windows-1252").decode(
    Uint8Array.from([byte]),
  );
}

function normaliseLabel(value: string) {
  return value
    .replace(/:$/, "")
    .replace(/\.$/, "")
    .trim()
    .toLowerCase();
}

function cleanExtractedValue(value: string) {
  return value
    .trim()
    .replace(/\s+\.$/, ".")
    .replace(/\.$/, "")
    .trim();
}

function rtfToPlainText(rtf: string) {
  let text = rtf;

  text = text.replace(
    /\{\\(?:fonttbl|colortbl|expandedcolortbl|stylesheet|info)[\s\S]*?\}(?=\s*\{|\s*\\|\s*$)/gi,
    "",
  );

  text = text.replace(
    /\\'([0-9a-f]{2})/gi,
    (_, hex: string) => decodeWindows1252Byte(hex),
  );

  text = text.replace(
    /\\u(-?\d+)\??/g,
    (_, value: string) => {
      const number = Number.parseInt(value, 10);
      const codePoint =
        number < 0 ? number + 65536 : number;

      return String.fromCharCode(codePoint);
    },
  );

  text = text
  .replace(/\\par(?=[\\\s{}]|$)/gi, "\n")
  .replace(/\\line(?=[\\\s{}]|$)/gi, "\n")
  .replace(/\\tab(?=[\\\s{}]|$)/gi, "\t")
  .replace(/\\\{/g, "{")
  .replace(/\\\}/g, "}")
  .replace(/\\\\/g, "\\");

  text = text.replace(/\\\r?\n/g, "\n");

  text = text
    .replace(/\\[a-z]+-?\d*\s?/gi, "")
    .replace(/[{}]/g, "");

  const lines = text
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);

  const firstLabelIndex = lines.findIndex((line) => {
    return Boolean(
      DETAIL_LABELS[normaliseLabel(line)],
    );
  });

  return (
    firstLabelIndex >= 0
      ? lines.slice(firstLabelIndex)
      : lines
  ).join("\n");
}

function parseLabelledDetails(
  plainText: string,
): ExtractedProductionFields {
  const fields = emptyExtractedFields();

  const lines = plainText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let activeField:
    | keyof ExtractedProductionFields
    | null = null;

  for (const line of lines) {
    const inlineMatch = line.match(
      /^([^:]{2,60}):\s*(.+)$/,
    );

    if (inlineMatch) {
      const [, rawLabel, rawValue] = inlineMatch;
      const matchingField =
        DETAIL_LABELS[normaliseLabel(rawLabel)];

      if (matchingField) {
        const value = cleanExtractedValue(rawValue);

        if (
          matchingField === "description" &&
          fields.description
        ) {
          fields.description =
            `${fields.description} ${value}`;
        } else if (!fields[matchingField]) {
          fields[matchingField] = value;
        }

        activeField = null;
        continue;
      }
    }

    const matchingField =
      DETAIL_LABELS[normaliseLabel(line)];

    if (matchingField) {
      activeField = matchingField;
      continue;
    }

    if (!activeField) {
      continue;
    }

    const value = cleanExtractedValue(line);

    if (!value) {
      continue;
    }

    if (
      activeField === "description" &&
      fields.description
    ) {
      fields.description =
        `${fields.description} ${value}`;
    } else if (!fields[activeField]) {
      fields[activeField] = value;
    }

    if (activeField !== "description") {
      activeField = null;
    }
  }

  return fields;
}

async function extractRtfDetails(
  zip: JSZip,
  detailsFiles: string[],
): Promise<ExtractedProductionDetails> {
  const preferredFile =
    detailsFiles.find((filepath) =>
      /(^|\/)details?\.rtf$/i.test(filepath),
    ) ??
    detailsFiles.find((filepath) =>
      filepath.toLowerCase().endsWith(".rtf"),
    ) ??
    null;

  if (!preferredFile) {
    return {
      sourceFile: null,
      fields: emptyExtractedFields(),
      plainText: "",
    };
  }

  const entry = zip.file(preferredFile);

  if (!entry) {
    return {
      sourceFile: null,
      fields: emptyExtractedFields(),
      plainText: "",
    };
  }

  const rawRtf = await entry.async("string");
  const plainText = rtfToPlainText(rawRtf);

  return {
    sourceFile: preferredFile,
    fields: parseLabelledDetails(plainText),
    plainText,
  };
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
    const sourceBuffer =
      await entry.async("nodebuffer");

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
    console.error(
      `Could not preview ${filepath}:`,
      error,
    );

    return null;
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const upload = formData.get(
      "productionArchive",
    );

    if (!(upload instanceof File)) {
      return Response.json(
        {
          ok: false,
          message:
            "Please choose a ZIP archive.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !upload.name
        .toLowerCase()
        .endsWith(".zip")
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "The selected file must be a ZIP archive.",
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
          message:
            "The selected ZIP archive is empty.",
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
          message:
            "The ZIP archive is larger than 500 MB.",
        },
        {
          status: 413,
        },
      );
    }

    const archiveBuffer =
      await upload.arrayBuffer();

    const zip =
      await JSZip.loadAsync(archiveBuffer);

    const allFiles = Object.values(zip.files)
      .filter((entry) => !entry.dir)
      .filter(
        (entry) =>
          !entry.name.startsWith(
            "__MACOSX/",
          ) &&
          !getFilename(
            entry.name,
          ).startsWith("."),
      )
      .map((entry) => entry.name)
      .sort((a, b) =>
        a.localeCompare(b, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );

    const imagePaths = allFiles.filter(
      (filepath) =>
        IMAGE_EXTENSIONS.has(
          getExtension(filepath),
        ),
    );

    const detailsFiles = allFiles.filter(
      (filepath) =>
        DETAILS_EXTENSIONS.has(
          getExtension(filepath),
        ),
    );

    const otherFiles = allFiles.filter(
      (filepath) =>
        !IMAGE_EXTENSIONS.has(
          getExtension(filepath),
        ) &&
        !DETAILS_EXTENSIONS.has(
          getExtension(filepath),
        ),
    );

    const extractedDetails =
      await extractRtfDetails(
        zip,
        detailsFiles,
      );

    const previewPaths = imagePaths.slice(
      0,
      MAX_PREVIEW_IMAGES,
    );

    const previewImages: PreviewImage[] = [];

    for (const filepath of previewPaths) {
      const preview =
        await createPreviewImage(
          zip,
          filepath,
        );

      if (preview) {
        previewImages.push(preview);
      }
    }

    previewImages.sort((a, b) =>
      a.filename.localeCompare(
        b.filename,
        undefined,
        {
          numeric: true,
          sensitivity: "base",
        },
      ),
    );

    const suggestedHero =
      [...previewImages].sort(
        (a, b) =>
          b.heroScore - a.heroScore,
      )[0] ?? null;

    return Response.json({
      ok: true,
      message:
        "Archive inspected successfully.",
      archive: {
        name: upload.name,
        size: upload.size,
        type:
          upload.type ||
          "application/zip",
        suggestedSlug:
          createSuggestedSlug(
            upload.name,
          ),
      },
      contents: {
        imageCount: imagePaths.length,
        previewCount:
          previewImages.length,
        previewLimitReached:
          imagePaths.length >
          MAX_PREVIEW_IMAGES,
        images: previewImages,
        detailsFiles,
        otherFiles,
        suggestedHeroPath:
          suggestedHero?.filepath ??
          null,
        extractedDetails,
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