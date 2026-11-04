import { NextResponse } from "next/server";
import {
  createClientArchiveFolder,
  createClientArchiveViewUrl,
  createVerifiedArchiveUploadUrl,
  getClientArchiveKey,
  headArchiveObject,
  listClientArchive,
  listClientArchiveFilesRecursive,
} from "@/lib/client-archive/storage";
import {
  authenticateMac,
  cleanMacStatus,
  findMacUploadByOriginal,
  getMacUpload,
  recordMacUpload,
  saveMacStatus,
} from "@/lib/mac/repository";

// Used only by Steve's Mac app. Every request carries that Mac's secret
// connection code. It can add files and empty folders, list the files in a
// folder and download them (for "Bring back from Storage"). Nothing here can
// delete, move or rename anything in Storage.

const MAX_SINGLE_UPLOAD = 5 * 1024 ** 3;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/** A tidy Storage path from the Mac's relative path, or "" if it isn't allowed. */
function storagePath(value: unknown) {
  const parts = text(value).replace(/\\/g, "/").split("/").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return "";
  if (parts.some((part) => part === "." || part === ".." || part.startsWith(".") || /[\u0000-\u001f]/.test(part))) return "";
  return parts.join("/");
}

function md5Hex(value: unknown) {
  const hex = text(value).toLowerCase();
  return /^[0-9a-f]{32}$/.test(hex) ? hex : "";
}

/** "Hamlet 001.jpg" → "Hamlet 001 (Mac).jpg", "(Mac 2)", … */
function alternativeName(path: string, attempt: number) {
  const slash = path.lastIndexOf("/");
  const folder = slash >= 0 ? path.slice(0, slash + 1) : "";
  const name = path.slice(slash + 1);
  const dot = name.lastIndexOf(".");
  const label = attempt === 1 ? " (Mac)" : " (Mac " + attempt + ")";
  return folder + (dot > 0 ? name.slice(0, dot) + label + name.slice(dot) : name + label);
}

const etagMatches = (etag: string, md5: string) => !/^[0-9a-f]{32}$/.test(etag) || etag === md5;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, message: "Invalid request." }, 400);
  }

  try {
    const device = await authenticateMac(request, text(body.deviceName));
    if (!device) {
      return json({ ok: false, code: "not_connected", message: "This Mac isn't connected. Reconnect it from Backstage › Storage › Mac app." }, 401);
    }
    const action = text(body.action);

    if (action === "hello") {
      return json({ ok: true, device: device.name });
    }

    if (action === "status") {
      // Upload progress, shown in Backstage › Storage › Mac app.
      const status = cleanMacStatus(body.status);
      if (!status) return json({ ok: false, message: "Invalid status." }, 400);
      await saveMacStatus(device.id, status);
      return json({ ok: true });
    }

    if (action === "folders") {
      // The top-level client folders (names only), so the Mac can always
      // show them and Steve can drop new work straight into the right one.
      const names: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await listClientArchive("", cursor);
        names.push(...page.folders.map((folder) => folder.name));
        cursor = page.nextCursor;
      } while (cursor && names.length < 2000);
      const safe = names.filter((name) => name && !name.startsWith(".") && !/[\u0000-\u001f/]/.test(name));
      return json({ ok: true, list: safe.join("\n") });
    }

    if (action === "folder") {
      // An empty folder made on the Mac: create it in Storage too.
      const path = storagePath(body.path);
      if (!path || path.split("/")[0] === ".trash") return json({ ok: false, message: "Invalid folder." }, 400);
      await createClientArchiveFolder(path);
      return json({ ok: true });
    }

    if (action === "presign") {
      const path = storagePath(body.path);
      const md5 = md5Hex(body.md5Hex);
      const size = Number(body.size);
      if (!path || !md5 || !Number.isFinite(size) || size < 0) return json({ ok: false, message: "Invalid file details." }, 400);
      if (size > MAX_SINGLE_UPLOAD) return json({ ok: false, code: "too_big", message: "Files over 5 GB can't be uploaded yet." }, 413);

      let target = path;
      for (let attempt = 1; ; attempt += 1) {
        const [existing, record] = await Promise.all([headArchiveObject(target), getMacUpload(target)]);
        if (!existing) break;
        const ours = record?.deviceId === device.id;
        if (ours && record.md5Hex === md5 && record.sizeBytes === size && existing.sizeBytes === size) {
          return json({ ok: true, status: "done", remotePath: target });
        }
        if (ours) break; // The same file was changed on the Mac: replace it.
        // An earlier upload of this exact file arrived but was never confirmed
        // (e.g. the Mac slept mid-way): record it rather than saving a duplicate.
        if (!record && existing.sizeBytes === size && existing.etag === md5) {
          await recordMacUpload({ remotePath: target, deviceId: device.id, sizeBytes: size, md5Hex: md5 });
          return json({ ok: true, status: "done", remotePath: target });
        }
        if (attempt > 50) return json({ ok: false, message: "Couldn't find a free name for this file." }, 409);
        target = alternativeName(path, attempt);
      }

      const md5Base64 = Buffer.from(md5, "hex").toString("base64");
      return json({
        ok: true,
        status: "upload",
        remotePath: target,
        uploadUrl: await createVerifiedArchiveUploadUrl(target, md5Base64),
        contentMd5: md5Base64,
      });
    }

    if (action === "commit") {
      const remotePath = storagePath(body.remotePath);
      const md5 = md5Hex(body.md5Hex);
      const size = Number(body.size);
      if (!remotePath || !md5 || !Number.isFinite(size)) return json({ ok: false, message: "Invalid file details." }, 400);
      const stored = await headArchiveObject(remotePath);
      if (!stored) return json({ ok: false, message: "The upload didn't arrive in Storage." }, 409);
      if (stored.sizeBytes !== size || !etagMatches(stored.etag, md5)) {
        return json({ ok: false, message: "The copy in Storage doesn't match the file on the Mac." }, 409);
      }
      await recordMacUpload({ remotePath, deviceId: device.id, sizeBytes: size, md5Hex: md5 });
      return json({ ok: true, verified: true });
    }

    if (action === "list") {
      // "Bring back from Storage": every file in a folder (or the one file),
      // as "path<TAB>size" lines. Deleted files and hidden markers are left out.
      const path = storagePath(body.path);
      if (!path || path.split("/")[0] === ".trash") return json({ ok: false, message: "Invalid folder." }, 400);
      const single = await headArchiveObject(path);
      const files = single
        ? [{ path, sizeBytes: single.sizeBytes }]
        : await listClientArchiveFilesRecursive(path, 20000);
      const lines = files
        .filter((file) => !file.path.split("/").some((part) => part.startsWith(".")) && !/[\u0000-\u001f]/.test(file.path))
        .map((file) => file.path + "\t" + file.sizeBytes);
      return json({ ok: true, count: lines.length, list: lines.join("\n") });
    }

    if (action === "download") {
      // A short-lived link to fetch one file back onto the Mac.
      const path = storagePath(body.path);
      if (!path || path.split("/")[0] === ".trash") return json({ ok: false, message: "Invalid file." }, 400);
      const stored = await headArchiveObject(path);
      if (!stored) return json({ ok: false, code: "missing", message: "That file isn't in Storage." }, 404);
      return json({
        ok: true,
        size: stored.sizeBytes,
        url: await createClientArchiveViewUrl(getClientArchiveKey(path), 3600),
      });
    }

    if (action === "verify") {
      // Asked before the Mac frees up space: is this exact file safely in Storage?
      const md5 = md5Hex(body.md5Hex);
      const size = Number(body.size);
      let remotePath = storagePath(body.remotePath);
      if (!md5 || !Number.isFinite(size)) return json({ ok: false, message: "Invalid file details." }, 400);

      let record = remotePath ? await getMacUpload(remotePath) : undefined;
      if (!record || record.md5Hex !== md5 || record.sizeBytes !== size) {
        // It may have been renamed or moved in Storage since.
        const moved = await findMacUploadByOriginal(device.id, md5, size);
        record = moved ? await getMacUpload(moved) : undefined;
        remotePath = moved || remotePath;
      }
      if (!record) return json({ ok: true, safe: false, reason: "not_recorded" });
      if (record.remotePath.split("/")[0] === ".trash") {
        return json({ ok: true, safe: false, reason: "deleted_in_storage", remotePath: record.remotePath });
      }
      const stored = await headArchiveObject(record.remotePath);
      if (!stored) return json({ ok: true, safe: false, reason: "missing" });
      const safe = stored.sizeBytes === size && etagMatches(stored.etag, md5);
      return json({ ok: true, safe, reason: safe ? "ok" : "mismatch", remotePath: record.remotePath });
    }

    return json({ ok: false, message: "Unknown action." }, 400);
  } catch (error) {
    console.error("Mac request failed", error);
    return json({ ok: false, message: error instanceof Error ? error.message : "Something went wrong." }, 500);
  }
}
