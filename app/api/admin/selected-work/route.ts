import { randomUUID } from "node:crypto";

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

type AnalysisStatus =
  | "pending"
  | "complete";

type SelectedWorkImage = {
  filename: string;
  suggestedFilename?: string;
  alt: string;
  uploadedAt: string;

  width?: number;
  height?: number;

  /*
   * Explicit AI-analysis state.
   *
   * Older data did not contain this field.
   * readData() migrates those records in
   * memory using the old alt-text rule.
   */
  analysisStatus: AnalysisStatus;

  analysedAt?: string;
};

type SelectedWorkData = Record<
  CategoryId,
  SelectedWorkImage[]
>;

type ImageDimensions = {
  width: number;
  height: number;
};

type UploadPlan = {
  filename: string;
  bytes: Buffer;
  dimensions: ImageDimensions;
  uploadedAt: string;
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

function isAnalysisStatus(
  value: unknown,
): value is AnalysisStatus {
  return (
    value === "pending" ||
    value === "complete"
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
    path.extname(filename).toLowerCase() ||
    ".jpg";

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
      extension === ".jpeg"
        ? ".jpg"
        : extension,
  };
}

function normaliseSuggestedFilename(
  suggestedFilename: string,
  originalFilename: string,
) {
  const originalExtension =
    path.extname(
      originalFilename,
    ).toLowerCase() || ".jpg";

  const { base } =
    cleanBaseName(suggestedFilename);

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
    throw new Error(
      "The file is not a valid JPEG.",
    );
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
      (marker >= 0xd0 &&
        marker <= 0xd7)
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
      offset + segmentLength >
        bytes.length
    ) {
      break;
    }

    if (
      startOfFrameMarkers.has(marker)
    ) {
      if (segmentLength < 7) {
        break;
      }

      const height =
        bytes.readUInt16BE(
          offset + 3,
        );

      const width =
        bytes.readUInt16BE(
          offset + 5,
        );

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
  const {
    dataFile,
    imageRoot,
  } = projectPaths();

  await mkdir(
    path.dirname(dataFile),
    {
      recursive: true,
    },
  );

  await mkdir(imageRoot, {
    recursive: true,
  });

  try {
    await readFile(
      dataFile,
      "utf8",
    );
  } catch {
    await writeData(EMPTY_DATA);
  }
}

function normaliseStoredImage(
  value: unknown,
): SelectedWorkImage | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const record =
    value as Record<string, unknown>;

  if (
    typeof record.filename !==
      "string" ||
    typeof record.alt !== "string" ||
    typeof record.uploadedAt !==
      "string"
  ) {
    return null;
  }

  const alt = record.alt;

  /*
   * Backwards compatibility:
   *
   * Before analysisStatus existed, the
   * editor considered non-empty alt text
   * to mean that analysis was complete.
   */
  const analysisStatus =
    isAnalysisStatus(
      record.analysisStatus,
    )
      ? record.analysisStatus
      : alt.trim()
        ? "complete"
        : "pending";

  return {
    filename: record.filename,

    suggestedFilename:
      typeof record.suggestedFilename ===
      "string"
        ? record.suggestedFilename
        : "",

    alt,

    uploadedAt:
      record.uploadedAt,

    width:
      isPositiveInteger(record.width)
        ? record.width
        : undefined,

    height:
      isPositiveInteger(record.height)
        ? record.height
        : undefined,

    analysisStatus,

    analysedAt:
      typeof record.analysedAt ===
      "string"
        ? record.analysedAt
        : undefined,
  };
}

function normaliseStoredImages(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normaliseStoredImage)
    .filter(
      (
        image,
      ): image is SelectedWorkImage =>
        Boolean(image),
    );
}

async function readData(): Promise<SelectedWorkData> {
  await ensureStorage();

  const { dataFile } =
    projectPaths();

  const source = await readFile(
    dataFile,
    "utf8",
  );

  const parsed =
    JSON.parse(source) as Record<
      string,
      unknown
    >;

  return {
    production:
      normaliseStoredImages(
        parsed.production,
      ),

    rehearsal:
      normaliseStoredImages(
        parsed.rehearsal,
      ),

    campaign:
      normaliseStoredImages(
        parsed.campaign,
      ),
  };
}

/*
 * Atomic JSON persistence.
 *
 * Write a complete temporary file first,
 * then replace the live file in a single
 * filesystem rename operation.
 */
async function writeData(
  data: SelectedWorkData,
) {
  const { dataFile } =
    projectPaths();

  const temporaryFile =
    `${dataFile}.${randomUUID()}.tmp`;

  const contents =
    `${JSON.stringify(
      data,
      null,
      2,
    )}\n`;

  try {
    await writeFile(
      temporaryFile,
      contents,
      "utf8",
    );

    await rename(
      temporaryFile,
      dataFile,
    );
  } catch (error) {
    await rm(
      temporaryFile,
      {
        force: true,
      },
    ).catch(() => undefined);

    throw error;
  }
}

async function fileExists(
  filePath: string,
) {
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
  reservedFilenames:
    Set<string> = new Set(),
) {
  const {
    base,
    extension,
  } = cleanBaseName(
    originalName,
  );

  let candidate =
    `${base}${extension}`;

  let counter = 2;

  while (true) {
    if (
      candidate ===
        currentFilename &&
      !reservedFilenames.has(candidate)
    ) {
      return candidate;
    }

    const candidatePath =
      path.join(
        categoryDirectory,
        candidate,
      );

    const unavailable =
      reservedFilenames.has(
        candidate,
      ) ||
      (await fileExists(
        candidatePath,
      ));

    if (!unavailable) {
      return candidate;
    }

    candidate =
      `${base}-${counter}${extension}`;

    counter += 1;
  }
}

async function dimensionsFromFile(
  filePath: string,
): Promise<ImageDimensions> {
  const bytes =
    await readFile(filePath);

  return readJpegDimensions(
    bytes,
  );
}

async function rollbackRenames(
  renames: Array<{
    from: string;
    to: string;
  }>,
) {
  for (
    let index =
      renames.length - 1;
    index >= 0;
    index -= 1
  ) {
    const item =
      renames[index];

    try {
      if (
        await fileExists(item.to)
      ) {
        await rename(
          item.to,
          item.from,
        );
      }
    } catch (error) {
      console.error(
        "Selected Work rename rollback failed:",
        error,
      );
    }
  }
}

/*
 * Load
 */

export async function GET() {
  try {
    const data =
      await readData();

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
      {
        status: 500,
      },
    );
  }
}

/*
 * Upload
 */

export async function POST(
  request: Request,
) {
  try {
    const formData =
      await request.formData();

    const category =
      formData.get(
        "category",
      );

    if (!isCategory(category)) {
      return Response.json(
        {
          ok: false,
          message:
            "A valid Selected Work category is required.",
        },
        {
          status: 400,
        },
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
        {
          status: 400,
        },
      );
    }

    /*
     * Validate every file in the request
     * before writing anything to disk.
     */
    const invalidFile =
      files.find(
        (file) =>
          file.type !==
            "image/jpeg" ||
          !/\.(?:jpe?g)$/i.test(
            file.name,
          ),
      );

    if (invalidFile) {
      return Response.json(
        {
          ok: false,
          message:
            `${invalidFile.name} is not a JPEG photograph.`,
        },
        {
          status: 400,
        },
      );
    }

    const data =
      await readData();

    const { imageRoot } =
      projectPaths();

    const categoryDirectory =
      path.join(
        imageRoot,
        category,
      );

    await mkdir(
      categoryDirectory,
      {
        recursive: true,
      },
    );

    const reservedFilenames =
      new Set<string>();

    const uploadPlan:
      UploadPlan[] = [];

    /*
     * Stage the complete batch in memory.
     *
     * No photograph is written until every
     * photograph has passed validation.
     */
    for (const file of files) {
      const bytes =
        Buffer.from(
          await file.arrayBuffer(),
        );

      let dimensions:
        ImageDimensions;

      try {
        dimensions =
          readJpegDimensions(
            bytes,
          );
      } catch {
        return Response.json(
          {
            ok: false,
            message:
              `${file.name} does not contain readable JPEG dimensions.`,
          },
          {
            status: 400,
          },
        );
      }

      const filename =
        await uniqueFilename(
          categoryDirectory,
          file.name,
          undefined,
          reservedFilenames,
        );

      reservedFilenames.add(
        filename,
      );

      uploadPlan.push({
        filename,
        bytes,
        dimensions,
        uploadedAt:
          new Date().toISOString(),
      });
    }

    const writtenPaths:
      string[] = [];

    try {
      for (
        const item of uploadPlan
      ) {
        const destination =
          path.join(
            categoryDirectory,
            item.filename,
          );

        await writeFile(
          destination,
          item.bytes,
        );

        writtenPaths.push(
          destination,
        );
      }

      const uploaded:
        SelectedWorkImage[] =
        uploadPlan.map(
          (item) => ({
            filename:
              item.filename,

            suggestedFilename:
              "",

            alt: "",

            uploadedAt:
              item.uploadedAt,

            width:
              item.dimensions.width,

            height:
              item.dimensions.height,

            analysisStatus:
              "pending",
          }),
        );

      const updatedData = {
        ...data,

        [category]: [
          ...data[category],
          ...uploaded,
        ],
      };

      /*
       * Only commit the metadata after all
       * physical image writes succeeded.
       */
      await writeData(
        updatedData,
      );

      return Response.json({
        ok: true,
        data: updatedData,
      });
    } catch (error) {
      /*
       * The request is transactional:
       * remove every file written by this
       * failed batch.
       */
      for (
        const filePath of
        writtenPaths
      ) {
        await rm(
          filePath,
          {
            force: true,
          },
        ).catch(
          () => undefined,
        );
      }

      throw error;
    }
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
      {
        status: 500,
      },
    );
  }
}

/*
 * Save / reorder / metadata
 */

export async function PUT(
  request: Request,
) {
  try {
    const body =
  (await request.json()) as {
    category?: unknown;
    images?: unknown;
    applyFilenameChanges?: unknown;
  };

const applyFilenameChanges =
  body.applyFilenameChanges !== false;

    if (
      !isCategory(
        body.category,
      ) ||
      !Array.isArray(
        body.images,
      )
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "A valid collection is required.",
        },
        {
          status: 400,
        },
      );
    }

    const submittedImages:
      SelectedWorkImage[] =
      [];

    for (
      const value of
      body.images
    ) {
      if (
        !value ||
        typeof value !==
          "object" ||
        !(
          "filename" in value
        ) ||
        !("alt" in value) ||
        !(
          "uploadedAt" in value
        ) ||
        typeof value.filename !==
          "string" ||
        typeof value.alt !==
          "string" ||
        typeof value.uploadedAt !==
          "string" ||
        !isSafeFilename(
          value.filename,
        )
      ) {
        return Response.json(
          {
            ok: false,
            message:
              "The collection contains invalid image data.",
          },
          {
            status: 400,
          },
        );
      }

      const suggestedFilename =
        "suggestedFilename" in
          value &&
        typeof value.suggestedFilename ===
          "string"
          ? value.suggestedFilename.trim()
          : "";

      const width =
        "width" in value &&
        isPositiveInteger(
          value.width,
        )
          ? value.width
          : undefined;

      const height =
        "height" in value &&
        isPositiveInteger(
          value.height,
        )
          ? value.height
          : undefined;

      const alt =
        value.alt.trim();

      const analysisStatus =
        "analysisStatus" in
          value &&
        isAnalysisStatus(
          value.analysisStatus,
        )
          ? value.analysisStatus
          : alt
            ? "complete"
            : "pending";

      const analysedAt =
        "analysedAt" in value &&
        typeof value.analysedAt ===
          "string"
          ? value.analysedAt
          : undefined;

      submittedImages.push({
        filename:
          value.filename,

        suggestedFilename,

        alt,

        uploadedAt:
          value.uploadedAt,

        width,

        height,

        analysisStatus,

        analysedAt,
      });
    }

    const data =
      await readData();

    const { imageRoot } =
      projectPaths();

    const categoryDirectory =
      path.join(
        imageRoot,
        body.category,
      );

    await mkdir(
      categoryDirectory,
      {
        recursive: true,
      },
    );

    const existingImages =
      data[body.category];

    /*
     * First ensure every referenced source
     * photograph actually exists.
     */
    for (
      const image of
      submittedImages
    ) {
      const sourcePath =
        path.join(
          categoryDirectory,
          image.filename,
        );

      if (
        !(
          await fileExists(
            sourcePath,
          )
        )
      ) {
        return Response.json(
          {
            ok: false,
            message:
              `${image.filename} could not be found.`,
          },
          {
            status: 404,
          },
        );
      }
    }

    const reservedFilenames =
      new Set<string>();

    const savePlan:
      Array<{
        image: SelectedWorkImage;
        finalFilename: string;
      }> = [];

    /*
     * Plan every rename before modifying
     * the filesystem.
     */
    for (
      const image of
      submittedImages
    ) {
      let finalFilename =
        image.filename;

            if (
        applyFilenameChanges &&
        image.suggestedFilename
      ) {
        const suggestion =
          normaliseSuggestedFilename(
            image.suggestedFilename,
            image.filename,
          );

        finalFilename =
          await uniqueFilename(
            categoryDirectory,
            suggestion,
            image.filename,
            reservedFilenames,
          );
      }

      reservedFilenames.add(
        finalFilename,
      );

      savePlan.push({
        image,
        finalFilename,
      });
    }

    const completedRenames:
      Array<{
        from: string;
        to: string;
      }> = [];

    try {
      /*
       * Apply planned renames.
       */
      for (
        const item of
        savePlan
      ) {
        if (
          item.finalFilename ===
          item.image.filename
        ) {
          continue;
        }

        const from =
          path.join(
            categoryDirectory,
            item.image.filename,
          );

        const to =
          path.join(
            categoryDirectory,
            item.finalFilename,
          );

        await rename(
          from,
          to,
        );

        completedRenames.push({
          from,
          to,
        });
      }

      const savedImages:
        SelectedWorkImage[] =
        [];

      for (
        const item of
        savePlan
      ) {
        const {
          image,
          finalFilename,
        } = item;

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
          !isPositiveInteger(
            width,
          ) ||
          !isPositiveInteger(
            height,
          )
        ) {
          const dimensions =
            await dimensionsFromFile(
              path.join(
                categoryDirectory,
                finalFilename,
              ),
            );

          width =
            dimensions.width;

          height =
            dimensions.height;
        }

        const analysisStatus =
          image.analysisStatus ??
          existingImage?.analysisStatus ??
          (image.alt.trim()
            ? "complete"
            : "pending");

        const analysedAt =
          image.analysedAt ??
          existingImage?.analysedAt;

        savedImages.push({
          filename:
            finalFilename,

                    suggestedFilename:
            applyFilenameChanges
              ? ""
              : image.suggestedFilename,

          alt:
            image.alt.trim(),

          uploadedAt:
            image.uploadedAt,

          width,

          height,

          analysisStatus,

          analysedAt:
            analysisStatus ===
            "complete"
              ? analysedAt
              : undefined,
        });
      }

      const updatedData = {
        ...data,

        [body.category]:
          savedImages,
      };

      /*
       * Commit metadata only after all file
       * operations have succeeded.
       */
      await writeData(
        updatedData,
      );

      return Response.json({
        ok: true,
        data: updatedData,
      });
    } catch (error) {
      /*
       * Restore filenames if the operation
       * could not be committed.
       */
      await rollbackRenames(
        completedRenames,
      );

      throw error;
    }
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
      {
        status: 500,
      },
    );
  }
}

/*
 * Delete
 */

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
      !isCategory(
        body.category,
      ) ||
      typeof body.filename !==
        "string" ||
      !isSafeFilename(
        body.filename,
      )
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "A valid image is required.",
        },
        {
          status: 400,
        },
      );
    }

    const data =
      await readData();

    const exists =
      data[
        body.category
      ].some(
        (image) =>
          image.filename ===
          body.filename,
      );

    if (!exists) {
      return Response.json(
        {
          ok: false,
          message:
            "The photograph could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    const { imageRoot } =
      projectPaths();

    const imagePath =
      path.join(
        imageRoot,
        body.category,
        body.filename,
      );

    if (
      !(
        await fileExists(
          imagePath,
        )
      )
    ) {
      return Response.json(
        {
          ok: false,
          message:
            `${body.filename} exists in the collection but the image file is missing.`,
        },
        {
          status: 404,
        },
      );
    }

    /*
     * Move the file aside instead of
     * destroying it immediately.
     */
    const temporaryPath =
      `${imagePath}.${randomUUID()}.delete`;

    await rename(
      imagePath,
      temporaryPath,
    );

    const updatedData = {
  ...data,

  [body.category]:
    data[
      body.category
    ].filter(
      (image) =>
        image.filename !==
        body.filename,
    ),
};

try {
  await writeData(
    updatedData,
  );
} catch (error) {
  /*
   * Metadata was not committed, so put
   * the image back exactly where it was.
   */
  if (
    await fileExists(
      temporaryPath,
    )
  ) {
    await rename(
      temporaryPath,
      imagePath,
    );
  }

  throw error;
}

/*
 * Metadata is now safely committed.
 * Failure to clean up the temporary
 * image must not restore it to the
 * live collection.
 */
try {
  await rm(
    temporaryPath,
    {
      force: true,
    },
  );
} catch (cleanupError) {
  console.error(
    "Selected Work delete cleanup failed:",
    cleanupError,
  );
}

return Response.json({
  ok: true,
  data: updatedData,
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
      {
        status: 500,
      },
    );
  }
}