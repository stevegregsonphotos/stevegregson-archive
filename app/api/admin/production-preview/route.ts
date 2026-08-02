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

type GalleryLayout =
  | "wide"
  | "left"
  | "right"
  | "medium"
  | "full"
  | "left-small"
  | "right-small"
  | "wide-left"
  | "wide-right";

type ImageMetrics = {
  resolutionScore: number;
  sharpness: number;
  brightness: number;
  contrast: number;
  entropy: number;
  technicalScore: number;
  duplicateScore: number;
  galleryScore: number;
};

type PreviewImage = {
  filename: string;
  filepath: string;
  previewUrl: string;
  width: number | null;
  height: number | null;
  orientation: "landscape" | "portrait" | "square" | "unknown";
  heroScore: number;
  fingerprint: string;
  metrics: ImageMetrics;
  suggestion: {
    include: boolean;
    order: number | null;
    layout: GalleryLayout;
    duplicateOf: string | null;
    explanation: string[];
  };
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

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundScore(value: number) {
  return Math.round(clamp(value));
}

function calculateEntropy(pixels: Uint8Array) {
  const histogram = new Array<number>(256).fill(0);

  for (const pixel of pixels) {
    histogram[pixel] += 1;
  }

  let entropy = 0;

  for (const count of histogram) {
    if (count === 0) continue;

    const probability = count / pixels.length;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

function calculateSharpness(
  pixels: Uint8Array,
  width: number,
  height: number,
) {
  if (width < 3 || height < 3) return 0;

  const values: number[] = [];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      values.push(
        4 * pixels[index] -
          pixels[index - 1] -
          pixels[index + 1] -
          pixels[index - width] -
          pixels[index + width],
      );
    }
  }

  const mean =
    values.reduce((sum, value) => sum + value, 0) /
    values.length;

  return (
    values.reduce(
      (sum, value) => sum + (value - mean) ** 2,
      0,
    ) / values.length
  );
}

function createDifferenceHash(
  pixels: Uint8Array,
  width: number,
  height: number,
) {
  if (width !== 9 || height !== 8) return "";

  let bits = "";

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      bits +=
        pixels[y * width + x] >
        pixels[y * width + x + 1]
          ? "1"
          : "0";
    }
  }

  return (
    bits
      .match(/.{1,4}/g)
      ?.map((group) =>
        Number.parseInt(group, 2).toString(16),
      )
      .join("") ?? ""
  );
}

function hammingDistance(first: string, second: string) {
  if (!first || !second || first.length !== second.length) {
    return Number.POSITIVE_INFINITY;
  }

  let distance = 0;

  for (let index = 0; index < first.length; index += 1) {
    const xor =
      Number.parseInt(first[index], 16) ^
      Number.parseInt(second[index], 16);

    distance += xor.toString(2).replaceAll("0", "").length;
  }

  return distance;
}

function calculateResolutionScore(
  width: number | null,
  height: number | null,
) {
  if (!width || !height) return 0;

  return roundScore(
    (((width * height) / 1_000_000) / 24) * 100,
  );
}

function calculateTechnicalScore(metrics: {
  resolutionScore: number;
  sharpness: number;
  brightness: number;
  contrast: number;
  entropy: number;
}) {
  const exposureScore =
    100 -
    Math.min(
      Math.abs(metrics.brightness - 50) * 1.5,
      100,
    );

  return roundScore(
    metrics.resolutionScore * 0.16 +
      metrics.sharpness * 0.34 +
      exposureScore * 0.18 +
      metrics.contrast * 0.16 +
      metrics.entropy * 0.16,
  );
}

function calculateHeroScore(
  width: number | null,
  height: number | null,
  technicalScore: number,
  contrast: number,
) {
  if (!width || !height) return 0;

  const ratio = width / height;
  const ratioScore =
    ratio >= 1.45 && ratio <= 2.05
      ? 100
      : ratio > 1.15
        ? 72
        : ratio > 1
          ? 48
          : 12;

  return roundScore(
    ratioScore * 0.48 +
      technicalScore * 0.37 +
      contrast * 0.15,
  );
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

  if (!entry) return null;

  try {
    const sourceBuffer = await entry.async("nodebuffer");

    const orientedBuffer = await sharp(sourceBuffer, {
      failOn: "none",
    })
      .rotate()
      .toBuffer();

    const image = sharp(orientedBuffer, {
      failOn: "none",
    });

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

    const analysis = await image
      .clone()
      .greyscale()
      .resize({
        width: 96,
        height: 96,
        fit: "fill",
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8Array(analysis.data);

    const mean =
      pixels.reduce((sum, value) => sum + value, 0) /
      pixels.length;

    const variance =
      pixels.reduce(
        (sum, value) => sum + (value - mean) ** 2,
        0,
      ) / pixels.length;

    const brightness = roundScore((mean / 255) * 100);
    const contrast = roundScore(
      (Math.sqrt(variance) / 72) * 100,
    );
    const entropy = roundScore(
      (calculateEntropy(pixels) / 8) * 100,
    );
    const sharpness = roundScore(
      (Math.log10(
        calculateSharpness(
          pixels,
          analysis.info.width,
          analysis.info.height,
        ) + 1,
      ) /
        4.2) *
        100,
    );
    const resolutionScore =
      calculateResolutionScore(width, height);

    const technicalScore = calculateTechnicalScore({
      resolutionScore,
      sharpness,
      brightness,
      contrast,
      entropy,
    });

    const hash = await image
      .clone()
      .greyscale()
      .resize({
        width: 9,
        height: 8,
        fit: "fill",
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const fingerprint = createDifferenceHash(
      new Uint8Array(hash.data),
      hash.info.width,
      hash.info.height,
    );

    const heroScore = calculateHeroScore(
      width,
      height,
      technicalScore,
      contrast,
    );

    return {
      filename: getFilename(filepath),
      filepath,
      previewUrl: `data:image/jpeg;base64,${thumbnailBuffer.toString(
        "base64",
      )}`,
      width,
      height,
      orientation: getOrientation(width, height),
      heroScore,
      fingerprint,
      metrics: {
        resolutionScore,
        sharpness,
        brightness,
        contrast,
        entropy,
        technicalScore,
        duplicateScore: 0,
        galleryScore: technicalScore,
      },
      suggestion: {
        include: true,
        order: null,
        layout: "wide",
        duplicateOf: null,
        explanation: [],
      },
    };
  } catch (error) {
    console.error(`Could not preview ${filepath}:`, error);
    return null;
  }
}

function curateImages(images: PreviewImage[]) {
  const ranked = [...images].sort(
    (a, b) =>
      b.metrics.technicalScore -
      a.metrics.technicalScore,
  );

  for (let index = 0; index < ranked.length; index += 1) {
    const image = ranked[index];

    for (
      let comparisonIndex = 0;
      comparisonIndex < index;
      comparisonIndex += 1
    ) {
      const comparison = ranked[comparisonIndex];
      const distance = hammingDistance(
        image.fingerprint,
        comparison.fingerprint,
      );

      if (distance <= 8) {
        image.suggestion.duplicateOf =
          comparison.filepath;
        image.metrics.duplicateScore = roundScore(
          100 - (distance / 8) * 100,
        );
        break;
      }
    }
  }

  const available = ranked.filter(
    (image) => !image.suggestion.duplicateOf,
  );

  const targetCount = Math.min(
    24,
    Math.max(8, Math.round(available.length * 0.55)),
  );

  const selected = available
    .map((image) => {
      image.metrics.galleryScore = roundScore(
        image.metrics.technicalScore * 0.72 +
          image.heroScore * 0.23 +
          (image.orientation === "portrait" ? 5 : 0),
      );

      return image;
    })
    .sort(
      (a, b) =>
        b.metrics.galleryScore -
        a.metrics.galleryScore,
    )
    .slice(0, targetCount);

  const selectedPaths = new Set(
    selected.map((image) => image.filepath),
  );

  selected.forEach((image, index) => {
    image.suggestion.include = true;
    image.suggestion.order = index + 1;

    if (image.orientation === "portrait") {
      image.suggestion.layout =
        index % 2 === 0 ? "left" : "right";
    } else if (image.orientation === "square") {
      image.suggestion.layout = "medium";
    } else {
      const layouts: GalleryLayout[] = [
        "wide",
        "wide-left",
        "wide-right",
        "full",
      ];
      image.suggestion.layout =
        layouts[index % layouts.length];
    }

    image.suggestion.explanation = [
      image.metrics.sharpness >= 70
        ? "Strong technical sharpness"
        : "Acceptable technical sharpness",
      image.metrics.contrast >= 55
        ? "Strong tonal separation"
        : "Moderate tonal separation",
      "Selected for the suggested gallery edit",
    ];
  });

  images
    .filter((image) => !selectedPaths.has(image.filepath))
    .forEach((image) => {
      image.suggestion.include = false;
      image.suggestion.order = null;
      image.suggestion.explanation = image.suggestion.duplicateOf
        ? [
            `Visually similar to ${getFilename(
              image.suggestion.duplicateOf,
            )}`,
          ]
        : ["Lower local gallery score"];
    });

  return {
    selectedCount: selected.length,
    excludedCount: images.length - selected.length,
    duplicateCount: images.filter(
      (image) => Boolean(image.suggestion.duplicateOf),
    ).length,
    selectedPaths: selected.map((image) => image.filepath),
  };
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

    const curation = curateImages(previewImages);

    const suggestedHero =
      [...previewImages].sort(
        (a, b) =>
          b.heroScore - a.heroScore,
      )[0] ?? null;

    return Response.json({
      ok: true,
      message:
        "Archive inspected and locally curated successfully.",
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
        curation,
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