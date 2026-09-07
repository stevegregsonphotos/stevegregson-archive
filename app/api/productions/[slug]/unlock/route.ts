import { cookies } from "next/headers";

import {
  createProductionAccessToken,
  productionAccessCookieName,
  productionPasswordMatches,
} from "../../../../../lib/production-access";
import { getProduction } from "../../../../../lib/productions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UnlockPayload = {
  password?: string;
};

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
    !production.accessPasswordEncrypted
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

  if (
    !productionPasswordMatches(
      password,
      production.accessPasswordEncrypted,
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
    productionAccessCookieName(production.slug),
    createProductionAccessToken(
      production.slug,
      production.accessPasswordEncrypted,
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