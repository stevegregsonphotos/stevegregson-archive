import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  moveProductionWithinArchiveMonth,
} from "@/lib/productions-repository";
import { revalidateProductionContent } from "@/lib/revalidate-public-content";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  slug?: unknown;
  direction?: unknown;
};

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

  const slug =
    typeof body.slug === "string"
      ? body.slug.trim()
      : "";

  const direction =
    body.direction === "up" ||
    body.direction === "down"
      ? body.direction
      : null;

  if (
    !slug ||
    !direction
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Production and direction are required.",
      },
      { status: 400 },
    );
  }

  try {
    const result =
      await moveProductionWithinArchiveMonth(
        slug,
        direction,
      );

    if (!result) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Production could not be moved.",
        },
        { status: 409 },
      );
    }

    // The archive page lists productions in this order.
    if (result.moved) {
      // Order only changes the archive lists, not any production's own page data.
      revalidateProductionContent([]);
    }

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Archive production reorder failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Production order could not be changed.",
      },
      { status: 500 },
    );
  }
}
