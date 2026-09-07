import { NextResponse } from "next/server";

import {
  BACKSTAGE_COOKIE_NAME,
  backstageCredentialsMatch,
  createBackstageSession,
  getBackstageCookieOptions,
} from "../../../../lib/backstage-auth";
import {
  clearBackstageLoginFailures,
  isBackstageLoginRateLimited,
  recordBackstageLoginFailure,
} from "../../../../lib/backstage-login-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
) {
  try {
    if (
      await isBackstageLoginRateLimited(
        request,
      )
    ) {
      const loginUrl = new URL(
        "/admin/login",
        request.url,
      );

      loginUrl.searchParams.set(
        "error",
        "rate_limited",
      );

      return NextResponse.redirect(
        loginUrl,
        {
          status: 303,
          headers: {
            "Retry-After": "900",
          },
        },
      );
    }

    const formData =
      await request.formData();

    const usernameValue =
      formData.get("username");

    const passwordValue =
      formData.get("password");

    const username =
      typeof usernameValue === "string"
        ? usernameValue.trim()
        : "";

    const password =
      typeof passwordValue === "string"
        ? passwordValue
        : "";

    if (
      !username ||
      !password ||
      !backstageCredentialsMatch(
        username,
        password,
      )
    ) {
      await recordBackstageLoginFailure(
        request,
      );

      const loginUrl = new URL(
        "/admin/login",
        request.url,
      );

      loginUrl.searchParams.set(
        "error",
        "invalid",
      );

      return NextResponse.redirect(
        loginUrl,
        {
          status: 303,
        },
      );
    }

    await clearBackstageLoginFailures(
      request,
    );

    const session =
      createBackstageSession(username);

    const response =
      NextResponse.redirect(
        new URL("/admin", request.url),
        {
          status: 303,
        },
      );

    response.cookies.set(
      BACKSTAGE_COOKIE_NAME,
      session,
      getBackstageCookieOptions(),
    );

    return response;
  } catch (error) {
    console.error(
      "Backstage login failed:",
      error,
    );

    const loginUrl = new URL(
      "/admin/login",
      request.url,
    );

    loginUrl.searchParams.set(
      "error",
      "configuration",
    );

    return NextResponse.redirect(
      loginUrl,
      {
        status: 303,
      },
    );
  }
}