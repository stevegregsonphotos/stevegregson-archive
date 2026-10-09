import { NextResponse } from "next/server";
import { isBackstageRequestAuthenticated } from "@/lib/backstage-auth";
import {
  createClientArchiveDownloadUrl,
  createClientArchiveUploadUrl,
  createClientArchiveViewUrl,
  deleteClientArchiveFile,
  isClientArchiveKey,
  listClientArchive,
} from "@/lib/client-archive/storage";

function unauthorized() {
  return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
}
function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) return unauthorized();
  const url = new URL(request.url);
  const path = text(url.searchParams.get("path"));
  const cursor = text(url.searchParams.get("cursor"));
  const listing = await listClientArchive(path, cursor || undefined);
  const files = await Promise.all(listing.files.map(async (file) => ({
    ...file,
    ...(file.isImage ? { viewUrl: await createClientArchiveViewUrl(file.objectKey) } : {}),
  })));
  return NextResponse.json({ ok: true, listing: { ...listing, files } });
}

export async function POST(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }
  const action = text(body.action);

  if (action === "presign-upload-batch") {
    const paths = Array.isArray(body.paths)
      ? body.paths.map(text).filter(Boolean)
      : [];
    if (!paths.length || paths.length > 50) {
      return NextResponse.json(
        { ok: false, message: "Choose between 1 and 50 files." },
        { status: 400 },
      );
    }
    const jobs = await Promise.all(
      paths.map(async (path) => ({
        path,
        ...(await createClientArchiveUploadUrl(path)),
      })),
    );
    return NextResponse.json({ ok: true, jobs });
  }

  if (action === "presign-upload") {
    const path = text(body.path);
    if (!path) return NextResponse.json({ ok: false, message: "A file path is required." }, { status: 400 });
    return NextResponse.json({ ok: true, ...(await createClientArchiveUploadUrl(path)) });
  }

  if (action === "download") {
    const objectKey = text(body.objectKey);
    const name = text(body.name);
    if (!isClientArchiveKey(objectKey)) return NextResponse.json({ ok: false, message: "Invalid archive object." }, { status: 400 });
    return NextResponse.json({ ok: true, url: await createClientArchiveDownloadUrl(objectKey, name) });
  }

  if (action === "delete-file") {
    const objectKey = text(body.objectKey);
    if (!isClientArchiveKey(objectKey)) return NextResponse.json({ ok: false, message: "Invalid archive object." }, { status: 400 });
    await deleteClientArchiveFile(objectKey);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, message: "Unknown archive action." }, { status: 400 });
}
