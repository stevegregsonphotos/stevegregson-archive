import { NextResponse } from "next/server";
import { isBackstageRequestAuthenticated } from "@/lib/backstage-auth";
import { getTransferById } from "@/lib/transfers/repository";
import { getTransferObjectKey, putTransferObject } from "@/lib/transfers/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const transferId = url.searchParams.get("transferId")?.trim() ?? "";
  const fileId = url.searchParams.get("fileId")?.trim() ?? "";
  const contentType = request.headers.get("content-type") || "application/octet-stream";

  if (!transferId || !fileId) {
    return NextResponse.json({ ok: false, message: "Transfer and file IDs are required." }, { status: 400 });
  }

  const transfer = await getTransferById(transferId);
  if (!transfer || transfer.status !== "uploading") {
    return NextResponse.json({ ok: false, message: "Transfer is not available for upload." }, { status: 404 });
  }

  const objectKey = getTransferObjectKey(transferId, fileId);
  const bytes = new Uint8Array(await request.arrayBuffer());
  await putTransferObject(objectKey, bytes, contentType);

  return NextResponse.json({ ok: true, objectKey });
}
