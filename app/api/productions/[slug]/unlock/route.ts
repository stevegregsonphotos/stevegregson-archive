import {
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";

import { getProduction } from "../../../../../lib/productions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UnlockPayload = {
  password?: string;
};

function hashPassword(password: string) {
  return createHash("sha256")
    .update(password, "utf8")
    .digest("hex");
}

function safeCompare(
  first: string,
  second: string,
) {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);

  if (
    firstBuffer.length !==
    secondBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    firstBuffer,
    secondBuffer,
  );
}

function createAccessToken(
  slug: string,
  passwordHash: string,
) {
  return createHash("sha256")
    .update(
      `steve-gregson-production-access:${slug}:${passwordHash}`,
      "utf8",
    )
    .digest("hex");
}

function cookieName(slug: string) {
  return `sg-production-access-${slug}`;
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      slug: string;
    }>;
  },
) {
  const { slug } = await params;
  const production = getProduction(slug);

  if (!production) {
    return Response.json(
      {
        ok: false,
        message: "Production not found.",
      },
      {
        status: 404,
      },
    );
  }

  if (
    production.access !== "password"
  ) {
    return Response.json({
      ok: true,
    });
  }

  if (
    !production.accessPasswordHash
  ) {
    return Response.json(
      {
        ok: false,
        message:
          "This production is locked but no password has been configured.",
      },
      {
        status: 500,
      },
    );
  }

  let payload: UnlockPayload;

  try {
    payload =
      (await request.json()) as UnlockPayload;
  } catch {
    return Response.json(
      {
        ok: false,
        message: "Invalid request.",
      },
      {
        status: 400,
      },
    );
  }

  const password =
    payload.password?.trim() ?? "";

  if (!password) {
    return Response.json(
      {
        ok: false,
        message: "Enter the password.",
      },
      {
        status: 400,
      },
    );
  }

  const submittedHash =
    hashPassword(password);

  if (
    !safeCompare(
      submittedHash,
      production.accessPasswordHash,
    )
  ) {
    return Response.json(
      {
        ok: false,
        message: "Incorrect password.",
      },
      {
        status: 401,
      },
    );
  }

  const cookieStore = await cookies();

  cookieStore.set(
    cookieName(production.slug),
    createAccessToken(
      production.slug,
      production.accessPasswordHash,
    ),
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV ===
        "production",
      path: `/productions/${production.slug}`,
      maxAge: 60 * 60 * 24 * 30,
    },
  );

  return Response.json({
    ok: true,
  });
}