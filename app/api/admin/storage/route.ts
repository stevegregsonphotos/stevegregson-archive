import { NextResponse } from "next/server";
import { isBackstageRequestAuthenticated } from "@/lib/backstage-auth";
import {
  createClientArchiveDownloadUrl,
  createClientArchiveFolder,
  createClientArchiveUploadUrl,
  createClientArchiveViewUrl,
  isClientArchiveKey,
  listClientArchive,
  searchClientArchive,
  archiveKeyFor,
} from "@/lib/client-archive/storage";
import {
  applyPairs,
  forgetTrashEntry,
  planDelete,
  planMove,
  planRename,
  planRestore,
  purgeTrashEntry,
  type StorageItem,
} from "@/lib/client-archive/operations";
import { listTrashEntries } from "@/lib/client-archive/trash-repository";
import { findLiveTransfersUsingArchive } from "@/lib/transfers/repository";

function unauthorized() {
  return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
}
function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function failure(error: unknown) {
  return NextResponse.json(
    { ok: false, message: error instanceof Error ? error.message : "Something went wrong." },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) return unauthorized();
  try {
    return await handleGet(request);
  } catch (error) {
    console.error("Storage request failed", error);
    return NextResponse.json(
      { ok: false, message: "Storage couldn't be reached: " + (error instanceof Error ? error.message : "unknown error") },
      { status: 500 },
    );
  }
}

async function handleGet(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("trash") === "1") {
    return NextResponse.json({ ok: true, trash: await listTrashEntries() });
  }
  const path = text(url.searchParams.get("path"));
  const cursor = text(url.searchParams.get("cursor"));
  const query = text(url.searchParams.get("q"));
  if (query) {
    const results = await searchClientArchive(query);
    const files = await Promise.all(results.files.map(async (file) => ({
      ...file,
      ...(file.isImage ? { viewUrl: await createClientArchiveViewUrl(file.objectKey) } : {}),
    })));
    return NextResponse.json({ ok: true, search: { ...results, files } });
  }
  const listing = await listClientArchive(path, cursor || undefined);
  const files = await Promise.all(listing.files.map(async (file) => ({
    ...file,
    ...(file.isImage ? { viewUrl: await createClientArchiveViewUrl(file.objectKey) } : {}),
  })));
  return NextResponse.json({ ok: true, listing: { ...listing, files } });
}

export async function POST(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) return unauthorized();
  try {
    return await handlePost(request);
  } catch (error) {
    console.error("Storage request failed", error);
    return failure(error);
  }
}

async function handlePost(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }
  const action = text(body.action);

  if (action === "create-folder") {
    const path = text(body.path);
    if (!path) return NextResponse.json({ ok: false, message: "A folder name is required." }, { status: 400 });
    try { await createClientArchiveFolder(path); } catch (error) { return failure(error); }
    return NextResponse.json({ ok: true });
  }

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

  try {
    if (action === "check-in-use") {
      const items = (Array.isArray(body.items) ? body.items : []) as StorageItem[];
      const keys = items.filter((i) => i?.kind === "file").map((i) => archiveKeyFor(String(i.path)));
      const prefixes = items.filter((i) => i?.kind === "folder").map((i) => archiveKeyFor(String(i.path)) + "/");
      return NextResponse.json({ ok: true, transfers: await findLiveTransfersUsingArchive(keys, prefixes) });
    }
    if (action === "plan-move") {
      return NextResponse.json({ ok: true, pairs: await planMove(body.items, body.destination) });
    }
    if (action === "plan-rename") {
      return NextResponse.json({ ok: true, pairs: await planRename(body.item, body.name) });
    }
    if (action === "plan-delete") {
      return NextResponse.json({ ok: true, pairs: await planDelete(body.items) });
    }
    if (action === "plan-restore") {
      return NextResponse.json({ ok: true, ...(await planRestore(text(body.trashId))) });
    }
    if (action === "apply") {
      return NextResponse.json({ ok: true, applied: await applyPairs(body.pairs) });
    }
    if (action === "finish-restore") {
      await forgetTrashEntry(text(body.trashId));
      return NextResponse.json({ ok: true });
    }
    if (action === "delete-forever") {
      await purgeTrashEntry(text(body.trashId));
      return NextResponse.json({ ok: true });
    }
  } catch (error) {
    return failure(error);
  }

  return NextResponse.json({ ok: false, message: "Unknown archive action." }, { status: 400 });
}
