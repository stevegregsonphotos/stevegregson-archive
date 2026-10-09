import { NextResponse } from "next/server";
import { runDailyCleanup } from "@/lib/transfers/cleanup";

// Called once a day by Vercel Cron (see vercel.json). Vercel sends the
// CRON_SECRET as a bearer token; without that secret set, nothing runs.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, message: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== "Bearer " + secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const summary = await runDailyCleanup();
  return NextResponse.json({ ok: summary.errors.length === 0, ...summary });
}
