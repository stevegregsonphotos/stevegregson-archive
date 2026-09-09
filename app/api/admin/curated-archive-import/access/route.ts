import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCESS_OVERRIDE_PATH = path.resolve(
  "scripts/archive-curator/archive-access-overrides.json",
);

type AccessValue =
  | "public"
  | "password";

type AccessPayload = {
  production?: unknown;
  access?: unknown;
};

export async function POST(
  request: Request,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  let body: AccessPayload;

  try {
    body =
      (await request.json()) as AccessPayload;
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
      {
        ok: false,
        message: "Production is required.",
      },
      {
        status: 400,
      },
    );
  }

  if (!access) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid access setting.",
      },
      {
        status: 400,
      },
    );
  }

  let overrides: Record<
    string,
    AccessValue
  > = {};

  try {
    overrides =
      JSON.parse(
        await fs.readFile(
          ACCESS_OVERRIDE_PATH,
          "utf8",
        ),
      ) as Record<
        string,
        AccessValue
      >;
  } catch {}

  if (access === "automatic") {
    delete overrides[production];
  } else {
    overrides[production] = access;
  }

  await fs.writeFile(
    ACCESS_OVERRIDE_PATH,
    `${JSON.stringify(
      overrides,
      null,
      2,
    )}\n`,
    "utf8",
  );

  return NextResponse.json({
    ok: true,
    production,
    access,
  });
}
