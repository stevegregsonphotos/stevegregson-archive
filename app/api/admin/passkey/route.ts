import { NextResponse } from "next/server";
import { readBackstageSessionFromRequest } from "@/lib/backstage-auth";
import {
  CHALLENGE_COOKIE,
  deletePasskey,
  finishRegistration,
  listPasskeys,
  openChallenge,
  passkeyOnly,
  readCookie,
  registrationOptions,
  sealChallenge,
  setPasskeyOnly,
} from "@/lib/passkeys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Managing Touch ID / Face ID from Backstage › Settings (signed-in only).
export async function POST(request: Request) {
  const session = readBackstageSessionFromRequest(request);
  if (!session) return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = body.action;
    const overview = async () => ({
      passkeys: await listPasskeys(),
      passkeyOnly: await passkeyOnly(),
      overridden: process.env.BACKSTAGE_ALLOW_PASSWORD?.trim() === "1",
    });

    if (action === "list") return NextResponse.json({ ok: true, ...(await overview()) });

    if (action === "register-options") {
      const options = await registrationOptions(request, session.username);
      const response = NextResponse.json({ ok: true, options });
      response.cookies.set(CHALLENGE_COOKIE, sealChallenge(options.challenge, "register"), {
        httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 300,
      });
      return response;
    }
    if (action === "register-verify") {
      const challenge = openChallenge(readCookie(request, CHALLENGE_COOKIE), "register");
      if (!challenge) throw new Error("That took too long. Please try again.");
      await finishRegistration(request, challenge, body.response as never, typeof body.name === "string" ? body.name : "");
      return NextResponse.json({ ok: true, ...(await overview()) });
    }
    if (action === "delete") {
      await deletePasskey(String(body.id || ""));
      return NextResponse.json({ ok: true, ...(await overview()) });
    }
    if (action === "set-only") {
      await setPasskeyOnly(body.on === true);
      return NextResponse.json({ ok: true, ...(await overview()) });
    }
    return NextResponse.json({ ok: false, message: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("Passkey settings failed", error);
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Something went wrong." }, { status: 400 });
  }
}
