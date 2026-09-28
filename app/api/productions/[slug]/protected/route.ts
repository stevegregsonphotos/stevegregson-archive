import { cookies } from "next/headers";

import {
  createProductionAccessToken,
  productionAccessCookieName,
  productionAccessTokenMatches,
} from "../../../../../lib/production-access";
import {
  getNextProductionFromData,
  getProduction,
  getPublicProductionNavigation,
} from "../../../../../lib/productions-repository";
import {
  getDirectory,
} from "../../../../../lib/directory-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      slug: string;
    }>;
  },
) {
  const { slug } = await params;
  const production =
    await getProduction(slug);

  if (!production) {
    return Response.json(
      {
        ok: false,
        message: "Production not found.",
      },
      {
        status: 404,
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      },
    );
  }

  if (
    production.access !== "password" ||
    !production.accessPasswordEncrypted
  ) {
    return Response.json(
      {
        ok: false,
        message:
          "Protected production not available.",
      },
      {
        status: 404,
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      },
    );
  }

  const cookieStore = await cookies();

  const storedToken =
    cookieStore.get(
      productionAccessCookieName(
        production.slug,
      ),
    )?.value;

  const expectedToken =
    createProductionAccessToken(
      production.slug,
      production.accessPasswordEncrypted,
    );

  if (
    !storedToken ||
    !productionAccessTokenMatches(
      storedToken,
      expectedToken,
    )
  ) {
    return Response.json(
      {
        ok: false,
        message: "Access required.",
      },
      {
        status: 401,
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      },
    );
  }

  const [
    directory,
    publicNavigation,
  ] = await Promise.all([
    getDirectory(),
    getPublicProductionNavigation(),
  ]);

  const nextProduction =
    getNextProductionFromData(
      publicNavigation,
      production.slug,
    );

  const {
    accessPasswordEncrypted: _password,
    ...safeProduction
  } = production;

  return Response.json(
    {
      ok: true,
      production: safeProduction,
      directory,
      ...(nextProduction
        ? { nextProduction }
        : {}),
    },
    {
      headers: {
        "Cache-Control":
          "private, no-store",
      },
    },
  );
}
