import { NextResponse } from "next/server";
import { getTransferByToken } from "@/lib/transfers/repository";
import { createTransferViewUrl } from "@/lib/transfers/storage";
import { createClientArchiveViewUrl } from "@/lib/client-archive/storage";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const transfer = await getTransferByToken(token);
  if (!transfer || transfer.status !== "active") return NextResponse.json({ ok: false }, { status: 404 });
  const fileId = new URL(request.url).searchParams.get("fileId") || "";
  const fallback = transfer.files.filter((file) => file.contentType.startsWith("image/")).slice(0, 5).map((file) => file.id);
  const allowed = transfer.backgroundFileIds.length ? transfer.backgroundFileIds : fallback;
  if (!allowed.includes(fileId)) return NextResponse.json({ ok: false }, { status: 403 });
  const file = transfer.files.find((candidate) => candidate.id === fileId && candidate.contentType.startsWith("image/"));
  if (!file) return NextResponse.json({ ok: false }, { status: 404 });
  const url = file.source === "archive"
    ? await createClientArchiveViewUrl(file.objectKey)
    : await createTransferViewUrl(file.objectKey);
  return NextResponse.json({ ok: true, url });
}
