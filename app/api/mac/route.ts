import { NextResponse } from "next/server";
import {
  createClientArchiveFolder,
  createClientArchiveViewUrl,
  createVerifiedArchiveUploadUrl,
  getClientArchiveKey,
  headArchiveObject,
  listClientArchive,
  listClientArchiveFilesRecursive,
  listClientArchiveDirectFiles,
  listArchiveObjectsUnder,
  archiveObjectExists,
  deleteArchiveObjects,
  ensureArchiveFolderMarker,
} from "@/lib/client-archive/storage";
import { moveSharePaths } from "@/lib/shares/repository";
import { moveFileRequestPaths } from "@/lib/requests/repository";
import {
  authenticateMac,
  cleanMacStatus,
  findMacUploadByOriginal,
  getMacUpload,
  recordMacUpload,
  saveMacStatus,
  takeMacResume,
} from "@/lib/mac/repository";
import { applyPairs, MAX_PAIRS_PER_APPLY, planDelete } from "@/lib/client-archive/operations";

// Used only by Steve's Mac app. Every request carries that Mac's secret
// connection code. It can add files and empty folders, list the files in a
// folder and download them (for "Bring back from Storage"). The only removal
// is "trash": when Steve renames or deletes a file on the Mac, the copy this
// Mac uploaded goes to Deleted files (restorable for 30 days) — and only if
// Storage still holds exactly what the Mac sent. Otherwise nothing here can
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

export const maxDuration = 120;

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

    if (action === "pause-check") {
      // A paused Mac asks every minute whether Resume was pressed in Backstage.
      return json({ ok: true, resume: await takeMacResume(device.id) });
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

    if (action === "files") {
      // Files directly in one folder (not sub-folders), as "path<TAB>size"
      // lines: used by the Mac to spot old copies left behind by renames.
      const path = storagePath(body.path);
      if (!path || path.split("/")[0] === ".trash") return json({ ok: false, message: "Invalid folder." }, 400);
      const files = await listClientArchiveDirectFiles(path);
      const lines = files
        .filter((file) => !file.path.split("/").some((part) => part.startsWith(".")) && !/[\u0000-\u001f]/.test(file.path))
        .map((file) => file.path + "\t" + file.sizeBytes);
      return json({ ok: true, count: lines.length, list: lines.join("\n") });
    }

    if (action === "move") {
      // A file renamed or moved on the Mac without being changed (same size
      // and fingerprint as what this Mac uploaded): rename it in Storage too,
      // instead of uploading it again and leaving the old name behind.
      const from = storagePath(body.from);
      const to = storagePath(body.to);
      const md5 = md5Hex(body.md5Hex);
      const size = Number(body.size);
      if (!from || !to || !md5 || !Number.isFinite(size) || from === to) return json({ ok: false, message: "Invalid move." }, 400);
      if (from.split("/")[0] === ".trash" || to.split("/")[0] === ".trash") return json({ ok: false, message: "Invalid move." }, 400);
      const record = await getMacUpload(from);
      if (!record || record.deviceId !== device.id || record.md5Hex !== md5 || record.sizeBytes !== size) {
        return json({ ok: false, code: "not_ours", message: "Storage's copy isn't the one this Mac uploaded." }, 409);
      }
      const stored = await headArchiveObject(from);
      if (!stored || stored.sizeBytes !== size || !etagMatches(stored.etag, md5)) {
        return json({ ok: false, code: "changed", message: "Storage's copy has changed or gone." }, 409);
      }
      if (await archiveObjectExists(to)) return json({ ok: false, code: "taken", message: "Something already has that name in Storage." }, 409);
      await applyPairs([{ from, to }]);
      const parent = to.split("/").slice(0, -1).join("/");
      if (parent) await ensureArchiveFolderMarker(parent);
      return json({ ok: true, remotePath: to });
    }

    if (action === "merge-folder") {
      // A folder renamed on the Mac: once its photos have been renamed in
      // Storage (above), bring across anything left in the old Storage folder
      // — e.g. photos already cleared from the Mac — so the show isn't split
      // across two folders. Shares and file requests follow the folder.
      const from = storagePath(body.from);
      const to = storagePath(body.to);
      if (!from || !to || from === to || to.startsWith(from + "/") || from.startsWith(to + "/")) return json({ ok: false, message: "Invalid folder." }, 400);
      if (from.split("/")[0] === ".trash" || to.split("/")[0] === ".trash") return json({ ok: false, message: "Invalid folder." }, 400);
      const objects = await listArchiveObjectsUnder(from, 20000);
      const pairs: Array<{ from: string; to: string }> = [];
      const markers: string[] = [];
      let kept = 0;
      for (const object of objects) {
        const rest = object.path.slice(from.length + 1);
        if (rest.split("/").pop() === ".folder") { markers.push(object.path); continue; }
        const target = to + "/" + rest;
        if (await archiveObjectExists(target)) { kept += 1; continue; }   // never overwrite
        pairs.push({ from: object.path, to: target });
      }
      for (let i = 0; i < pairs.length; i += MAX_PAIRS_PER_APPLY) await applyPairs(pairs.slice(i, i + MAX_PAIRS_PER_APPLY));
      await ensureArchiveFolderMarker(to);
      if (!kept) {
        await deleteArchiveObjects(markers);
        await moveSharePaths(from, to);
        await moveFileRequestPaths(from, to);
      }
      return json({ ok: true, moved: pairs.length, kept });
    }

    if (action === "remove-empty-folder") {
      // After a rename: the old folder in Storage, if nothing is left in it
      // but Storage's own empty-folder markers.
      const path = storagePath(body.path);
      if (!path || path.split("/")[0] === ".trash" || !path.includes("/")) return json({ ok: true, removed: false });
      const objects = await listArchiveObjectsUnder(path, 2000);
      if (objects.some((object) => object.path.split("/").pop() !== ".folder")) return json({ ok: true, removed: false });
      await deleteArchiveObjects(objects.map((object) => object.path));
      return json({ ok: true, removed: objects.length > 0 });
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

    if (action === "trash") {
      // Files renamed or deleted on the Mac. Each goes to Deleted files only if
      // this Mac uploaded it and Storage still holds that exact version.
      const list = Array.isArray(body.files) ? body.files.slice(0, 50) : [];
      const results: Array<{ path: string; result: "trashed" | "kept" | "gone" }> = [];
      const toTrash: string[] = [];
      for (const raw of list) {
        const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        let md5 = md5Hex(item.md5Hex);
        let size = Number(item.size);
        let remotePath = storagePath(item.path);
        if (!remotePath) continue;
        if (!md5) {
          // One-off tidy of older duplicates: the Mac no longer knows the
          // fingerprint, so use the one recorded when this Mac uploaded it.
          const known = await getMacUpload(remotePath);
          if (!known || known.deviceId !== device.id) {
            results.push({ path: String(item.path), result: known ? "kept" : "gone" });
            continue;
          }
          md5 = known.md5Hex;
          size = known.sizeBytes;
        }
        if (!Number.isFinite(size)) continue;
        let record = await getMacUpload(remotePath);
        if ((!record || record.md5Hex !== md5 || record.sizeBytes !== size) && item.exact !== true) {
          const moved = await findMacUploadByOriginal(device.id, md5, size);
          record = moved ? await getMacUpload(moved) : undefined;
          remotePath = moved || remotePath;
        }
        if (!record || record.deviceId !== device.id || record.remotePath.split("/")[0] === ".trash") {
          results.push({ path: String(item.path), result: record ? "kept" : "gone" });
          continue;
        }
        const stored = await headArchiveObject(record.remotePath);
        if (!stored) {
          results.push({ path: String(item.path), result: "gone" });
          continue;
        }
        if (stored.sizeBytes !== size || !etagMatches(stored.etag, md5)) {
          // Changed in Storage since: leave it alone.
          results.push({ path: String(item.path), result: "kept" });
          continue;
        }
        if (toTrash.includes(record.remotePath)) {
          // Two Mac names pointed at the same Storage file: trash it once.
          results.push({ path: String(item.path), result: "gone" });
          continue;
        }
        toTrash.push(record.remotePath);
        results.push({ path: String(item.path), result: "trashed" });
      }
      // One file at a time, so a file that has just vanished (or any other
      // hiccup) can't stop the rest of the batch going to Deleted files.
      let trashed = 0;
      for (const path of toTrash) {
        try {
          const pairs = await planDelete([{ kind: "file", path }]);
          for (let i = 0; i < pairs.length; i += MAX_PAIRS_PER_APPLY) {
            await applyPairs(pairs.slice(i, i + MAX_PAIRS_PER_APPLY));
          }
          trashed += 1;
        } catch (error) {
          console.warn("Mac trash skipped " + path, error);
          const row = results.find((entry) => entry.result === "trashed" && (entry.path === path || storagePath(entry.path) === path));
          if (row) row.result = "gone";
        }
      }
      return json({ ok: true, results, trashed });
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
