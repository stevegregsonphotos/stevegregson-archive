import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  deleteSelectedWorkItemAndCompact,
  getSelectedWork,
  insertSelectedWorkItems,
  replaceSelectedWorkCategory,
} from "@/lib/selected-work-repository";
import {
  copySelectedWorkObject,
  deleteSelectedWorkObject,
  putSelectedWorkObject,
  selectedWorkObjectExists,
  selectedWorkStorageKey,
  uniqueSelectedWorkFilename,
} from "@/lib/selected-work-storage";

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

/*
 * Load
 */

export async function GET(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  try {
    const data =
      await getSelectedWork();

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
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

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

    const currentData =
      await getSelectedWork();

    const currentImages =
      currentData[category];

    const nextPosition =
      currentImages.length > 0
        ? Math.max(
            ...currentImages.map(
              (image) =>
                image.position,
            ),
          ) + 1
        : 0;

    const reservedFilenames =
      new Set<string>();

    const uploadPlan:
      Array<{
        filename: string;
        storageKey: string;
        bytes: Buffer;
        dimensions: ImageDimensions;
        uploadedAt: string;
        position: number;
      }> = [];

    for (
      let index = 0;
      index < files.length;
      index += 1
    ) {
      const file =
        files[index];

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
        await uniqueSelectedWorkFilename(
          category,
          file.name,
          undefined,
          reservedFilenames,
        );

      reservedFilenames.add(
        filename,
      );

      uploadPlan.push({
        filename,
        storageKey:
          selectedWorkStorageKey(
            category,
            filename,
          ),
        bytes,
        dimensions,
        uploadedAt:
          new Date().toISOString(),
        position:
          nextPosition + index,
      });
    }

    const uploadedKeys:
      string[] = [];

    let databaseCommitted =
      false;

    try {
      for (
        const item of
        uploadPlan
      ) {
        await putSelectedWorkObject(
          item.storageKey,
          item.bytes,
          "image/jpeg",
        );

        uploadedKeys.push(
          item.storageKey,
        );
      }

      await insertSelectedWorkItems(
        uploadPlan.map(
          (item) => ({
            category,
            storageKey:
              item.storageKey,
            displayFilename:
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
              "pending" as const,
            position:
              item.position,
          }),
        ),
      );

      databaseCommitted =
        true;

      const data =
        await getSelectedWork();

      return Response.json({
        ok: true,
        data,
      });
    } catch (error) {
      if (!databaseCommitted) {
        for (
          const storageKey of
          uploadedKeys
        ) {
          await deleteSelectedWorkObject(
            storageKey,
          ).catch(
            () => undefined,
          );
        }
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
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

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

    if (!applyFilenameChanges) {
      const currentData =
        await getSelectedWork();

      const currentImages =
        currentData[body.category];

      if (
        submittedImages.length !==
        currentImages.length
      ) {
        return Response.json(
          {
            ok: false,
            message:
              "The collection no longer matches the stored Selected Work data.",
          },
          {
            status: 409,
          },
        );
      }

      const currentByFilename =
        new Map(
          currentImages.map(
            (image) => [
              image.filename,
              image,
            ],
          ),
        );

      const updates = [];

      for (
        const image of
        submittedImages
      ) {
        const currentImage =
          currentByFilename.get(
            image.filename,
          );

        if (!currentImage) {
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

        if (
          !(
            await selectedWorkObjectExists(
              currentImage.storageKey,
            )
          )
        ) {
          return Response.json(
            {
              ok: false,
              message:
                `${image.filename} exists in Selected Work but its R2 object is missing.`,
            },
            {
              status: 404,
            },
          );
        }

        updates.push({
          currentStorageKey:
            currentImage.storageKey,
          nextStorageKey:
            currentImage.storageKey,
          nextImage: {
            ...image,
            storageKey:
              currentImage.storageKey,
            position:
              currentImage.position,
          },
        });
      }

      const savedData =
        await replaceSelectedWorkCategory(
          body.category,
          updates,
        );

      return Response.json({
        ok: true,
        data: savedData,
      });
    }

    const currentData =
      await getSelectedWork();

    const currentImages =
      currentData[body.category];

    if (
      submittedImages.length !==
      currentImages.length
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "The collection no longer matches the stored Selected Work data.",
        },
        {
          status: 409,
        },
      );
    }

    const currentByFilename =
      new Map(
        currentImages.map(
          (image) => [
            image.filename,
            image,
          ],
        ),
      );

    const reservedFilenames =
      new Set<string>();

    const savePlan:
      Array<{
        currentImage:
          (typeof currentImages)[number];
        nextImage:
          (typeof currentImages)[number];
        currentStorageKey: string;
        nextStorageKey: string;
      }> = [];

    for (
      const image of
      submittedImages
    ) {
      const currentImage =
        currentByFilename.get(
          image.filename,
        );

      if (!currentImage) {
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

      if (
        !(
          await selectedWorkObjectExists(
            currentImage.storageKey,
          )
        )
      ) {
        return Response.json(
          {
            ok: false,
            message:
              `${image.filename} exists in Selected Work but its R2 object is missing.`,
          },
          {
            status: 404,
          },
        );
      }

      let finalFilename =
        image.filename;

      if (
        image.suggestedFilename
      ) {
        const suggestion =
          normaliseSuggestedFilename(
            image.suggestedFilename,
            image.filename,
          );

        finalFilename =
          await uniqueSelectedWorkFilename(
            body.category,
            suggestion,
            image.filename,
            reservedFilenames,
          );
      }

      reservedFilenames.add(
        finalFilename,
      );

      const nextStorageKey =
        selectedWorkStorageKey(
          body.category,
          finalFilename,
        );

      savePlan.push({
        currentImage,
        currentStorageKey:
          currentImage.storageKey,
        nextStorageKey,
        nextImage: {
          filename:
            finalFilename,
          storageKey:
            nextStorageKey,
          suggestedFilename:
            "",
          alt:
            image.alt.trim(),
          uploadedAt:
            image.uploadedAt,
          width:
            image.width ??
            currentImage.width,
          height:
            image.height ??
            currentImage.height,
          analysisStatus:
            image.analysisStatus ??
            currentImage.analysisStatus,
          analysedAt:
            (
              image.analysisStatus ??
              currentImage.analysisStatus
            ) === "complete"
              ? (
                  image.analysedAt ??
                  currentImage.analysedAt
                )
              : undefined,
          position:
            currentImage.position,
        },
      });
    }

    const copiedKeys:
      string[] = [];

    try {
      for (
        const item of
        savePlan
      ) {
        if (
          item.currentStorageKey ===
          item.nextStorageKey
        ) {
          continue;
        }

        await copySelectedWorkObject(
          item.currentStorageKey,
          item.nextStorageKey,
        );

        copiedKeys.push(
          item.nextStorageKey,
        );
      }

      const savedData =
        await replaceSelectedWorkCategory(
          body.category,
          savePlan.map(
            (item) => ({
              currentStorageKey:
                item.currentStorageKey,
              nextStorageKey:
                item.nextStorageKey,
              nextImage:
                item.nextImage,
            }),
          ),
        );

      for (
        const item of
        savePlan
      ) {
        if (
          item.currentStorageKey ===
          item.nextStorageKey
        ) {
          continue;
        }

        try {
          await deleteSelectedWorkObject(
            item.currentStorageKey,
          );
        } catch (cleanupError) {
          console.error(
            "Selected Work old R2 object cleanup failed:",
            cleanupError,
          );
        }
      }

      return Response.json({
        ok: true,
        data: savedData,
      });
    } catch (error) {
      for (
        const storageKey of
        copiedKeys
      ) {
        await deleteSelectedWorkObject(
          storageKey,
        ).catch(
          () => undefined,
        );
      }

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
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

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

    const deleted =
      await deleteSelectedWorkItemAndCompact(
        body.category,
        body.filename,
      );

    if (!deleted) {
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

    let cleanupWarning:
      string | null = null;

    try {
      await deleteSelectedWorkObject(
        deleted.storageKey,
      );
    } catch (error) {
      console.error(
        "Selected Work R2 delete cleanup failed:",
        error,
      );

      cleanupWarning =
        "The Selected Work record was removed, but its old R2 object could not be cleaned up.";
    }

    const data =
      await getSelectedWork();

    return Response.json({
      ok: true,
      data,
      ...(cleanupWarning
        ? {
            message:
              cleanupWarning,
          }
        : {}),
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
          "The photograph could not be deleted.",
      },
      {
        status: 500,
      },
    );
  }
}
