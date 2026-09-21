import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  deleteSelectedWorkItemAndCompact,
  getSelectedWork,
  insertSelectedWorkItems,
  replaceSelectedWorkCategory,
  updateSelectedWorkImageEdit,
} from "@/lib/selected-work-repository";
import {
  copySelectedWorkObject,
  createSelectedWorkUploadUrl,
  deleteSelectedWorkObject,
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
  originalFilename?: string;
  editAspect?: "original" | "3:2" | "4:5" | "1:1" | "16:9";
  editZoom?: number;
  editPanX?: number;
  editPanY?: number;
  editBrightness?: number;
  editAutoStrength?: number;
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
  return /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|webp)$/i.test(
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
    const body =
      (await request.json()) as {
        action?: unknown;
        category?: unknown;
        originalFilename?: unknown;
        currentFilename?: unknown;
        nextFilename?: unknown;
        width?: unknown;
        height?: unknown;
        settings?: unknown;
        uploads?: unknown;
      };

    if (!isCategory(body.category)) {
      return Response.json(
        {
          ok: false,
          message:
            "A valid Selected Work category is required.",
        },
        { status: 400 },
      );
    }

    const category = body.category;
    const action =
      typeof body.action === "string"
        ? body.action.trim()
        : "";

    if (action === "presign-edit") {
      const currentFilename =
        typeof body.currentFilename === "string"
          ? body.currentFilename.trim()
          : "";

      if (
        !currentFilename ||
        !isSafeFilename(currentFilename)
      ) {
        return Response.json(
          {
            ok: false,
            message:
              "A valid Selected Work image is required.",
          },
          { status: 400 },
        );
      }

      const current =
        (await getSelectedWork())[category]
          .find(
            (image) =>
              image.filename ===
              currentFilename,
          );

      if (!current) {
        return Response.json(
          {
            ok: false,
            message:
              "The Selected Work image could not be found.",
          },
          { status: 404 },
        );
      }

      const stem =
        currentFilename.replace(
          /\.[^.]+$/,
          "",
        );

      const filename =
        await uniqueSelectedWorkFilename(
          category,
          `${stem}-edited.webp`,
        );

      const storageKey =
        selectedWorkStorageKey(
          category,
          filename,
        );

      const uploadUrl =
        await createSelectedWorkUploadUrl(
          storageKey,
          "image/webp",
        );

      return Response.json({
        ok: true,
        filename,
        storageKey,
        uploadUrl,
      });
    }

    if (action === "commit-edit") {
      const currentFilename =
        typeof body.currentFilename === "string"
          ? body.currentFilename.trim()
          : "";

      const nextFilename =
        typeof body.nextFilename === "string"
          ? body.nextFilename.trim()
          : "";

      const width =
        Number(body.width);

      const height =
        Number(body.height);

      const settings =
        body.settings &&
        typeof body.settings === "object"
          ? body.settings as Record<string, unknown>
          : null;

      if (
        !isSafeFilename(currentFilename) ||
        !isSafeFilename(nextFilename) ||
        !Number.isInteger(width) ||
        width <= 0 ||
        !Number.isInteger(height) ||
        height <= 0 ||
        !settings
      ) {
        return Response.json(
          {
            ok: false,
            message:
              "The edited image metadata is invalid.",
          },
          { status: 400 },
        );
      }

      const aspect =
        typeof settings.aspect === "string" &&
        [
          "original",
          "3:2",
          "4:5",
          "1:1",
          "16:9",
        ].includes(settings.aspect)
          ? settings.aspect as
              | "original"
              | "3:2"
              | "4:5"
              | "1:1"
              | "16:9"
          : null;

      const zoom =
        Number(settings.zoom);
      const panX =
        Number(settings.panX);
      const panY =
        Number(settings.panY);
      const brightness =
        Number(settings.brightness);
      const autoStrength =
        Number(settings.autoStrength);

      if (
        !aspect ||
        !Number.isFinite(zoom) ||
        !Number.isFinite(panX) ||
        !Number.isFinite(panY) ||
        !Number.isFinite(brightness) ||
        !Number.isFinite(autoStrength)
      ) {
        return Response.json(
          {
            ok: false,
            message:
              "The image edit settings are invalid.",
          },
          { status: 400 },
        );
      }

      const currentData =
        await getSelectedWork();

      const currentImage =
        currentData[category].find(
          (image) =>
            image.filename ===
            currentFilename,
        );

      if (!currentImage) {
        return Response.json(
          {
            ok: false,
            message:
              "The Selected Work image could not be found.",
          },
          { status: 404 },
        );
      }

      const nextStorageKey =
        selectedWorkStorageKey(
          category,
          nextFilename,
        );

      if (
        !(
          await selectedWorkObjectExists(
            nextStorageKey,
          )
        )
      ) {
        return Response.json(
          {
            ok: false,
            message:
              "The edited image was not verified in R2.",
          },
          { status: 409 },
        );
      }

      const originalFilename =
        currentImage.originalFilename ??
        currentImage.filename;

      await updateSelectedWorkImageEdit({
        category,
        currentFilename,
        nextFilename,
        nextStorageKey,
        width,
        height,
        aspect,
        zoom,
        panX,
        panY,
        brightness,
        autoStrength,
      });

      /*
       * Preserve the original forever, but remove the
       * previous generated derivative after a successful
       * replacement.
       */
      if (
        currentImage.filename !==
        originalFilename
      ) {
        await deleteSelectedWorkObject(
          currentImage.storageKey,
        ).catch((cleanupError) => {
          console.error(
            "Old Selected Work derivative cleanup failed:",
            cleanupError,
          );
        });
      }

      return Response.json({
        ok: true,
        data:
          await getSelectedWork(),
      });
    }

    if (action === "presign") {
      const originalFilename =
        typeof body.originalFilename === "string"
          ? body.originalFilename.trim()
          : "";

      if (
        !originalFilename ||
        !/\.(?:jpe?g)$/i.test(originalFilename)
      ) {
        return Response.json(
          {
            ok: false,
            message:
              "A JPEG filename is required.",
          },
          { status: 400 },
        );
      }

      const filename =
        await uniqueSelectedWorkFilename(
          category,
          originalFilename,
        );

      const storageKey =
        selectedWorkStorageKey(
          category,
          filename,
        );

      const uploadUrl =
        await createSelectedWorkUploadUrl(
          storageKey,
          "image/jpeg",
        );

      return Response.json({
        ok: true,
        filename,
        storageKey,
        uploadUrl,
      });
    }

    if (action === "commit-batch") {
      if (!Array.isArray(body.uploads)) {
        return Response.json(
          {
            ok: false,
            message:
              "Uploaded image metadata is required.",
          },
          { status: 400 },
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
                (image) => image.position,
              ),
            ) + 1
          : 0;

      const uploads = [];

      for (
        let index = 0;
        index < body.uploads.length;
        index += 1
      ) {
        const value = body.uploads[index];

        if (!value || typeof value !== "object") {
          return Response.json(
            {
              ok: false,
              message:
                "Uploaded image metadata is invalid.",
            },
            { status: 400 },
          );
        }

        const item = value as Record<string, unknown>;
        const filename =
          typeof item.filename === "string"
            ? item.filename.trim()
            : "";
        const storageKey =
          typeof item.storageKey === "string"
            ? item.storageKey.trim()
            : "";
        const width = Number(item.width);
        const height = Number(item.height);
        const uploadedAt =
          typeof item.uploadedAt === "string"
            ? item.uploadedAt
            : "";

        if (
          !isSafeFilename(filename) ||
          storageKey !==
            selectedWorkStorageKey(
              category,
              filename,
            ) ||
          !Number.isInteger(width) ||
          width <= 0 ||
          !Number.isInteger(height) ||
          height <= 0 ||
          !uploadedAt ||
          !(await selectedWorkObjectExists(storageKey))
        ) {
          return Response.json(
            {
              ok: false,
              message:
                `${filename || "An uploaded photograph"} was not verified in R2.`,
            },
            { status: 409 },
          );
        }

        uploads.push({
          category,
          storageKey,
          displayFilename: filename,
          suggestedFilename: "",
          alt: "",
          uploadedAt,
          width,
          height,
          analysisStatus:
            "pending" as const,
          position:
            nextPosition + index,
        });
      }

      if (uploads.length === 0) {
        return Response.json(
          {
            ok: false,
            message:
              "No uploaded photographs were supplied.",
          },
          { status: 400 },
        );
      }

      await insertSelectedWorkItems(uploads);

      return Response.json({
        ok: true,
        data: await getSelectedWork(),
      });
    }

    return Response.json(
      {
        ok: false,
        message: "Unknown upload action.",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error(
      "Selected Work upload failed:",
      error,
    );

    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "The photographs could not be uploaded.",
      },
      { status: 500 },
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

      const originalFilename =
        "originalFilename" in value &&
        typeof value.originalFilename === "string" &&
        isSafeFilename(value.originalFilename)
          ? value.originalFilename
          : undefined;

      const editAspect =
        "editAspect" in value &&
        typeof value.editAspect === "string" &&
        [
          "original",
          "3:2",
          "4:5",
          "1:1",
          "16:9",
        ].includes(value.editAspect)
          ? value.editAspect as
              | "original"
              | "3:2"
              | "4:5"
              | "1:1"
              | "16:9"
          : "original";

      const editZoom =
        "editZoom" in value &&
        typeof value.editZoom === "number"
          ? value.editZoom
          : 1;

      const editPanX =
        "editPanX" in value &&
        typeof value.editPanX === "number"
          ? value.editPanX
          : 0;

      const editPanY =
        "editPanY" in value &&
        typeof value.editPanY === "number"
          ? value.editPanY
          : 0;

      const editBrightness =
        "editBrightness" in value &&
        typeof value.editBrightness === "number"
          ? value.editBrightness
          : 100;

      const editAutoStrength =
        "editAutoStrength" in value &&
        typeof value.editAutoStrength === "number"
          ? value.editAutoStrength
          : 0;

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

        originalFilename,

        editAspect,

        editZoom,

        editPanX,

        editPanY,

        editBrightness,

        editAutoStrength,
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
