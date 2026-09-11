import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  setCuratedArchiveAccessOverride,
} from "@/lib/curated-archive-overrides-repository";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AccessPayload = {
  production?: unknown;
  access?: unknown;
};

export async function POST(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  let body: AccessPayload;
  try {
    body = (await request.json()) as AccessPayload;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid request." },
      { status: 400 },
    );
  }

  const production =
    typeof body.production === "string"
      ? body.production.trim()
      : "";
  const access =
    body.access === "public" ||
    body.access === "password" ||
    body.access === "automatic"
      ? body.access
      : null;

  if (!production) {
    return NextResponse.json(
      { ok: false, message: "Production is required." },
      { status: 400 },
    );
  }
  if (!access) {
    return NextResponse.json(
      { ok: false, message: "Invalid access setting." },
      { status: 400 },
    );
  }

  await setCuratedArchiveAccessOverride(
    production,
    access === "automatic" ? null : access,
  );

  return NextResponse.json({ ok: true, production, access });
}
