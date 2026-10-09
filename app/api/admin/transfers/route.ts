import { NextResponse } from "next/server";
import { isBackstageRequestAuthenticated } from "@/lib/backstage-auth";
import {
  addTransferFiles,
  createTransfer,
  deleteTransferRecord,
  deleteUploadingTransferRecord,
  disableTransfer,
  extendTransfer,
  finalizeTransfer,
  getTransferById,
  listAbandonedTransferIds,
  listTransfers,
  refreshTransferTotals,
  removeTransferFile,
  setTransferBackgrounds,
} from "@/lib/transfers/repository";
import {
  createTransferUploadUrl,
  deleteTransferObject,
  deleteTransferObjects,
  getTransferStorageConfiguration,
  getTransferObjectSize,
  isTransferObjectKey,
  createTransferViewUrl,
} from "@/lib/transfers/storage";
import { sendTransferEmails } from "@/lib/transfers/email";
import { isTransferImage } from "@/lib/transfers/backgrounds";
import {
  getClientArchiveFilesByKeys,
  listClientArchiveFilesRecursive,
} from "@/lib/client-archive/storage";

function unauthorized() {
  return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const MAX_EXPIRY_DAYS = 365;

/** Accepts a number of days (preferred) or an ISO date; returns a safe ISO date or "". */
function validExpiry(body: Record<string, unknown>) {
  const days = Number(body.expiryDays);
  const date = Number.isFinite(days) && days > 0
    ? new Date(Date.now() + Math.min(days, MAX_EXPIRY_DAYS) * 86_400_000)
    : new Date(text(body.expiresAt));
  const time = date.getTime();
  if (!Number.isFinite(time) || time <= Date.now() || time > Date.now() + MAX_EXPIRY_DAYS * 86_400_000 + 86_400_000) return "";
  return date.toISOString();
}

/** Removes transfers whose upload never finished (closed tab, lost connection). */
async function cleanUpAbandonedTransfers() {
  try {
    for (const id of await listAbandonedTransferIds(24)) {
      await deleteTransferObjects(id);
      await deleteUploadingTransferRecord(id);
    }
  } catch (error) {
    console.error("Transfer clean-up skipped", error);
  }
}

export async function GET(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) return unauthorized();
  return NextResponse.json({ ok: true, transfers: await listTransfers() });
}

export async function POST(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) return unauthorized();

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 }); }

  const action = text(body.action);

  if (action === "set-backgrounds") {
    const transferId = text(body.transferId);
    const fileIds = Array.isArray(body.fileIds) ? body.fileIds.map(text).filter(Boolean) : [];
    const existing = await getTransferById(transferId);
    if (!existing || existing.status !== "active") return NextResponse.json({ ok: false, message: "Transfer is not available for editing." }, { status: 404 });
    const transfer = await setTransferBackgrounds(transferId, fileIds);
    if (!transfer) return NextResponse.json({ ok: false, message: "Transfer not found." }, { status: 404 });
    return NextResponse.json({ ok: true, transfer });
  }

  if (action === "background-preview") {
    const transferId = text(body.transferId);
    const fileId = text(body.fileId);
    const transfer = await getTransferById(transferId);
    const file = transfer?.files.find((candidate) => candidate.id === fileId && isTransferImage(candidate));
    if (!transfer || transfer.status !== "active" || !file) return NextResponse.json({ ok: false, message: "Image not found." }, { status: 404 });
    const url = file.source === "archive"
      ? await (await import("@/lib/client-archive/storage")).createClientArchiveViewUrl(file.objectKey)
      : await createTransferViewUrl(file.objectKey);
    return NextResponse.json({ ok: true, url });
  }

  if (action === "storage-status") {
    const storage =
      getTransferStorageConfiguration();
    return NextResponse.json({
      ok: true,
      storage,
    });
  }

  if (action === "create") {
    const storage =
      getTransferStorageConfiguration();
    if (!storage.configured) {
      return NextResponse.json(
        {
          ok: false,
          code:
            "TRANSFER_STORAGE_NOT_CONFIGURED",
          message:
            "Transfer storage is not configured yet. Add the dedicated transfer-storage credentials before sending files.",
        },
        { status: 503 },
      );
    }
    const title = text(body.title);
    const senderEmail = text(body.senderEmail);
    const recipientEmails = Array.isArray(body.recipientEmails)
      ? body.recipientEmails.map(text).filter(Boolean)
      : [];
    const expiresAt = validExpiry(body);
    const badEmail = [senderEmail, ...recipientEmails].find((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    if (!title || !senderEmail || recipientEmails.length === 0 || !expiresAt) {
      return NextResponse.json({ ok: false, message: "Title, sender, recipient and a valid expiry are required." }, { status: 400 });
    }
    if (badEmail) {
      return NextResponse.json({ ok: false, message: "\"" + badEmail + "\" doesn't look like an email address." }, { status: 400 });
    }
    if (recipientEmails.length > 50) {
      return NextResponse.json({ ok: false, message: "Send to 50 people or fewer at once." }, { status: 400 });
    }
    await cleanUpAbandonedTransfers();
    const transfer = await createTransfer({
      title, senderEmail, recipientEmails, expiresAt,
      message: text(body.message), password: text(body.password),
    });
    return NextResponse.json({ ok: true, transfer });
  }

  if (action === "presign-batch") {
    const storage =
      getTransferStorageConfiguration();
    if (!storage.configured) {
      return NextResponse.json(
        {
          ok: false,
          code:
            "TRANSFER_STORAGE_NOT_CONFIGURED",
          message:
            "Transfer storage is not configured yet.",
        },
        { status: 503 },
      );
    }

    const transferId = text(body.transferId);
    const files = Array.isArray(body.files) ? body.files : [];
    if (!transferId || files.length === 0 || files.length > 50) {
      return NextResponse.json({ ok: false, message: "A transfer and 1–50 files are required." }, { status: 400 });
    }
    const transfer = await getTransferById(transferId);
    if (!transfer || !["uploading", "active"].includes(transfer.status)) {
      return NextResponse.json({ ok: false, message: "Transfer is not available for editing." }, { status: 404 });
    }
    const editingActiveTransfer = transfer.status === "active";
    if (editingActiveTransfer && transfer.files.length + files.length > 5000) {
      return NextResponse.json({ ok: false, message: "This transfer has reached its file limit." }, { status: 409 });
    }

    const jobs = await Promise.all(files.map(async (item) => {
      const file = item as Record<string, unknown>;
      const id = crypto.randomUUID();
      const originalName = text(file.name) || "file";
      const relativePath = text(file.relativePath) || originalName;
      const sizeBytes = Number(file.size) || 0;
      const contentType = text(file.type) || "application/octet-stream";
      const signed = await createTransferUploadUrl(transferId, id);
      return { id, originalName, relativePath, sizeBytes, contentType, ...signed };
    }));
    return NextResponse.json({ ok: true, jobs });
  }

  if (action === "commit-batch") {
    const transferId = text(body.transferId);
    const files = Array.isArray(body.files) ? body.files : [];
    if (!transferId || files.length === 0 || files.length > 50) {
      return NextResponse.json({ ok: false, message: "Uploaded file metadata is required." }, { status: 400 });
    }
    const transfer = await getTransferById(transferId);
    if (!transfer || !["uploading", "active"].includes(transfer.status)) {
      return NextResponse.json({ ok: false, message: "Transfer is not available for editing." }, { status: 404 });
    }
    const valid = [];
    for (const item of files) {
      const file = item as Record<string, unknown>;
      const objectKey = text(file.objectKey);
      const storedSize = objectKey && isTransferObjectKey(transferId, objectKey)
        ? await getTransferObjectSize(objectKey)
        : undefined;
      if (storedSize === undefined) {
        return NextResponse.json({ ok: false, message: "One or more uploaded files could not be verified." }, { status: 409 });
      }
      const originalName = text(file.originalName) || "file";
      valid.push({
        // The file id is the last part of its storage key, so the two can't disagree.
        id: objectKey.split("/").pop()!,
        originalName,
        relativePath: text(file.relativePath) || originalName,
        objectKey,
        sizeBytes: storedSize,
        contentType: text(file.contentType) || "application/octet-stream",
      });
    }
    await addTransferFiles(transferId, valid);
    return NextResponse.json({ ok: true, committed: valid.length });
  }

  if (action === "abort") {
    // Only an unfinished transfer can be aborted; sent transfers use "delete".
    const transferId = text(body.transferId);
    const transfer = await getTransferById(transferId);
    if (transfer?.status === "uploading") {
      await deleteTransferObjects(transferId);
      await deleteUploadingTransferRecord(transferId);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "attach-archive") {
    const transferId = text(body.transferId);
    const objectKeys = Array.isArray(body.objectKeys) ? body.objectKeys.map(text).filter(Boolean) : [];
    const folderPaths = Array.isArray(body.folderPaths) ? body.folderPaths.map(text).filter(Boolean) : [];
    if (!transferId || (!objectKeys.length && !folderPaths.length)) return NextResponse.json({ ok: false, message: "Choose archive files or folders to attach." }, { status: 400 });
    const transfer = await getTransferById(transferId);
    if (!transfer || !["uploading", "active"].includes(transfer.status)) return NextResponse.json({ ok: false, message: "Transfer is not available for editing." }, { status: 404 });
    const direct = await getClientArchiveFilesByKeys(objectKeys);
    const nested = [];
    for (const folderPath of folderPaths) nested.push(...await listClientArchiveFilesRecursive(folderPath, 5000));
    const archiveFiles = [...new Map([...direct, ...nested].map((file) => [file.objectKey, file])).values()];
    if (!archiveFiles.length || transfer.files.length + archiveFiles.length > 5000) return NextResponse.json({ ok: false, message: archiveFiles.length ? "This transfer would exceed its 5,000 file limit." : "No files were found in that archive selection." }, { status: 409 });
    await addTransferFiles(transferId, archiveFiles.map((file) => ({
      id: crypto.randomUUID(), originalName: file.name, relativePath: file.path,
      objectKey: file.objectKey, source: "archive" as const, sizeBytes: file.sizeBytes, contentType: file.contentType,
    })));
    return NextResponse.json({ ok: true, attached: archiveFiles.length, transfer: await refreshTransferTotals(transferId) });
  }

  if (action === "refresh-files") {
    const transferId = text(body.transferId);
    const transfer = await refreshTransferTotals(transferId);
    if (!transfer) return NextResponse.json({ ok: false, message: "Transfer not found." }, { status: 404 });
    return NextResponse.json({ ok: true, transfer });
  }

  if (action === "remove-file") {
    const transferId = text(body.transferId);
    const fileId = text(body.fileId);
    const transfer = await getTransferById(transferId);
    if (!transfer || transfer.status !== "active") {
      return NextResponse.json({ ok: false, message: "Transfer is not available for editing." }, { status: 404 });
    }
    if (transfer.files.length <= 1) {
      return NextResponse.json({ ok: false, message: "A transfer must contain at least one file." }, { status: 409 });
    }
    const file = transfer.files.find((candidate) => candidate.id === fileId);
    if (!file) return NextResponse.json({ ok: false, message: "File not found." }, { status: 404 });
    const removed = await removeTransferFile(transferId, fileId);
    if (!removed) return NextResponse.json({ ok: false, message: "File could not be removed." }, { status: 409 });
    if (removed.source === "upload") await deleteTransferObject(removed.objectKey);
    const updated = await refreshTransferTotals(transferId);
    return NextResponse.json({ ok: true, transfer: updated });
  }

  if (action === "finalize") {
    const transferId = text(body.transferId);
    const transfer = await finalizeTransfer(transferId);
    if (!transfer) return NextResponse.json({ ok: false, message: "This transfer has no files yet, or has already been sent." }, { status: 409 });
    const origin = new URL(request.url).origin;
    const configuredBase = process.env.TRANSFER_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
    const publicBase =
      configuredBase ||
      (process.env.VERCEL_ENV === "production"
        ? "https://transfers.stevegregson.com"
        : origin + "/transfer");
    const publicUrl = publicBase + "/" + transfer.token;
    // The transfer is live at this point, so an email problem must not look
    // like the whole transfer failed — report it and let Steve copy the link.
    const email = await sendTransferEmails(transfer, publicUrl);
    return NextResponse.json({ ok: true, transfer, publicUrl, email });
  }

  if (action === "disable") {
    await disableTransfer(text(body.transferId));
    return NextResponse.json({ ok: true });
  }

  if (action === "extend") {
    const expiresAt = validExpiry(body);
    if (!expiresAt) return NextResponse.json({ ok: false, message: "Choose a future expiry date within a year." }, { status: 400 });
    await extendTransfer(text(body.transferId), expiresAt);
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    const transferId = text(body.transferId);
    await deleteTransferObjects(transferId);
    await deleteTransferRecord(transferId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, message: "Unknown transfer action." }, { status: 400 });
}
