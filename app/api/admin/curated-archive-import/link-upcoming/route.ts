import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  getCuratedArchiveOverrides,
  setCuratedArchiveOverride,
  type CuratedArchiveCredit,
  type CuratedArchiveOverride,
} from "@/lib/curated-archive-overrides-repository";
import { rememberDirectoryCredits } from "@/lib/directory-writer";
import { getUpcomingDraft } from "@/lib/upcoming-productions-repository";
import { isValidUpcomingId } from "@/lib/upcoming-productions";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Curated import started from Productions › Upcoming (?upcoming=<id>):
 * just before Import, copy the upcoming draft's details and credits onto
 * the curated production and link the two, so the published production
 * uses them and the draft leaves the Upcoming list.
 *
 * Same rules as "Use details from an upcoming production" on the Edit
 * page: blank fields in the draft keep what the curator researched; the
 * photo choices are never touched.
 */
export async function POST(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  let body: { production?: unknown; upcomingId?: unknown };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const production = typeof body.production === "string" ? body.production.trim() : "";

  if (!production || !isValidUpcomingId(body.upcomingId)) {
    return NextResponse.json(
      { ok: false, message: "Production and upcoming production are required." },
      { status: 400 },
    );
  }

  const overrides = await getCuratedArchiveOverrides();
  const existing: CuratedArchiveOverride = overrides[production] ?? {};

  // Already linked (to this draft or, chosen on the Edit page, another).
  if (existing.upcomingId) {
    return NextResponse.json({ ok: true, linked: false, reason: "already-linked" });
  }

  const draft = await getUpcomingDraft(body.upcomingId);

  // Missing, or already used for another production (e.g. the first cast
  // of a double cast): import with the curated details as before.
  if (!draft || draft.status !== "draft") {
    return NextResponse.json({ ok: true, linked: false, reason: "not-available" });
  }

  const month = Number.parseInt(draft.month, 10);
  const year = Number.parseInt(draft.year, 10);

  const credits: CuratedArchiveCredit[] = draft.credits
    .map((credit) => ({
      role: credit.role.trim(),
      name: credit.name.trim(),
      ...(credit.website?.trim() ? { website: credit.website.trim() } : {}),
    }))
    .filter((credit) => credit.role && credit.name);

  const next: CuratedArchiveOverride = {
    ...existing,
    ...(draft.title.trim() ? { title: draft.title.trim() } : {}),
    ...(draft.venue.trim() ? { venue: draft.venue.trim() } : {}),
    ...(month >= 1 && month <= 12 ? { month } : {}),
    ...(Number.isInteger(year) && year > 1900 ? { year } : {}),
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    ...(credits.length > 0 ? { credits } : {}),
    upcomingId: draft.id,
  };

  await setCuratedArchiveOverride(production, next);

  if (credits.length > 0) {
    try {
      await rememberDirectoryCredits(credits);
    } catch (error) {
      // Not fatal: the People directory catches up on the next edit.
      console.error("Directory sync after linking upcoming failed:", error);
    }
  }

  return NextResponse.json({
    ok: true,
    linked: true,
    title: next.title ?? null,
  });
}
