import { NextResponse } from "next/server";
import { getShareByToken } from "@/lib/shares/repository";
import { TRASH_FOLDER, archiveKeyFor, archiveThumbnailUrl } from "@/lib/client-archive/storage";
import { checkSharePath } from "@/lib/shares/thumb-sign";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const url = new URL(request.url);
  const path = url.searchParams.get("path") || "";
  const signature = url.searchParams.get("s") || "";
  try {
    if (!path || path.split("/").some((part) => !part || part === "." || part === "..") || !checkSharePath(token, path, signature)) {
      return new NextResponse(null, { status: 403 });
    }
    const found = await getShareByToken(token);
    if (!found || found.share.path.split("/")[0] === TRASH_FOLDER) return new NextResponse(null, { status: 404 });
    const target = await archiveThumbnailUrl(archiveKeyFor(found.share.path + "/" + path));
    return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "private, max-age=3600" } });
  } catch {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, max-age=300" } });
  }
}
