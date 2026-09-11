import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "../../../../lib/backstage-auth";
import {
  softDeleteProduction,
} from "../../../../lib/productions-repository";
import {
  deleteProductionImages,
} from "../../../../lib/publishing/production-image-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeleteRequest = {
  slug?: unknown;
  confirmation?: unknown;
};

function isSafeSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export async function POST(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }
  try {
    const body = (await request.json()) as DeleteRequest;
    if (typeof body.slug !== "string" || !isSafeSlug(body.slug)) {
      return Response.json(
        { ok: false, message: "A valid production slug is required." },
        { status: 400 },
      );
    }
    if (body.confirmation !== "DELETE") {
      return Response.json(
        { ok: false, message: "Type DELETE to confirm permanent deletion." },
        { status: 400 },
      );
    }

    const deleted = await softDeleteProduction(body.slug);
    if (!deleted) {
      return Response.json(
        { ok: false, message: "That production no longer exists." },
        { status: 404 },
      );
    }

    let cleanupWarning: string | null = null;
    try {
      await deleteProductionImages(body.slug);
    } catch (cleanupError) {
      console.error(
        "Production was removed from Neon, but its R2 images could not be fully cleaned up:",
        cleanupError,
      );
      cleanupWarning =
        "The production record was removed, but some old R2 objects could not be cleaned up.";
    }

    return Response.json({
      ok: true,
      message: cleanupWarning ?? "Production deleted permanently.",
      redirectTo: "/admin/productions",
    });
  } catch (error) {
    console.error("Production deletion failed:", error);
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : "The production could not be deleted." },
      { status: 500 },
    );
  }
}
