import { NextResponse } from "next/server";

import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import { getAdminProductionSummaries } from "@/lib/productions-repository";
import {
  createProductionImageReplaceUrl,
  listProductionImageObjects,
} from "@/lib/publishing/production-image-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Backstage › Settings › Convert photos to WebP.
 * Photos uploaded from Safari were stored as PNG/JPEG under .webp names
 * (Safari can't make WebP). Steve's browser re-encodes them; this route only
 * lists files and hands out upload links that replace a file in place, so
 * no production records change. Never reads or converts images itself.
 */

const SAFE_RELATIVE = /^(?:__cards\/)?[A-Za-z0-9][A-Za-z0-9._-]*\.webp$/;

export async function POST(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  let body: { action?: unknown; slug?: unknown; paths?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  try {
    if (body.action === "productions") {
      const productions = await getAdminProductionSummaries();
      return NextResponse.json({
        ok: true,
        productions: productions.map((p) => ({ slug: p.slug, title: p.title, imageCount: p.imageCount })),
      });
    }

    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    if (!slug || slug.includes("/") || slug.includes("..")) {
      return NextResponse.json({ ok: false, message: "Production is required." }, { status: 400 });
    }

    if (body.action === "files") {
      const objects = await listProductionImageObjects(slug);
      const files = objects
        .map((o) => ({ path: o.key.slice(slug.length + 1), size: o.size }))
        .filter((f) => SAFE_RELATIVE.test(f.path));
      return NextResponse.json({ ok: true, files });
    }

    if (body.action === "sign") {
      const paths = Array.isArray(body.paths) ? body.paths : [];
      if (paths.length === 0 || paths.length > 100 || !paths.every((p) => typeof p === "string" && SAFE_RELATIVE.test(p))) {
        return NextResponse.json({ ok: false, message: "Invalid file list." }, { status: 400 });
      }
      const urls: Record<string, string> = {};
      for (const path of paths as string[]) {
        urls[path] = await createProductionImageReplaceUrl(slug, path);
      }
      return NextResponse.json({ ok: true, urls });
    }

    return NextResponse.json({ ok: false, message: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("WebP convert route failed:", error);
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Something went wrong." },
      { status: 500 },
    );
  }
}
