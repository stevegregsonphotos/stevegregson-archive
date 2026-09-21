import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import {
  getProofingConsolidatedSelection,
  saveProofingConsolidatedSelection,
} from "@/lib/proofing/consolidated-repository";

import {
  getProofingGallery,
} from "@/lib/proofing/repository";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SaveParticipantRequest = {
  visitorId?: unknown;
  publicLabel?: unknown;
};

type SaveRequest = {
  galleryId?: unknown;
  title?: unknown;
  participants?: unknown;
};

function cleanString(
  value: unknown,
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export async function GET(
  request: Request,
) {
  if (
    !isBackstageRequestAuthenticated(
      request,
    )
  ) {
    return createUnauthorizedResponse();
  }

  const galleryId =
    new URL(request.url)
      .searchParams
      .get("galleryId")
      ?.trim() ?? "";

  if (!galleryId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Gallery ID is required.",
      },
      {
        status: 400,
      },
    );
  }

  const gallery =
    await getProofingGallery(
      galleryId,
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

  const consolidated =
    await getProofingConsolidatedSelection(
      galleryId,
    );

  /*
   * Email is returned only to authenticated
   * Backstage so Steve can identify visitors.
   *
   * It is never stored in the consolidated
   * selection and will never be part of the
   * public/client payload.
   */
  const visitors =
    (gallery.visitors ?? []).map(
      (visitor) => ({
        id: visitor.id,
        email: visitor.email,
        status:
          visitor.selection.status,
        favouriteCount:
          visitor.selection
            .favourites.length,
        submittedFavouriteCount:
          visitor.selection
            .submittedFavourites
            ?.length ?? 0,
        lastSeenAt:
          visitor.lastSeenAt,
      }),
    );

  return NextResponse.json({
    ok: true,
    visitors,
    consolidated,
  });
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

  let body: SaveRequest;

  try {
    body =
      (await request.json()) as
        SaveRequest;
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

  const galleryId =
    cleanString(
      body.galleryId,
    );

  const title =
    cleanString(
      body.title,
    ) ||
    "Consolidated favourites from all participants";

  if (!galleryId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Gallery ID is required.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !Array.isArray(
      body.participants,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Participants are required.",
      },
      {
        status: 400,
      },
    );
  }

  const gallery =
    await getProofingGallery(
      galleryId,
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

  const requestedParticipants =
    body.participants
      .map((value) => {
        if (
          !value ||
          typeof value !== "object"
        ) {
          return null;
        }

        const participant =
          value as
            SaveParticipantRequest;

        const visitorId =
          cleanString(
            participant.visitorId,
          );

        if (!visitorId) {
          return null;
        }

        const publicLabel =
          cleanString(
            participant.publicLabel,
          );

        return {
          visitorId,
          ...(publicLabel
            ? {
                publicLabel,
              }
            : {}),
        };
      })
      .filter(
        (
          participant,
        ): participant is {
          visitorId: string;
          publicLabel?: string;
        } =>
          participant !== null,
      );

  if (
    requestedParticipants.length ===
    0
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Select at least one visitor.",
      },
      {
        status: 400,
      },
    );
  }

  const visitorById =
    new Map(
      (gallery.visitors ?? []).map(
        (visitor) => [
          visitor.id,
          visitor,
        ],
      ),
    );

  const participants = [];

  for (
    const requested
    of requestedParticipants
  ) {
    const visitor =
      visitorById.get(
        requested.visitorId,
      );

    if (!visitor) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "One of the selected visitors no longer belongs to this gallery.",
        },
        {
          status: 400,
        },
      );
    }

    participants.push({
      visitorId:
        visitor.id,
      publicLabel:
        requested.publicLabel,
      imageIds:
        visitor.selection
          .favourites
          .map(
            (favourite) =>
              favourite.imageId,
          ),
    });
  }

  /*
   * IMPORTANT:
   *
   * saveProofingConsolidatedSelection writes
   * only to the two isolated consolidation
   * tables.
   *
   * The source visitor favourites are merely
   * read above and snapshotted here.
   */
  const consolidated =
    await saveProofingConsolidatedSelection(
      {
        galleryId,
        title,
        visible: false,
        participants,
      },
    );

  return NextResponse.json({
    ok: true,
    consolidated,
  });
}
