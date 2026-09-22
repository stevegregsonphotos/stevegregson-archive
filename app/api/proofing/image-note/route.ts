import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  deleteProofingImageNote,
  getProofingImageNotesForVisitor,
  upsertProofingImageNote,
} from "@/lib/proofing/image-notes-repository";

import {
  getProofingGalleryBySlug,
} from "@/lib/proofing/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImageNoteRequest = {
  gallerySlug?: unknown;
  imageId?: unknown;
  note?: unknown;
};

function cleanString(
  value: unknown,
) {
  return typeof value === "string"
    ? value.trim()
    : "";
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

  const notes =
    await getProofingImageNotesForVisitor(
      context.gallery.id,
      context.visitor.id,
    );

  return NextResponse.json({
    ok: true,
    notes,
  });
}

export async function POST(
  request: NextRequest,
) {
  let body: ImageNoteRequest;

  try {
    body =
      (await request.json()) as
        ImageNoteRequest;
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

  const imageId =
    cleanString(
      body.imageId,
    );

  const note =
    cleanString(
      body.note,
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

  if (note.length > 2000) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Image notes must be 2000 characters or fewer.",
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

  if (!note) {
    await deleteProofingImageNote(
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
    await upsertProofingImageNote({
      galleryId:
        context.gallery.id,
      visitorId:
        context.visitor.id,
      imageId,
      note,
    });

  return NextResponse.json({
    ok: true,
    deleted: false,
    note: saved,
  });
}
