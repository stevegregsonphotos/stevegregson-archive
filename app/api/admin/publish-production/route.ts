import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  encryptProductionPassword,
} from "@/lib/production-access";
import {
  rememberDirectoryCredits,
} from "@/lib/directory-writer";
import {
  publishImageBuffer,
  type PublishedImageAsset,
} from "@/lib/publishing/publish-image";
import {
  type PublishPayload,
} from "@/lib/publishing/production-source";
import {
  ProductionConflictError,
  publishProduction,
} from "@/lib/publishing/publish-production";

import path from "node:path";

import JSZip from "jszip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_SIZE = 500 * 1024 * 1024;

const RESERVED_PRODUCTION_FILES = new Set([
  "generated.ts",
  "index.ts",
  "types.ts",
]);

const ALLOWED_LAYOUTS = new Set([
  "wide",
  "left",
  "right",
  "medium",
  "full",
  "left-small",
  "right-small",
  "wide-left",
  "wide-right",
]);

function isSafeSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
    value,
  );
}

function isSafeArchivePath(value: string) {
  if (
    !value ||
    value.startsWith("/") ||
    value.includes("\0")
  ) {
    return false;
  }

  const normalised = path.posix.normalize(value);

  return (
    normalised === value &&
    !normalised.startsWith("../") &&
    normalised !== ".."
  );
}

function isSafeFilename(value: string) {
  return (
    Boolean(value) &&
    value === path.basename(value) &&
    !value.includes("\0") &&
    value !== "." &&
    value !== ".."
  );
}

function validatePayload(
  value: unknown,
): value is PublishPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload =
    value as Partial<PublishPayload>;

  if (
    typeof payload.slug !== "string" ||
    !isSafeSlug(payload.slug) ||
    typeof payload.title !== "string" ||
    !payload.title.trim() ||
    typeof payload.venue !== "string" ||
    !payload.venue.trim() ||
    typeof payload.month !== "number" ||
    !Number.isInteger(payload.month) ||
    payload.month < 1 ||
    payload.month > 12 ||
    typeof payload.year !== "number" ||
    !Number.isInteger(payload.year) ||
    payload.year < 1800 ||
    payload.year > 2200 ||
    typeof payload.description !== "string" ||
    (
      payload.access !== undefined &&
      payload.access !== "public" &&
      payload.access !== "password"
    )
  ) {
    return false;
  }

  if (
    !payload.hero ||
    typeof payload.hero.filepath !== "string" ||
    !isSafeArchivePath(
      payload.hero.filepath,
    ) ||
    typeof payload.hero.filename !== "string" ||
    !isSafeFilename(
      payload.hero.filename,
    ) ||
    typeof payload.hero.alt !== "string" ||
    !payload.hero.alt.trim()
  ) {
    return false;
  }

  if (
    !Array.isArray(payload.credits) ||
    payload.credits.some(
      (credit) =>
        !credit ||
        typeof credit.role !== "string" ||
        !credit.role.trim() ||
        typeof credit.name !== "string" ||
        !credit.name.trim() ||
        (credit.website !== undefined &&
          typeof credit.website !== "string"),
    )
  ) {
    return false;
  }

  if (
    !Array.isArray(payload.images) ||
    payload.images.length === 0 ||
    payload.images.some(
      (image) =>
        !image ||
        typeof image.filepath !== "string" ||
        !isSafeArchivePath(
          image.filepath,
        ) ||
        typeof image.filename !== "string" ||
        !isSafeFilename(
          image.filename,
        ) ||
        typeof image.alt !== "string" ||
        !image.alt.trim() ||
        typeof image.layout !== "string" ||
        !ALLOWED_LAYOUTS.has(
          image.layout,
        ),
    )
  ) {
    return false;
  }

  const sourcePaths = [
    payload.hero.filepath,
    ...payload.images.map(
      (image) => image.filepath,
    ),
  ];

  if (
    new Set(sourcePaths).size !==
    sourcePaths.length
  ) {
    return false;
  }

  const filenames = [
    payload.hero.filename,
    ...payload.images.map(
      (image) => image.filename,
    ),
  ];

  return (
    new Set(filenames).size ===
    filenames.length
  );
}

async function publishArchiveImage(
  zip: JSZip,
  sourceFilepath: string,
  outputFilename: string,
  destinationDirectory: string,
): Promise<PublishedImageAsset> {
  const entry = zip.file(sourceFilepath);

  if (!entry) {
    throw new Error(
      `The ZIP no longer contains "${sourceFilepath}".`,
    );
  }

  const sourceBuffer =
    await entry.async("nodebuffer");

  return publishImageBuffer(
    sourceBuffer,
    sourceFilepath,
    outputFilename,
    destinationDirectory,
  );
}

export async function POST(
  request: Request,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  try {
    const formData =
      await request.formData();

    const upload = formData.get(
      "productionArchive",
    );

    const rawPayload = formData.get(
      "productionData",
    );

    if (!(upload instanceof File)) {
      return Response.json(
        {
          ok: false,
          message:
            "The original production ZIP is required.",
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
            "The production archive must be a ZIP file.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      upload.size === 0 ||
      upload.size > MAX_UPLOAD_SIZE
    ) {
      return Response.json(
        {
          ok: false,
          message:
            upload.size === 0
              ? "The production ZIP is empty."
              : "The production ZIP is larger than 500 MB.",
        },
        {
          status:
            upload.size === 0
              ? 400
              : 413,
        },
      );
    }

    if (
      typeof rawPayload !== "string"
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "Production publishing data is missing.",
        },
        {
          status: 400,
        },
      );
    }

    let parsedPayload: unknown;

    try {
      parsedPayload =
        JSON.parse(rawPayload);
    } catch {
      return Response.json(
        {
          ok: false,
          message:
            "Production publishing data is not valid JSON.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !validatePayload(
        parsedPayload,
      )
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "Production publishing data is incomplete or invalid.",
        },
        {
          status: 400,
        },
      );
    }

    const payload = parsedPayload;

    const archiveBuffer =
      await upload.arrayBuffer();

    const zip =
      await JSZip.loadAsync(
        archiveBuffer,
      );

    const result =
      await publishProduction(
        payload,
        (
          sourceFilepath,
          outputFilename,
          destinationDirectory,
        ) =>
          publishArchiveImage(
            zip,
            sourceFilepath,
            outputFilename,
            destinationDirectory,
          ),
      );

    return Response.json({
      ok: true,
      message: `${payload.title} was published and registered automatically.`,
      ...result,
    });
  } catch (error) {
    console.error(
      "Production publishing failed:",
      error,
    );

    if (
      error instanceof
      ProductionConflictError
    ) {
      return Response.json(
        {
          ok: false,
          message:
            error.message,
        },
        {
          status: 409,
        },
      );
    }

    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "The production could not be published.",
      },
      {
        status: 500,
      },
    );
  }
}