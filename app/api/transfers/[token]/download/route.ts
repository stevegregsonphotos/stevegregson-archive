import { NextResponse } from "next/server";
import {
  getTransferByToken,
  getTransferPasswordHash,
  recordTransferDownload,
  verifyTransferPassword,
} from "@/lib/transfers/repository";
import { createTransferDownloadUrl } from "@/lib/transfers/storage";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const transfer = await getTransferByToken(token);
  if (!transfer || transfer.status !== "active") {
    return NextResponse.json({ ok: false, message: "This transfer is unavailable." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const fileId = typeof body.fileId === "string" ? body.fileId : "";
  const password = typeof body.password === "string" ? body.password : "";
  const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail : undefined;

  if (transfer.hasPassword) {
    const hash = await getTransferPasswordHash(token);
    if (!verifyTransferPassword(password, hash)) {
      return NextResponse.json({ ok: false, message: "Incorrect password." }, { status: 403 });
    }
  }

  const file = transfer.files.find((candidate) => candidate.id === fileId);
  if (!file) return NextResponse.json({ ok: false, message: "File not found." }, { status: 404 });

  await recordTransferDownload({
    transferId: transfer.id, fileId: file.id, recipientEmail, eventType: "file",
  });
  const url = await createTransferDownloadUrl(file.objectKey, file.originalName);
  return NextResponse.json({ ok: true, url });
}
