import { NextResponse } from "next/server";
import { isBackstageRequestAuthenticated } from "@/lib/backstage-auth";
import { getTransferById } from "@/lib/transfers/repository";
import {
  abortTransferMultipartUpload,
  beginTransferMultipartUpload,
  completeTransferMultipartUpload,
  getTransferObjectKey,
  uploadTransferMultipartPart,
} from "@/lib/transfers/storage";

export const runtime = "nodejs";

function authenticated(request: Request) {
  return isBackstageRequestAuthenticated(request);
}

async function getUploadingTransfer(transferId: string) {
  const transfer = await getTransferById(transferId);
  return transfer && transfer.status === "uploading" ? transfer : null;
}

export async function POST(request: Request) {
  if (!authenticated(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    action?: string;
    transferId?: string;
    fileId?: string;
    contentType?: string;
    uploadId?: string;
    parts?: Array<{ partNumber: number; etag: string }>;
  };

  const transferId = body.transferId?.trim() ?? "";
  const fileId = body.fileId?.trim() ?? "";
  if (!transferId || !fileId || !(await getUploadingTransfer(transferId))) {
    return NextResponse.json({ ok: false, message: "Transfer is not available for upload." }, { status: 404 });
  }

  const objectKey = getTransferObjectKey(transferId, fileId);

  if (body.action === "begin") {
    const uploadId = await beginTransferMultipartUpload(
      objectKey,
      body.contentType || "application/octet-stream",
    );
    return NextResponse.json({ ok: true, objectKey, uploadId });
  }

  if (body.action === "complete" && body.uploadId && Array.isArray(body.parts)) {
    await completeTransferMultipartUpload(objectKey, body.uploadId, body.parts);
    return NextResponse.json({ ok: true, objectKey });
  }

  if (body.action === "abort" && body.uploadId) {
    await abortTransferMultipartUpload(objectKey, body.uploadId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, message: "Invalid multipart upload action." }, { status: 400 });
}

export async function PUT(request: Request) {
  if (!authenticated(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const transferId = url.searchParams.get("transferId")?.trim() ?? "";
  const fileId = url.searchParams.get("fileId")?.trim() ?? "";
  const uploadId = url.searchParams.get("uploadId")?.trim() ?? "";
  const partNumber = Number(url.searchParams.get("partNumber"));

  if (
    !transferId ||
    !fileId ||
    !uploadId ||
    !Number.isInteger(partNumber) ||
    partNumber < 1 ||
    !(await getUploadingTransfer(transferId))
  ) {
    return NextResponse.json({ ok: false, message: "Invalid multipart upload part." }, { status: 400 });
  }

  const objectKey = getTransferObjectKey(transferId, fileId);
  const bytes = new Uint8Array(await request.arrayBuffer());
  const etag = await uploadTransferMultipartPart(
    objectKey,
    uploadId,
    partNumber,
    bytes,
  );

  return NextResponse.json({ ok: true, etag });
}
