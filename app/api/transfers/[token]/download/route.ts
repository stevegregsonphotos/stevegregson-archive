import { NextResponse, after } from "next/server";
import {
  getTransferByToken,
  getTransferPasswordHash,
  recordTransferDownloadAndCheckFirst,
  verifyTransferPassword,
} from "@/lib/transfers/repository";
import { createTransferDownloadUrl } from "@/lib/transfers/storage";
import { createClientArchiveDownloadUrl } from "@/lib/client-archive/storage";
import { sendFirstDownloadNotice } from "@/lib/transfers/email";
import { isDeliverable, isTransferPasswordLocked, noteTransferPasswordResult } from "@/lib/transfers/public";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const transfer = await getTransferByToken(token);
  if (!transfer || transfer.status !== "active") {
    return NextResponse.json({ ok: false, message: "This transfer is no longer available." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const fileId = typeof body.fileId === "string" ? body.fileId : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (transfer.hasPassword) {
    if (await isTransferPasswordLocked(request, token)) {
      return NextResponse.json({ ok: false, message: "Too many attempts. Please wait 15 minutes and try again." }, { status: 429 });
    }
    const correct = verifyTransferPassword(password, await getTransferPasswordHash(token));
    if (!correct) {
      await noteTransferPasswordResult(request, token, false);
      return NextResponse.json({ ok: false, message: "That password isn't right." }, { status: 403 });
    }
  }

  const file = transfer.files.find((candidate) => candidate.id === fileId && isDeliverable(candidate));
  if (!file) return NextResponse.json({ ok: false, message: "File not found." }, { status: 404 });

  const url = file.source === "archive"
    ? await createClientArchiveDownloadUrl(file.objectKey, file.originalName)
    : await createTransferDownloadUrl(file.objectKey, file.originalName);

  // Logging is for Steve's "Downloaded" status; never fail a download over it.
  const first = await recordTransferDownloadAndCheckFirst({ transferId: transfer.id, fileId: file.id, eventType: "file" }).catch(() => false);
  if (first) {
    const adminUrl = (process.env.VERCEL_ENV === "production" ? "https://www.stevegregson.com" : new URL(request.url).origin) + "/admin/transfers/" + transfer.id;
    // Sent after the client's download has started, so it never slows them down.
    after(() => sendFirstDownloadNotice(transfer, adminUrl, file.relativePath || file.originalName));
  }

  return NextResponse.json({ ok: true, url });
}
