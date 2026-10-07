import { NextResponse } from "next/server";
import { isBackstageRequestAuthenticated } from "@/lib/backstage-auth";
import {
  addTransferFiles,
  createTransfer,
  deleteTransferRecord,
  disableTransfer,
  extendTransfer,
  finalizeTransfer,
  getTransferById,
  listTransfers,
} from "@/lib/transfers/repository";
import {
  createTransferUploadUrl,
  deleteTransferObjects,
  transferObjectExists,
} from "@/lib/transfers/storage";
import { sendTransferEmails } from "@/lib/transfers/email";

function unauthorized() {
  return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

  if (action === "create") {
    const title = text(body.title);
    const senderEmail = text(body.senderEmail);
    const recipientEmails = Array.isArray(body.recipientEmails)
      ? body.recipientEmails.map(text).filter(Boolean)
      : [];
    const expiresAt = text(body.expiresAt);
    if (!title || !senderEmail || recipientEmails.length === 0 || !expiresAt) {
      return NextResponse.json({ ok: false, message: "Title, sender, recipient and expiry are required." }, { status: 400 });
    }
    const transfer = await createTransfer({
      title, senderEmail, recipientEmails, expiresAt,
      message: text(body.message), password: text(body.password),
    });
    return NextResponse.json({ ok: true, transfer });
  }

  if (action === "presign-batch") {
    const transferId = text(body.transferId);
    const files = Array.isArray(body.files) ? body.files : [];
    if (!transferId || files.length === 0 || files.length > 50) {
      return NextResponse.json({ ok: false, message: "A transfer and 1–50 files are required." }, { status: 400 });
    }
    const transfer = await getTransferById(transferId);
    if (!transfer || transfer.status !== "uploading") {
      return NextResponse.json({ ok: false, message: "Transfer is not available for upload." }, { status: 404 });
    }

    const jobs = await Promise.all(files.map(async (item) => {
      const file = item as Record<string, unknown>;
      const id = crypto.randomUUID();
      const originalName = text(file.name) || "file";
      const relativePath = text(file.relativePath) || originalName;
      const sizeBytes = Number(file.size) || 0;
      const contentType = text(file.type) || "application/octet-stream";
      const signed = await createTransferUploadUrl(transferId, id, contentType);
      return { id, originalName, relativePath, sizeBytes, contentType, ...signed };
    }));
    return NextResponse.json({ ok: true, jobs });
  }

  if (action === "commit-batch") {
    const transferId = text(body.transferId);
    const files = Array.isArray(body.files) ? body.files : [];
    if (!transferId || files.length === 0) {
      return NextResponse.json({ ok: false, message: "Uploaded file metadata is required." }, { status: 400 });
    }
    const valid = [];
    for (const item of files) {
      const file = item as Record<string, unknown>;
      const objectKey = text(file.objectKey);
      if (!objectKey || !(await transferObjectExists(objectKey))) {
        return NextResponse.json({ ok: false, message: "One or more uploaded files could not be verified." }, { status: 409 });
      }
      valid.push({
        id: text(file.id), originalName: text(file.originalName),
        relativePath: text(file.relativePath), objectKey,
        sizeBytes: Number(file.sizeBytes) || 0,
        contentType: text(file.contentType) || "application/octet-stream",
      });
    }
    await addTransferFiles(transferId, valid);
    return NextResponse.json({ ok: true, committed: valid.length });
  }

  if (action === "finalize") {
    const transferId = text(body.transferId);
    const transfer = await finalizeTransfer(transferId);
    if (!transfer) return NextResponse.json({ ok: false, message: "Transfer not found." }, { status: 404 });
    const origin = new URL(request.url).origin;
    const publicUrl = origin + "/transfer/" + transfer.token;
    const email = await sendTransferEmails(transfer, publicUrl);
    return NextResponse.json({ ok: true, transfer, publicUrl, email });
  }

  if (action === "disable") {
    await disableTransfer(text(body.transferId));
    return NextResponse.json({ ok: true });
  }

  if (action === "extend") {
    await extendTransfer(text(body.transferId), text(body.expiresAt));
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
