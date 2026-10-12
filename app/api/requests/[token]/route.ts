import { NextResponse, after } from "next/server";
import { getFileRequestByToken, recordFileRequestUpload } from "@/lib/requests/repository";
import { sendFilesReceivedNotice } from "@/lib/requests/email";
import { TRASH_FOLDER, createClientArchiveUploadUrl, ensureArchiveFolderMarker, listArchiveObjectsUnder } from "@/lib/client-archive/storage";
import { formatBytes } from "@/lib/transfers/email-template";

// Uploads from a client answering one of Steve's file requests. Files go
// straight from their browser into Storage, inside the request's folder.

const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function cleanPart(value: string) {
  return value.replace(/[\u0000-\u001f\\/]/g, " ").replace(/\s+/g, " ").trim().replace(/^\.+/, "").slice(0, 120);
}

function cleanRelative(value: unknown) {
  const parts = String(value ?? "").replace(/\\/g, "/").split("/").map(cleanPart).filter((part) => part && part !== "." && part !== ".." && part !== ".folder");
  return parts.join("/");
}

/** "Jane Smith – 12 Oct 2026, 21.40": one folder per upload session. */
function sessionFolder(name: string, startedAt: unknown) {
  const when = new Date(typeof startedAt === "string" ? startedAt : "");
  const valid = !Number.isNaN(when.getTime()) && Math.abs(Date.now() - when.getTime()) < 36 * 60 * 60 * 1000 ? when : new Date();
  const stamp = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })
    .format(valid).replace(":", ".");
  return cleanPart(name || "Upload") + " – " + stamp;
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  try {
    const fileRequest = await getFileRequestByToken(token);
    if (!fileRequest || fileRequest.status !== "open" || fileRequest.folderPath.split("/")[0] === TRASH_FOLDER) {
      return reply({ ok: false, closed: true, message: "This upload link has closed. Please get in touch with Steve for a new one." }, 410);
    }
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const name = cleanPart(typeof body.name === "string" ? body.name : "").slice(0, 60);
    const email = typeof body.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ? body.email.trim().toLowerCase() : undefined;
    if (!name) return reply({ ok: false, message: "Please add your name." }, 400);
    const folder = fileRequest.folderPath + "/" + sessionFolder(name, body.startedAt);

    if (body.action === "presign") {
      const files = Array.isArray(body.files) ? body.files.slice(0, 51) : [];
      if (!files.length || files.length > 50) return reply({ ok: false, message: "Invalid request." }, 400);
      const uploads = [];
      for (const raw of files) {
        const file = raw as { path?: unknown; size?: unknown };
        const relative = cleanRelative(file.path);
        const size = Number(file.size);
        if (!relative) return reply({ ok: false, message: "A file name isn't allowed." }, 400);
        if (!Number.isFinite(size) || size < 0 || size > MAX_FILE_BYTES) return reply({ ok: false, message: "“" + relative + "” is over 5 GB. Please send it another way." }, 400);
        const { uploadUrl } = await createClientArchiveUploadUrl(folder + "/" + relative);
        uploads.push({ path: String(file.path), url: uploadUrl });
      }
      return reply({ ok: true, uploads });
    }

    if (body.action === "complete") {
      const stored = (await listArchiveObjectsUnder(folder)).filter((object) => !object.path.endsWith("/.folder"));
      if (!stored.length) return reply({ ok: false, message: "Nothing arrived. Please try again." }, 400);
      await ensureArchiveFolderMarker(folder);
      const totalBytes = stored.reduce((sum, object) => sum + object.sizeBytes, 0);
      await recordFileRequestUpload({ requestId: fileRequest.id, uploaderName: name, uploaderEmail: email, folderPath: folder, fileCount: stored.length, totalBytes });
      after(() => sendFilesReceivedNotice(fileRequest, { name, email, count: stored.length, bytes: formatBytes(totalBytes), folder }));
      return reply({ ok: true, fileCount: stored.length });
    }

    return reply({ ok: false, message: "Unknown request." }, 400);
  } catch (error) {
    console.error("File request upload failed", error);
    return reply({ ok: false, message: "Something went wrong. Please try again." }, 500);
  }
}
