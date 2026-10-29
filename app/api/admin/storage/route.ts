import { NextResponse } from "next/server";
import { isBackstageRequestAuthenticated } from "@/lib/backstage-auth";
import {
  createClientArchiveDownloadUrl,
  createClientArchiveFolder,
  createClientArchiveUploadUrl,
  createClientArchiveViewUrl,
  isClientArchiveKey,
  listClientArchive,
  listClientArchiveFilesRecursive,
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
import { createMacDevice, listMacDevices, listRecentMacUploads, revokeMacDevice } from "@/lib/mac/repository";
import { checkStorageCors, fixStorageCors } from "@/lib/storage-cors";
import { createShare, deleteShare, getShareById, listShareEvents, listShares, updateShare } from "@/lib/shares/repository";
import { sendShareEmails, shareLink } from "@/lib/shares/email";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function emailList(value: unknown) {
  const raw = Array.isArray(value) ? value.map(String) : String(value ?? "").split(/[\s,;]+/);
  const list = [...new Set(raw.map((item) => item.trim().toLowerCase()).filter(Boolean))];
  const bad = list.find((item) => !EMAIL.test(item));
  if (bad) throw new Error("“" + bad + "” doesn't look like an email address.");
  if (list.length > 20) throw new Error("Add up to 20 email addresses.");
  return list;
}

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

  if (action === "download-folder") {
    // Links for every file in a folder (and its sub-folders), so the browser
    // can save the whole folder as one zip with its layout kept.
    const path = text(body.path).replace(/^\/+|\/+$/g, "");
    if (!path || path.split("/")[0] === ".trash") return NextResponse.json({ ok: false, message: "Invalid folder." }, { status: 400 });
    try {
      const files = (await listClientArchiveFilesRecursive(path, 5000)).filter((file) => file.name !== ".folder");
      const base = path + "/";
      const entries = await Promise.all(files.map(async (file) => ({
        name: file.path.startsWith(base) ? file.path.slice(base.length) : file.name,
        size: file.sizeBytes,
        url: await createClientArchiveViewUrl(file.objectKey, 12 * 60 * 60),
      })));
      return NextResponse.json({ ok: true, name: path.split("/").pop() || "Download", files: entries });
    } catch (error) {
      const message = error instanceof Error && /more than/.test(error.message) ? error.message : "Couldn't prepare that folder.";
      return NextResponse.json({ ok: false, message }, { status: 400 });
    }
  }

  if (action === "download") {
    const objectKey = text(body.objectKey);
    const name = text(body.name);
    if (!isClientArchiveKey(objectKey)) return NextResponse.json({ ok: false, message: "Invalid archive object." }, { status: 400 });
    return NextResponse.json({ ok: true, url: await createClientArchiveDownloadUrl(objectKey, name) });
  }

  try {
    if (action === "cors-check") {
      return NextResponse.json({ ok: true, cors: await checkStorageCors() });
    }
    if (action === "cors-fix") {
      return NextResponse.json({ ok: true, cors: await fixStorageCors() });
    }
    if (action === "mac-overview") {
      const [devices, recent] = await Promise.all([listMacDevices(), listRecentMacUploads()]);
      return NextResponse.json({ ok: true, devices, recent });
    }
    if (action === "mac-connect") {
      const { token } = await createMacDevice();
      // Installs against whichever address Steve is using (the live site once it's live).
      const origin = process.env.VERCEL_ENV === "production" ? "https://www.stevegregson.com" : new URL(request.url).origin;
      const command = "curl -fsSL " + origin + "/mac/install.sh | bash -s -- " + token + " " + origin;
      return NextResponse.json({ ok: true, command });
    }
    if (action === "mac-disconnect") {
      await revokeMacDevice(text(body.id));
      return NextResponse.json({ ok: true });
    }
    if (action === "share-list") {
      const shares = await listShares();
      return NextResponse.json({ ok: true, shares: shares.map((share) => ({ ...share, link: shareLink(share.token, request.url) })) });
    }
    if (action === "share-create") {
      const path = text(body.path).replace(/^\/+|\/+$/g, "");
      if (!path || path.split("/")[0] === ".trash") throw new Error("Choose a folder to share.");
      const recipients = emailList(body.emails);
      const share = await createShare({
        path,
        title: text(body.title) || path.split("/").pop() || path,
        message: text(body.message),
        recipientEmails: recipients,
        password: text(body.password),
      });
      const link = shareLink(share.token, request.url);
      const email = body.sendEmail === false || !recipients.length ? null : await sendShareEmails(share, link, recipients);
      return NextResponse.json({ ok: true, share: { ...share, link }, email });
    }
    if (action === "share-update") {
      const id = text(body.id);
      const addEmails = body.addEmails === undefined ? [] : emailList(body.addEmails);
      const share = await updateShare(id, {
        title: typeof body.title === "string" ? body.title : undefined,
        message: typeof body.message === "string" ? body.message.trim() : undefined,
        addEmails,
        removeEmail: typeof body.removeEmail === "string" ? body.removeEmail : undefined,
        password: body.password === null ? null : typeof body.password === "string" && body.password.trim() ? body.password : undefined,
      });
      const link = shareLink(share.token, request.url);
      const email = addEmails.length && body.sendEmail !== false ? await sendShareEmails(share, link, addEmails) : null;
      return NextResponse.json({ ok: true, share: { ...share, link }, email });
    }
    if (action === "share-resend") {
      const share = await getShareById(text(body.id));
      if (!share) throw new Error("That share no longer exists.");
      const to = body.email ? emailList([body.email]) : share.recipients;
      const email = await sendShareEmails(share, shareLink(share.token, request.url), to);
      return NextResponse.json({ ok: true, email });
    }
    if (action === "share-delete") {
      await deleteShare(text(body.id));
      return NextResponse.json({ ok: true });
    }
    if (action === "share-events") {
      return NextResponse.json({ ok: true, events: await listShareEvents(text(body.id)) });
    }
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
