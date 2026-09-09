import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  CuratedProductionNotFoundError,
  CuratedProductionNotReadyError,
  publishCuratedProduction,
} from "@/lib/curated-archive/publish-production";
import {
  ProductionConflictError,
} from "@/lib/publishing/publish-production";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublishRequest = {
  folder?: unknown;
};

export async function POST(
  request: Request,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  let body: PublishRequest;

  try {
    body =
      (await request.json()) as PublishRequest;
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

  const folder =
    typeof body.folder === "string"
      ? body.folder.trim()
      : "";

  if (!folder) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Curated folder is required.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const {
      prepared,
      result,
    } =
      await publishCuratedProduction(
        folder,
      );

    return NextResponse.json({
      ok: true,
      message:
        `${prepared.payload?.title ?? prepared.production} was published from the curated archive.`,
      ...result,
    });
  } catch (error) {
    console.error(
      "Curated production publishing failed:",
      error,
    );

    if (
      error instanceof
      CuratedProductionNotFoundError
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: error.message,
        },
        {
          status: 404,
        },
      );
    }

    if (
      error instanceof
        CuratedProductionNotReadyError ||
      error instanceof
        ProductionConflictError
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: error.message,
        },
        {
          status: 409,
        },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "The curated production could not be published.",
      },
      {
        status: 500,
      },
    );
  }
}
