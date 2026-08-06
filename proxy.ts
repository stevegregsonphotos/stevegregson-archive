import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  BACKSTAGE_COOKIE_NAME,
  readBackstageSession,
} from "./lib/backstage-auth";

const LOGIN_PAGE = "/admin/login";
const LOGIN_API = "/api/admin/login";
const LOGOUT_API = "/api/admin/logout";

export function proxy(
  request: NextRequest,
) {
  const pathname =
    request.nextUrl.pathname;

  const sessionToken =
    request.cookies.get(
      BACKSTAGE_COOKIE_NAME,
    )?.value;

  const session =
    readBackstageSession(sessionToken);

  const isLoginPage =
    pathname === LOGIN_PAGE;

  const isPublicAdminApi =
    pathname === LOGIN_API ||
    pathname === LOGOUT_API;

  const isAdminApi =
    pathname.startsWith("/api/admin");

  if (
    isLoginPage &&
    session
  ) {
    return NextResponse.redirect(
      new URL("/admin", request.url),
    );
  }

  if (
    isLoginPage ||
    isPublicAdminApi
  ) {
    return NextResponse.next();
  }

  if (!session && isAdminApi) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Your Backstage session is missing or has expired.",
      },
      {
        status: 401,
      },
    );
  }

  if (!session) {
    const loginUrl = new URL(
      LOGIN_PAGE,
      request.url,
    );

    loginUrl.searchParams.set(
      "returnTo",
      pathname,
    );

    return NextResponse.redirect(
      loginUrl,
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};