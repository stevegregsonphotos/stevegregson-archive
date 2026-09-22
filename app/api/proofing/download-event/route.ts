import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  recordProofingDownloadEvent,
} from "@/lib/proofing/download-events-repository";

import {
  getProofingGalleryBySlug,
} from "@/lib/proofing/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  gallerySlug?: unknown;
  downloadType?: unknown;
  imageIds?: unknown;
  archiveFilename?: unknown;
};

function cleanString(
  value: unknown,
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function cleanStringArray(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter(
          (item): item is string =>
            typeof item === "string",
        )
        .map((item) =>
          item.trim(),
        )
        .filter(Boolean),
    ),
  ];
}

function sameIds(
  first: string[],
  second: string[],
) {
  if (
    first.length !==
    second.length
  ) {
    return false;
  }

  const firstSet =
    new Set(first);

  return second.every(
    (id) =>
      firstSet.has(id),
  );
}

export async function POST(
  request: NextRequest,
) {
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
      {
        status: 400,
      },
    );
  }

  const gallerySlug =
    cleanString(
      body.gallerySlug,
    );

  const downloadType =
    cleanString(
      body.downloadType,
    );

  const imageIds =
    cleanStringArray(
      body.imageIds,
    );

  const archiveFilename =
    cleanString(
      body.archiveFilename,
    );

  if (
    !gallerySlug ||
    (
      downloadType !==
        "single" &&
      downloadType !==
        "archive"
    ) ||
    imageIds.length === 0
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Invalid download activity.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    downloadType === "single" &&
    imageIds.length !== 1
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "A single download must contain exactly one photograph.",
      },
      {
        status: 400,
      },
    );
  }

  const gallery =
    await getProofingGalleryBySlug(
      gallerySlug,
    );

  if (!gallery) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Gallery not found.",
      },
      {
        status: 404,
      },
    );
  }

  const hasExpiredByDate =
    Boolean(gallery.expiresAt) &&
    new Date(
      gallery.expiresAt as string,
    ).getTime() < Date.now();

  if (
    gallery.status !== "live" ||
    hasExpiredByDate ||
    gallery.downloadPermission ===
      "none"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Downloads are not currently available.",
      },
      {
        status: 403,
      },
    );
  }

  const visitorId =
    request.cookies.get(
      `proofing_${gallery.id}`,
    )?.value;

  if (!visitorId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Your gallery session could not be found.",
      },
      {
        status: 401,
      },
    );
  }

  const visitor =
    gallery.visitors?.find(
      (candidate) =>
        candidate.id ===
        visitorId,
    );

  if (!visitor) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Your gallery session could not be found.",
      },
      {
        status: 401,
      },
    );
  }

  const imageById =
    new Map(
      gallery.images.map(
        (image) => [
          image.id,
          image,
        ],
      ),
    );

  const selectedImages =
    imageIds
      .map(
        (imageId) =>
          imageById.get(
            imageId,
          ),
      )
      .filter(
        (
          image,
        ): image is NonNullable<
          typeof image
        > =>
          Boolean(image),
      );

  if (
    selectedImages.length !==
    imageIds.length
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "One or more downloaded photographs could not be found.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    gallery.downloadPermission ===
    "selected"
  ) {
    const favouriteIds =
      new Set(
        visitor.selection
          .favourites
          .map(
            (favourite) =>
              favourite.imageId,
          ),
      );

    if (
      imageIds.some(
        (imageId) =>
          !favouriteIds.has(
            imageId,
          ),
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "One or more photographs were not selected for download.",
        },
        {
          status: 403,
        },
      );
    }
  }

  if (
    downloadType === "archive"
  ) {
    const expectedImageIds =
      gallery.downloadPermission ===
      "selected"
        ? gallery.images
            .filter(
              (image) =>
                visitor.selection
                  .favourites
                  .some(
                    (favourite) =>
                      favourite.imageId ===
                      image.id,
                  ),
            )
            .map(
              (image) =>
                image.id,
            )
        : gallery.images.map(
            (image) =>
              image.id,
          );

    if (
      !sameIds(
        imageIds,
        expectedImageIds,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "The downloaded archive did not match the current gallery download set.",
        },
        {
          status: 400,
        },
      );
    }
  }

  const saved =
    await recordProofingDownloadEvent({
      galleryId:
        gallery.id,
      visitorId:
        visitor.id,
      visitorEmail:
        visitor.email,
      downloadType:
        downloadType as
          | "single"
          | "archive",
      downloadPermission:
        gallery.downloadPermission,
      imageIds,
      filenames:
        selectedImages.map(
          (image) =>
            image.originalFilename,
        ),
      ...(downloadType ===
        "archive" &&
      archiveFilename
        ? {
            archiveFilename,
          }
        : {}),
    });

  return NextResponse.json({
    ok: true,
    eventId:
      saved.id,
  });
}
