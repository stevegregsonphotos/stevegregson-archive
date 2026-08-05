import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";

import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CategoryId =
  | "production"
  | "rehearsal"
  | "campaign";

type SelectedWorkImage = {
  filename: string;
  suggestedFilename?: string;
  alt: string;
  uploadedAt: string;
  width?: number;
  height?: number;
};

type SelectedWorkData = Record<
  CategoryId,
  SelectedWorkImage[]
>;

type ImageDimensions = {
  width: number;
  height: number;
};

const EMPTY_DATA: SelectedWorkData = {
  production: [],
  rehearsal: [],
  campaign: [],
};

function isCategory(
  value: unknown,
): value is CategoryId {
  return (
    value === "production" ||
    value === "rehearsal" ||
    value === "campaign"
  );
}

function isSafeFilename(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g)$/i.test(
    value,
  );
}

function isPositiveInteger(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
  );
}

function cleanBaseName(filename: string) {
  const extension =
    path.extname(filename).toLowerCase() || ".jpg";

  const base =
    path
      .basename(filename, extension)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    "selected-work-image";

  return {
    base,
    extension:
      extension === ".jpeg" ? ".jpg" : extension,
  };
}

function normaliseSuggestedFilename(
  suggestedFilename: string,
  originalFilename: string,
) {
  const originalExtension =
    path.extname(originalFilename).toLowerCase() ||
    ".jpg";

  const { base } = cleanBaseName(
    suggestedFilename,
  );

  const extension =
    originalExtension === ".jpeg"
      ? ".jpg"
      : originalExtension;

  return `${base}${extension}`;
}

function readJpegDimensions(
  bytes: Buffer,
): ImageDimensions {
  if (
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8
  ) {
    throw new Error("The file is not a valid JPEG.");
  }

  const startOfFrameMarkers = new Set([
    0xc0,
    0xc1,
    0xc2,
    0xc3,
    0xc5,
    0xc6,
    0xc7,
    0xc9,
    0xca,
    0xcb,
    0xcd,
    0xce,
    0xcf,
  ]);

  let offset = 2;

  while (offset < bytes.length) {
    while (
      offset < bytes.length &&
      bytes[offset] !== 0xff
    ) {
      offset += 1;
    }

    while (
      offset < bytes.length &&
      bytes[offset] === 0xff
    ) {
      offset += 1;
    }

    if (offset >= bytes.length) {
      break;
    }

    const marker = bytes[offset];
    offset += 1;

    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      continue;
    }

    if (offset + 1 >= bytes.length) {
      break;
    }

    const segmentLength =
      bytes.readUInt16BE(offset);

    if (
      segmentLength < 2 ||
      offset + segmentLength > bytes.length
    ) {
      break;
    }

    if (startOfFrameMarkers.has(marker)) {
      if (segmentLength < 7) {
        break;
      }

      const height =
        bytes.readUInt16BE(offset + 3);
      const width =
        bytes.readUInt16BE(offset + 5);

      if (width > 0 && height > 0) {
        return {
          width,
          height,
        };
      }

      break;
    }

    offset += segmentLength;
  }

  throw new Error(
    "The JPEG dimensions could not be read.",
  );
}

function projectPaths() {
  const root = process.cwd();

  return {
    dataFile: path.join(
      root,
      "content",
      "selected-work.json",
    ),
    imageRoot: path.join(
      root,
      "public",
      "images",
      "selected-work",
    ),
  };
}

async function ensureStorage() {
  const { dataFile, imageRoot } = projectPaths();

  await mkdir(path.dirname(dataFile), {
    recursive: true,
  });

  await mkdir(imageRoot, {
    recursive: true,
  });

  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeFile(
      dataFile,
      `${JSON.stringify(
        EMPTY_DATA,
        null,
        2,
      )}\n`,
      "utf8",
    );
  }
}

async function readData(): Promise<SelectedWorkData> {
  await ensureStorage();

  const { dataFile } = projectPaths();
  const source = await readFile(
    dataFile,
    "utf8",
  );

  const parsed =
    JSON.parse(source) as Partial<SelectedWorkData>;

  return {
    production: Array.isArray(
      parsed.production,
    )
      ? parsed.production
      : [],
    rehearsal: Array.isArray(
      parsed.rehearsal,
    )
      ? parsed.rehearsal
      : [],
    campaign: Array.isArray(parsed.campaign)
      ? parsed.campaign
      : [],
  };
}

async function writeData(
  data: SelectedWorkData,
) {
  const { dataFile } = projectPaths();

  await writeFile(
    dataFile,
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8",
  );
}

async function fileExists(filePath: string) {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

async function uniqueFilename(
  categoryDirectory: string,
  originalName: string,
  currentFilename?: string,
) {
  const { base, extension } =
    cleanBaseName(originalName);

  let candidate = `${base}${extension}`;
  let counter = 2;

  while (true) {
    if (candidate === currentFilename) {
      return candidate;
    }

    const candidatePath = path.join(
      categoryDirectory,
      candidate,
    );

    if (!(await fileExists(candidatePath))) {
      return candidate;
    }

    candidate = `${base}-${counter}${extension}`;
    counter += 1;
  }
}

async function dimensionsFromFile(
  filePath: string,
): Promise<ImageDimensions> {
  const bytes = await readFile(filePath);
  return readJpegDimensions(bytes);
}

export async function GET() {
  try {
    const data = await readData();

    return Response.json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error(
      "Selected Work load failed:",
      error,
    );

    return Response.json(
      {
        ok: false,
        message:
          "Selected Work could not be loaded.",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
) {
  try {
    const formData =
      await request.formData();

    const category =
      formData.get("category");

    if (!isCategory(category)) {
      return Response.json(
        {
          ok: false,
          message:
            "A valid Selected Work category is required.",
        },
        { status: 400 },
      );
    }

    const files = formData
      .getAll("images")
      .filter(
        (value): value is File =>
          value instanceof File &&
          value.size > 0,
      );

    if (files.length === 0) {
      return Response.json(
        {
          ok: false,
          message:
            "Choose at least one JPEG photograph.",
        },
        { status: 400 },
      );
    }

    const invalidFile = files.find(
      (file) =>
        file.type !== "image/jpeg" ||
        !/\.(?:jpe?g)$/i.test(file.name),
    );

    if (invalidFile) {
      return Response.json(
        {
          ok: false,
          message: `${invalidFile.name} is not a JPEG photograph.`,
        },
        { status: 400 },
      );
    }

    const data = await readData();
    const { imageRoot } = projectPaths();

    const categoryDirectory = path.join(
      imageRoot,
      category,
    );

    await mkdir(categoryDirectory, {
      recursive: true,
    });

    const uploaded: SelectedWorkImage[] =
      [];

    for (const file of files) {
      const filename = await uniqueFilename(
        categoryDirectory,
        file.name,
      );

      const bytes = Buffer.from(
        await file.arrayBuffer(),
      );

      let dimensions: ImageDimensions;

      try {
        dimensions =
          readJpegDimensions(bytes);
      } catch {
        return Response.json(
          {
            ok: false,
            message: `${file.name} does not contain readable JPEG dimensions.`,
          },
          { status: 400 },
        );
      }

      await writeFile(
        path.join(
          categoryDirectory,
          filename,
        ),
        bytes,
      );

      uploaded.push({
        filename,
        suggestedFilename: "",
        alt: "",
        uploadedAt:
          new Date().toISOString(),
        width: dimensions.width,
        height: dimensions.height,
      });
    }

    data[category] = [
      ...data[category],
      ...uploaded,
    ];

    await writeData(data);

    return Response.json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error(
      "Selected Work upload failed:",
      error,
    );

    return Response.json(
      {
        ok: false,
        message:
          "The photographs could not be uploaded.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
) {
  try {
    const body =
      (await request.json()) as {
        category?: unknown;
        images?: unknown;
      };

    if (
      !isCategory(body.category) ||
      !Array.isArray(body.images)
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "A valid collection is required.",
        },
        { status: 400 },
      );
    }

    const submittedImages: SelectedWorkImage[] =
      [];

    for (const value of body.images) {
      if (
        !value ||
        typeof value !== "object" ||
        !("filename" in value) ||
        !("alt" in value) ||
        !("uploadedAt" in value) ||
        typeof value.filename !== "string" ||
        typeof value.alt !== "string" ||
        typeof value.uploadedAt !==
          "string" ||
        !isSafeFilename(value.filename)
      ) {
        return Response.json(
          {
            ok: false,
            message:
              "The collection contains invalid image data.",
          },
          { status: 400 },
        );
      }

      const suggestedFilename =
        "suggestedFilename" in value &&
        typeof value.suggestedFilename ===
          "string"
          ? value.suggestedFilename.trim()
          : "";

      const width =
        "width" in value &&
        isPositiveInteger(value.width)
          ? value.width
          : undefined;

      const height =
        "height" in value &&
        isPositiveInteger(value.height)
          ? value.height
          : undefined;

      submittedImages.push({
        filename: value.filename,
        suggestedFilename,
        alt: value.alt.trim(),
        uploadedAt: value.uploadedAt,
        width,
        height,
      });
    }

    const data = await readData();
    const { imageRoot } = projectPaths();

    const categoryDirectory = path.join(
      imageRoot,
      body.category,
    );

    await mkdir(categoryDirectory, {
      recursive: true,
    });

    const existingImages =
      data[body.category];

    const savedImages: SelectedWorkImage[] =
      [];

    for (const image of submittedImages) {
      const currentPath = path.join(
        categoryDirectory,
        image.filename,
      );

      if (!(await fileExists(currentPath))) {
        return Response.json(
          {
            ok: false,
            message: `${image.filename} could not be found.`,
          },
          { status: 404 },
        );
      }

      let finalFilename = image.filename;

      if (image.suggestedFilename) {
        const normalisedSuggestion =
          normaliseSuggestedFilename(
            image.suggestedFilename,
            image.filename,
          );

        finalFilename =
          await uniqueFilename(
            categoryDirectory,
            normalisedSuggestion,
            image.filename,
          );

        if (
          finalFilename !== image.filename
        ) {
          await rename(
            currentPath,
            path.join(
              categoryDirectory,
              finalFilename,
            ),
          );
        }
      }

      const existingImage =
        existingImages.find(
          (existing) =>
            existing.filename ===
            image.filename,
        );

      let width =
        image.width ??
        existingImage?.width;

      let height =
        image.height ??
        existingImage?.height;

      if (
        !isPositiveInteger(width) ||
        !isPositiveInteger(height)
      ) {
        const dimensions =
          await dimensionsFromFile(
            path.join(
              categoryDirectory,
              finalFilename,
            ),
          );

        width = dimensions.width;
        height = dimensions.height;
      }

      savedImages.push({
        filename: finalFilename,
        suggestedFilename: "",
        alt: image.alt,
        uploadedAt: image.uploadedAt,
        width,
        height,
      });
    }

    data[body.category] = savedImages;

    await writeData(data);

    return Response.json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error(
      "Selected Work save failed:",
      error,
    );

    return Response.json(
      {
        ok: false,
        message:
          "The collection could not be saved.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
) {
  try {
    const body =
      (await request.json()) as {
        category?: unknown;
        filename?: unknown;
      };

    if (
      !isCategory(body.category) ||
      typeof body.filename !== "string" ||
      !isSafeFilename(body.filename)
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "A valid image is required.",
        },
        { status: 400 },
      );
    }

    const data = await readData();

    const exists = data[
      body.category
    ].some(
      (image) =>
        image.filename === body.filename,
    );

    if (!exists) {
      return Response.json(
        {
          ok: false,
          message:
            "The photograph could not be found.",
        },
        { status: 404 },
      );
    }

    const { imageRoot } = projectPaths();

    const imagePath = path.join(
      imageRoot,
      body.category,
      body.filename,
    );

    await rm(imagePath, {
      force: true,
    });

    data[body.category] = data[
      body.category
    ].filter(
      (image) =>
        image.filename !== body.filename,
    );

    await writeData(data);

    return Response.json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error(
      "Selected Work delete failed:",
      error,
    );

    return Response.json(
      {
        ok: false,
        message:
          "The photograph could not be removed.",
      },
      { status: 500 },
    );
  }
}