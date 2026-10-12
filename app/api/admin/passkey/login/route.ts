import { NextResponse } from "next/server";
import {
  BACKSTAGE_COOKIE_NAME,
  createBackstageSession,
  getBackstageCookieOptions,
} from "@/lib/backstage-auth";
import {
  CHALLENGE_COOKIE,
  authenticationOptions,
  finishAuthentication,
  openChallenge,
  readCookie,
  sealChallenge,
} from "@/lib/passkeys";
import {
  clearBackstageLoginFailures,
  isBackstageLoginRateLimited,
  recordBackstageLoginFailure,
} from "@/lib/backstage-login-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Signing in to Backstage with Touch ID / Face ID.
export async function POST(request: Request) {
  try {
    if (await isBackstageLoginRateLimited(request)) {
      return NextResponse.json({ ok: false, message: "Too many attempts. Please wait 15 minutes." }, { status: 429 });
    }
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    if (body.step === "options") {
      const options = await authenticationOptions(request);
      const response = NextResponse.json({ ok: true, options });
      response.cookies.set(CHALLENGE_COOKIE, sealChallenge(options.challenge, "login"), {
        httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 300,
      });
      return response;
    }

    const challenge = openChallenge(readCookie(request, CHALLENGE_COOKIE), "login");
    if (!challenge) return NextResponse.json({ ok: false, message: "That took too long. Please try again." }, { status: 400 });
    try {
      await finishAuthentication(request, challenge, body.response as never);
    } catch (error) {
      await recordBackstageLoginFailure(request);
      throw error;
    }
    await clearBackstageLoginFailures(request);

    const next = typeof body.next === "string" && body.next.startsWith("/") && !body.next.startsWith("//") ? body.next : "/admin";
    const response = NextResponse.json({ ok: true, next });
    response.cookies.set(BACKSTAGE_COOKIE_NAME, createBackstageSession(process.env.BACKSTAGE_USERNAME?.trim() || "steve"), getBackstageCookieOptions());
    response.cookies.set(CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("Passkey sign-in failed", error);
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Couldn't sign in." }, { status: 400 });
  }
}
