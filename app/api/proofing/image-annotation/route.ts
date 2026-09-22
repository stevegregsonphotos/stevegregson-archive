import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  deleteProofingImageAnnotation,
  getProofingImageAnnotationsForVisitor,
  upsertProofingImageAnnotation,
  type ProofingAnnotationDocument,
  type ProofingAnnotationMark,
  type ProofingAnnotationPoint,
} from "@/lib/proofing/image-annotations-repository";

import {
  getProofingGalleryBySlug,
} from "@/lib/proofing/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnnotationRequest = {
  gallerySlug?: unknown;
  imageId?: unknown;
  annotation?: unknown;
};

function cleanString(
  value: unknown,
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function validCoordinate(
  value: unknown,
) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function validPoint(
  value: unknown,
): value is ProofingAnnotationPoint {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const point =
    value as Record<string, unknown>;

  return (
    validCoordinate(point.x) &&
    validCoordinate(point.y)
  );
}

function validMark(
  value: unknown,
): value is ProofingAnnotationMark {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const mark =
    value as Record<string, unknown>;

  const id =
    cleanString(mark.id);

  const type =
    cleanString(mark.type);

  if (
    !id ||
    id.length > 100
  ) {
    return false;
  }

  if (type === "pen") {
    if (
      !Array.isArray(
        mark.points,
      ) ||
      mark.points.length < 2 ||
      mark.points.length > 2000
    ) {
      return false;
    }

    return mark.points.every(
      validPoint,
    );
  }

  if (
    type === "circle" ||
    type === "arrow"
  ) {
    return (
      validPoint(mark.start) &&
      validPoint(mark.end)
    );
  }

  return false;
}

function parseAnnotationDocument(
  value: unknown,
): ProofingAnnotationDocument | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const document =
    value as Record<string, unknown>;

  if (
    document.version !== 1 ||
    !Array.isArray(
      document.marks,
    ) ||
    document.marks.length > 100 ||
    !document.marks.every(
      validMark,
    )
  ) {
    return null;
  }

  return {
    version: 1,
    marks:
      document.marks as ProofingAnnotationMark[],
  };
}

async function authenticatedContext(
  request: NextRequest,
  gallerySlug: string,
) {
  const gallery =
    await getProofingGalleryBySlug(
      gallerySlug,
    );

  if (!gallery) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          message:
            "Gallery not found.",
        },
        {
          status: 404,
        },
      ),
    };
  }

  const hasExpiredByDate =
    Boolean(gallery.expiresAt) &&
    new Date(
      gallery.expiresAt as string,
    ).getTime() < Date.now();

  if (
    gallery.status !== "live" ||
    hasExpiredByDate
  ) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          message:
            "This gallery is not currently available.",
        },
        {
          status: 403,
        },
      ),
    };
  }

  const visitorId =
    request.cookies.get(
      `proofing_${gallery.id}`,
    )?.value;

  if (!visitorId) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          message:
            "Please enter your email address to access this gallery.",
        },
        {
          status: 401,
        },
      ),
    };
  }

  const visitor =
    gallery.visitors.find(
      (candidate) =>
        candidate.id ===
        visitorId,
    );

  if (!visitor) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          message:
            "Your gallery session could not be found.",
        },
        {
          status: 401,
        },
      ),
    };
  }

  return {
    gallery,
    visitor,
  };
}

export async function GET(
  request: NextRequest,
) {
  const gallerySlug =
    request.nextUrl.searchParams
      .get("gallery")
      ?.trim() ?? "";

  if (!gallerySlug) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Gallery is required.",
      },
      {
        status: 400,
      },
    );
  }

  const context =
    await authenticatedContext(
      request,
      gallerySlug,
    );

  if ("error" in context) {
    return context.error;
  }

  const annotations =
    await getProofingImageAnnotationsForVisitor(
      context.gallery.id,
      context.visitor.id,
    );

  return NextResponse.json({
    ok: true,
    annotations,
  });
}

export async function POST(
  request: NextRequest,
) {
  let body: AnnotationRequest;

  try {
    body =
      (await request.json()) as
        AnnotationRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Invalid annotation request.",
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

  const imageId =
    cleanString(
      body.imageId,
    );

  if (
    !gallerySlug ||
    !imageId
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Gallery and image are required.",
      },
      {
        status: 400,
      },
    );
  }

  const context =
    await authenticatedContext(
      request,
      gallerySlug,
    );

  if ("error" in context) {
    return context.error;
  }

  const imageExists =
    context.gallery.images.some(
      (image) =>
        image.id === imageId,
    );

  if (!imageExists) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Image not found.",
      },
      {
        status: 404,
      },
    );
  }

  if (body.annotation === null) {
    await deleteProofingImageAnnotation(
      context.gallery.id,
      context.visitor.id,
      imageId,
    );

    return NextResponse.json({
      ok: true,
      deleted: true,
      imageId,
    });
  }

  const annotation =
    parseAnnotationDocument(
      body.annotation,
    );

  if (!annotation) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Invalid annotation data.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    annotation.marks.length === 0
  ) {
    await deleteProofingImageAnnotation(
      context.gallery.id,
      context.visitor.id,
      imageId,
    );

    return NextResponse.json({
      ok: true,
      deleted: true,
      imageId,
    });
  }

  const saved =
    await upsertProofingImageAnnotation({
      galleryId:
        context.gallery.id,
      visitorId:
        context.visitor.id,
      imageId,
      annotation,
    });

  return NextResponse.json({
    ok: true,
    deleted: false,
    annotation: saved,
  });
}
