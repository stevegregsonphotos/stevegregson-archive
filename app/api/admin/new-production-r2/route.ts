import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import {
  createProductionImageUploadUrl,
} from "@/lib/publishing/production-image-storage";

import {
  finalizePublishedProduction,
  ProductionConflictError,
  type PublishedImageMetadata,
} from "@/lib/publishing/publish-production";

import type {
  PublishPayload,
} from "@/lib/publishing/production-source";

import {
  productionExists,
} from "@/lib/productions-repository";

import {
  NextResponse,
} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  action?: unknown;
  slug?: unknown;
  filename?: unknown;
  payload?: unknown;
  heroAsset?: unknown;
  galleryAssets?: unknown;
};

const ALLOWED_LAYOUTS =
  new Set([
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

function stringValue(
  value: unknown,
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isSafeSlug(
  value: string,
) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
    value,
  );
}

function isSafeFilename(
  value: string,
) {
  return (
    Boolean(value) &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    value !== "." &&
    value !== ".."
  );
}

function isPublishedImageMetadata(
  value: unknown,
): value is PublishedImageMetadata {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const candidate =
    value as Record<
      string,
      unknown
    >;

  return (
    typeof candidate.sourceFilepath ===
      "string" &&
    Boolean(
      candidate.sourceFilepath.trim(),
    ) &&
    typeof candidate.filename ===
      "string" &&
    isSafeFilename(
      candidate.filename,
    ) &&
    typeof candidate.blurDataURL ===
      "string" &&
    /^data:image\/(?:webp|png|jpeg);base64,/i.test(
      candidate.blurDataURL,
    )
  );
}

function isPayload(
  value: unknown,
): value is PublishPayload {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const payload =
    value as Partial<PublishPayload>;

  if (
    typeof payload.slug !== "string" ||
    !isSafeSlug(
      payload.slug,
    ) ||
    typeof payload.title !== "string" ||
    !payload.title.trim() ||
    typeof payload.venue !== "string" ||
    !payload.venue.trim() ||
    typeof payload.month !== "number" ||
    !Number.isInteger(
      payload.month,
    ) ||
    payload.month < 1 ||
    payload.month > 12 ||
    typeof payload.year !== "number" ||
    !Number.isInteger(
      payload.year,
    ) ||
    payload.year < 1800 ||
    payload.year > 2200 ||
    typeof payload.description !==
      "string" ||
    !payload.description.trim()
  ) {
    return false;
  }

  if (
    !payload.hero ||
    typeof payload.hero.filepath !==
      "string" ||
    !payload.hero.filepath.trim() ||
    typeof payload.hero.filename !==
      "string" ||
    !isSafeFilename(
      payload.hero.filename,
    ) ||
    typeof payload.hero.alt !==
      "string" ||
    !payload.hero.alt.trim()
  ) {
    return false;
  }

  if (
    !Array.isArray(
      payload.credits,
    ) ||
    payload.credits.some(
      (credit) =>
        !credit ||
        typeof credit.role !==
          "string" ||
        !credit.role.trim() ||
        typeof credit.name !==
          "string" ||
        !credit.name.trim(),
    )
  ) {
    return false;
  }

  if (
    !Array.isArray(
      payload.images,
    ) ||
    payload.images.length === 0 ||
    payload.images.some(
      (image) =>
        !image ||
        typeof image.filepath !==
          "string" ||
        !image.filepath.trim() ||
        typeof image.filename !==
          "string" ||
        !isSafeFilename(
          image.filename,
        ) ||
        typeof image.alt !==
          "string" ||
        !image.alt.trim() ||
        typeof image.layout !==
          "string" ||
        !ALLOWED_LAYOUTS.has(
          image.layout,
        ),
    )
  ) {
    return false;
  }

  const outputNames = [
    payload.hero.filename,
    ...payload.images.map(
      (image) =>
        image.filename,
    ),
  ];

  return (
    new Set(outputNames).size ===
    outputNames.length
  );
}

export async function POST(
  request: Request,
) {
  if (
    !isBackstageRequestAuthenticated(
      request,
    )
  ) {
    return createUnauthorizedResponse();
  }

  let body: RequestBody;

  try {
    body =
      (await request.json()) as
        RequestBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Invalid request.",
      },
      { status: 400 },
    );
  }

  const action =
    stringValue(
      body.action,
    );

  try {
    if (
      action ===
      "check"
    ) {
      const slug =
        stringValue(
          body.slug,
        );

      if (
        !isSafeSlug(
          slug,
        )
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "A valid production slug is required.",
          },
          { status: 400 },
        );
      }

      return NextResponse.json({
        ok: true,
        exists:
          await productionExists(
            slug,
          ),
      });
    }

    if (
      action ===
      "sign-image"
    ) {
      const slug =
        stringValue(
          body.slug,
        );

      const filename =
        stringValue(
          body.filename,
        );

      if (
        !isSafeSlug(
          slug,
        ) ||
        !isSafeFilename(
          filename,
        ) ||
        !filename
          .toLowerCase()
          .endsWith(
            ".webp",
          )
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Invalid production image request.",
          },
          { status: 400 },
        );
      }

      if (
        await productionExists(
          slug,
        )
      ) {
        throw new ProductionConflictError(
          `A production already exists for "${slug}".`,
        );
      }

      return NextResponse.json({
        ok: true,
        uploadUrl:
          await createProductionImageUploadUrl(
            slug,
            filename,
          ),
      });
    }

    if (
      action ===
      "finalize"
    ) {
      if (
        !isPayload(
          body.payload,
        )
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Production publishing data is incomplete or invalid.",
          },
          { status: 400 },
        );
      }

      if (
        !isPublishedImageMetadata(
          body.heroAsset,
        ) ||
        !Array.isArray(
          body.galleryAssets,
        ) ||
        !body.galleryAssets.every(
          isPublishedImageMetadata,
        )
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Published image metadata is incomplete.",
          },
          { status: 400 },
        );
      }

      const payload =
        body.payload;

      const galleryAssets =
        body.galleryAssets;

      if (
        body.heroAsset.filename !==
          payload.hero.filename ||
        body.heroAsset.sourceFilepath !==
          payload.hero.filepath
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Hero upload does not match the publishing payload.",
          },
          { status: 409 },
        );
      }

      if (
        galleryAssets.length !==
        payload.images.length
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Gallery upload count does not match the publishing payload.",
          },
          { status: 409 },
        );
      }

      for (
        let index = 0;
        index <
        payload.images.length;
        index += 1
      ) {
        const expected =
          payload.images[
            index
          ];

        const actual =
          galleryAssets[
            index
          ];

        if (
          actual.filename !==
            expected.filename ||
          actual.sourceFilepath !==
            expected.filepath
        ) {
          return NextResponse.json(
            {
              ok: false,
              message:
                "Gallery upload metadata does not match the publishing payload.",
            },
            { status: 409 },
          );
        }
      }

      const result =
        await finalizePublishedProduction(
          payload,
          body.heroAsset,
          galleryAssets,
        );

      return NextResponse.json({
        ok: true,
        message:
          `${payload.title} was published successfully.`,
        ...result,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          "Unknown new-production action.",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error(
      "R2-first production publishing failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Production publishing failed.",
      },
      {
        status:
          error instanceof
          ProductionConflictError
            ? 409
            : 500,
      },
    );
  }
}
