import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  UpcomingStoreError,
  createUpcomingDraft,
  deleteUpcomingDraft,
  getUpcomingDraft,
  listUpcomingDrafts,
  markUpcomingDraftPublished,
  updateUpcomingDraft,
} from "@/lib/upcoming-productions-repository";
import {
  cleanUpcomingInput,
  isValidUpcomingId,
  summariseUpcoming,
} from "@/lib/upcoming-productions";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Backstage: Upcoming productions (private drafts, never public).
 *   GET               list of drafts (summaries)
 *   GET ?id=<id>      one draft, in full
 *   POST { action: "create", draft }
 *   POST { action: "update", id, draft }
 *   POST { action: "delete", id, confirmation: "DELETE" }
 *   POST { action: "published", id, url }   after Upload & publish succeeds
 */

const MAX_BODY_BYTES = 250_000;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function failure(error: unknown) {
  if (error instanceof UpcomingStoreError) {
    return json({ ok: false, message: error.message }, error.status);
  }
  console.error("Upcoming productions request failed:", error);
  return json({ ok: false, message: "Something went wrong. Nothing was changed — please try again." }, 500);
}

export async function GET(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  try {
    const id = new URL(request.url).searchParams.get("id");
    if (id !== null) {
      if (!isValidUpcomingId(id)) {
        return json({ ok: false, message: "That upcoming production could not be found." }, 404);
      }
      const draft = await getUpcomingDraft(id);
      if (!draft) {
        return json({ ok: false, message: "That upcoming production could not be found." }, 404);
      }
      return json({ ok: true, draft });
    }

    const drafts = await listUpcomingDrafts();
    return json({ ok: true, drafts: drafts.map(summariseUpcoming) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return json({ ok: false, message: "That's too much to save in one go. Try shortening the notes." }, 413);
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, message: "Invalid request." }, 400);
  }

  const action = body.action;

  try {
    if (action === "create") {
      const draft = await createUpcomingDraft(cleanUpcomingInput(body.draft));
      return json({ ok: true, draft });
    }

    if (!isValidUpcomingId(body.id)) {
      return json({ ok: false, message: "That upcoming production could not be found." }, 404);
    }
    const id = body.id;

    if (action === "update") {
      const draft = await updateUpcomingDraft(id, cleanUpcomingInput(body.draft));
      return json({ ok: true, draft });
    }

    if (action === "delete") {
      if (body.confirmation !== "DELETE") {
        return json({ ok: false, message: "Please confirm before deleting." }, 400);
      }
      await deleteUpcomingDraft(id);
      return json({ ok: true });
    }

    if (action === "published") {
      const url = typeof body.url === "string" ? body.url : "";
      const draft = await markUpcomingDraftPublished(id, url);
      return json({ ok: true, draft });
    }

    return json({ ok: false, message: "Unknown action." }, 400);
  } catch (error) {
    return failure(error);
  }
}
