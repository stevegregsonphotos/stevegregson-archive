import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  buildProofingApprovalPeople,
  clientApprovalPeople,
  getProofingConsolidatedApprovals,
  getProofingConsolidatedSelection,
  toggleProofingConsolidatedApproval,
} from "@/lib/proofing/consolidated-repository";

import {
  getProofingGalleryBaseBySlug,
  getProofingGalleryImageBySlug,
} from "@/lib/proofing/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  gallerySlug?: unknown;
  imageId?: unknown;
  /* The person's name, asked for the first time they approve a photo. */
  name?: unknown;
};

function cleanString(
  value: unknown,
) {
  return typeof value === "string"
    ? value.trim()
    : "";
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
        message: "Invalid request.",
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

  const resolved =
    await getProofingGalleryImageBySlug(
      gallerySlug,
      imageId,
    );

  if (!resolved) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Gallery or photograph not found.",
      },
      {
        status: 404,
      },
    );
  }

  const { gallery } = resolved;

  const hasExpiredByDate =
    Boolean(gallery.expiresAt) &&
    new Date(
      gallery.expiresAt as string,
    ).getTime() < Date.now();

  if (
    gallery.status !== "live" ||
    hasExpiredByDate
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "This gallery is not currently available.",
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
          "Please enter your email address to access this gallery.",
      },
      {
        status: 401,
      },
    );
  }

  const visitorExists =
    (gallery.visitors ?? []).some(
      (visitor) =>
        visitor.id === visitorId,
    );

  if (!visitorExists) {
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

  const consolidated =
    await getProofingConsolidatedSelection(
      gallery.id,
    );

  if (
    !consolidated ||
    !consolidated.visible
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The consolidated selection is not available.",
      },
      {
        status: 404,
      },
    );
  }

  const consolidatedImageIds =
    new Set(
      consolidated.participants
        .flatMap(
          (participant) =>
            participant.imageIds,
        ),
    );

  if (
    !consolidatedImageIds.has(
      imageId,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "This photograph is not part of the consolidated selection.",
      },
      {
        status: 400,
      },
    );
  }

  /*
   * Each person approves for themselves. The first time, we need a name to
   * show the others (participants use their Backstage label if they have one).
   */
  const approvals =
    await getProofingConsolidatedApprovals(
      gallery.id,
    );
  const existing = approvals.find(
    (approval) => approval.visitorId === visitorId,
  );
  const participant = consolidated.participants.find(
    (candidate) => candidate.visitorId === visitorId,
  );
  const name =
    cleanString(body.name).slice(0, 40) ||
    existing?.name ||
    participant?.publicLabel ||
    "";

  if (!name) {
    return NextResponse.json(
      {
        ok: false,
        needName: true,
        message: "Please add your name so others can see who approved.",
      },
      { status: 409 },
    );
  }

  const imageIds =
    await toggleProofingConsolidatedApproval(
      gallery.id,
      visitorId,
      imageId,
      name,
      existing ? [] : participant?.imageIds ?? [],
    );

  const people = buildProofingApprovalPeople(
    consolidated,
    await getProofingConsolidatedApprovals(gallery.id),
  );

  return NextResponse.json({
    ok: true,
    selected: imageIds.includes(imageId),
    approvers: clientApprovalPeople(people, visitorId),
  });
}

export async function GET(
  request: NextRequest,
) {
  const gallerySlug =
    cleanString(
      request.nextUrl.searchParams.get(
        "gallerySlug",
      ),
    );

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

  const gallery =
    await getProofingGalleryBaseBySlug(
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
    hasExpiredByDate
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "This gallery is not currently available.",
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
          "Please enter your email address to access this gallery.",
      },
      {
        status: 401,
      },
    );
  }

  const visitorExists =
    (gallery.visitors ?? []).some(
      (visitor) =>
        visitor.id === visitorId,
    );

  if (!visitorExists) {
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

  const consolidated =
    await getProofingConsolidatedSelection(
      gallery.id,
    );

  if (
    !consolidated ||
    !consolidated.visible
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The consolidated selection is not available.",
      },
      {
        status: 404,
      },
    );
  }

  const people = buildProofingApprovalPeople(
    consolidated,
    await getProofingConsolidatedApprovals(gallery.id),
  );

  return NextResponse.json({
    ok: true,
    approvers: clientApprovalPeople(people, visitorId),
  });
}
