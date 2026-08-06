import { NextResponse } from "next/server";

import {
  BACKSTAGE_COOKIE_NAME,
  getBackstageCookieOptions,
} from "../../../../lib/backstage-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
) {
  const response = NextResponse.redirect(
    new URL("/admin/login", request.url),
    {
      status: 303,
    },
  );

  response.cookies.set(
    BACKSTAGE_COOKIE_NAME,
    "",
    {
      ...getBackstageCookieOptions(),
      maxAge: 0,
      expires: new Date(0),
    },
  );

  return response;
}