import { NextResponse } from "next/server";
import { isBackstageRequestAuthenticated } from "@/lib/backstage-auth";
import { archiveThumbnailUrl } from "@/lib/client-archive/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

// Small preview of a Storage photo (Backstage only). Redirects to the stored
// preview, making it first if this is the first time it's been looked at.
export async function GET(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) return new NextResponse(null, { status: 401 });
  const key = new URL(request.url).searchParams.get("key") || "";
  try {
    const url = await archiveThumbnailUrl(key);
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=3600" } });
  } catch {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, max-age=300" } });
  }
}
