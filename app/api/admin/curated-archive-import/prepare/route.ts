import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  prepareCuratedProduction,
} from "@/lib/curated-archive/prepare-production";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  const url =
    new URL(request.url);

  const folder =
    url.searchParams
      .get("folder")
      ?.trim() ?? "";

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

  const prepared =
    await prepareCuratedProduction(
      folder,
    );

  if (!prepared) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Curated production was not found.",
      },
      {
        status: 404,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    prepared,
  });
}
