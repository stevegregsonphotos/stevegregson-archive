import { NextResponse } from "next/server";
import { checkSharePassword, getShareByToken, recordShareEvent } from "@/lib/shares/repository";
import {
  TRASH_FOLDER,
  archiveKeyFor,
  createClientArchiveDownloadUrl,
  createClientArchiveViewUrl,
  listClientArchive,
  listClientArchiveFilesRecursive,
} from "@/lib/client-archive/storage";
import { recipientFromCode } from "@/lib/recipient-code";
import { signSharePath } from "@/lib/shares/thumb-sign";
import { isTransferPasswordLocked, noteTransferPasswordResult } from "@/lib/transfers/public";

// Everything a client can do with a shared folder. Every request is checked
// against the share, and paths are always taken relative to the shared
// folder, so nothing outside it can ever be reached.

const ZIP_LINK_SECONDS = 12 * 60 * 60;
const MAX_ZIP_FILES = 5000;

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** A path inside the share ("Hamlet/Act 1"), cleaned; throws on anything odd. */
function inside(value: unknown) {
  const parts = (typeof value === "string" ? value : "").replace(/\\/g, "/").split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.some((part) => part === "." || part === ".." || part === ".folder" || /[\u0000-\u001f]/.test(part))) throw new Error("Invalid path.");
  return parts.join("/");
}

function uniqueNames(names: string[]) {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const key = name.toLowerCase();
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (!count) return name;
    const dot = name.lastIndexOf(".");
    const slash = name.lastIndexOf("/");
    return dot > slash + 1 ? name.slice(0, dot) + " (" + (count + 1) + ")" + name.slice(dot) : name + " (" + (count + 1) + ")";
  });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  try {
    const found = await getShareByToken(token);
    if (!found || found.share.path.split("/")[0] === TRASH_FOLDER) {
      return reply({ ok: false, gone: true, message: "This folder is no longer shared." }, 404);
    }
    const { share, passwordHash } = found;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    if (passwordHash) {
      if (await isTransferPasswordLocked(request, "share:" + token)) {
        return reply({ ok: false, message: "Too many attempts. Please wait 15 minutes and try again." }, 429);
      }
      if (!checkSharePassword(typeof body.password === "string" ? body.password : "", passwordHash)) {
        if (body.password) await noteTransferPasswordResult(request, "share:" + token, false);
        return reply({ ok: false, locked: true, message: body.password ? "That password isn't right." : "" }, 403);
      }
    }

    const action = typeof body.action === "string" ? body.action : "";
    const relative = inside(body.path);
    const full = relative ? share.path + "/" + relative : share.path;
    const who = recipientFromCode(share.token, share.recipients, body.r);
    const log = (eventType: "open" | "file" | "folder", fileCount?: number) =>
      recordShareEvent({ shareId: share.id, recipientEmail: who, eventType, path: relative, fileCount }).catch((error) => console.error("Share log failed", error));

    if (action === "list") {
      const listing = await listClientArchive(full, typeof body.cursor === "string" ? body.cursor : undefined);
      if (body.first === true) await log("open");
      const strip = (path: string) => path.slice(share.path.length + 1);
      return reply({
        ok: true,
        message: share.message,
        path: relative,
        folders: listing.folders.map((folder) => ({ name: folder.name, path: strip(folder.path) })),
        files: listing.files.map((file) => {
          const path = strip(file.path);
          return {
            name: file.name, path, sizeBytes: file.sizeBytes, lastModified: file.lastModified, isImage: file.isImage,
            ...(file.isImage ? { thumb: "/api/shared/" + share.token + "/thumb?path=" + encodeURIComponent(path) + "&s=" + signSharePath(share.token, path) } : {}),
          };
        }),
        nextCursor: listing.nextCursor,
      });
    }

    if (action === "file" || action === "preview") {
      if (!relative) return reply({ ok: false, message: "Choose a file." }, 400);
      const key = archiveKeyFor(full);
      const name = relative.split("/").pop() || "download";
      if (action === "preview") return reply({ ok: true, url: await createClientArchiveViewUrl(key) });
      const url = await createClientArchiveDownloadUrl(key, name);
      if (body.partOfFolder !== true) await log("file");
      return reply({ ok: true, url });
    }

    if (action === "folder") {
      const files = (await listClientArchiveFilesRecursive(full, MAX_ZIP_FILES)).filter((file) => file.name !== ".folder");
      const base = full + "/";
      const names = uniqueNames(files.map((file) => file.path.slice(base.length)));
      const entries = await Promise.all(files.map(async (file, index) => ({
        name: names[index],
        path: relative ? relative + "/" + names[index] : names[index],
        size: file.sizeBytes,
        url: await createClientArchiveViewUrl(file.objectKey, ZIP_LINK_SECONDS),
      })));
      await log("folder", entries.length);
      return reply({ ok: true, name: relative ? relative.split("/").pop() : share.title, files: entries });
    }

    return reply({ ok: false, message: "Unknown request." }, 400);
  } catch (error) {
    console.error("Shared folder request failed", error);
    const message = error instanceof Error && /more than|Invalid path/.test(error.message) ? error.message : "Something went wrong. Please try again.";
    return reply({ ok: false, message }, 400);
  }
}
