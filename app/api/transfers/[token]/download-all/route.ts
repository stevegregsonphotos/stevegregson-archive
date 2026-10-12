import { NextResponse, after } from "next/server";
import {
  getTransferByToken,
  getTransferPasswordHash,
  recordTransferDownloadAndCheckFirst,
  verifyTransferPassword,
} from "@/lib/transfers/repository";
import { createTransferViewUrl } from "@/lib/transfers/storage";
import { createClientArchiveViewUrl } from "@/lib/client-archive/storage";
import { sendFirstDownloadNotice } from "@/lib/transfers/email";
import { isDeliverable, isTransferPasswordLocked, noteTransferPasswordResult } from "@/lib/transfers/public";

// Links for every file in a transfer, used to build "Download all" as one zip
// in the client's browser. Links last 12 hours so a big download on a slow
// connection doesn't run out of time part-way.
const LINK_SECONDS = 12 * 60 * 60;

/** Unique names inside the zip ("photo.jpg", "photo (2).jpg", …). */
function uniqueNames(names: string[]) {
  const seen = new Map<string, number>();
  return names.map((raw) => {
    const name = raw.replace(/^\/+/, "").replace(/\.\.(\/|$)/g, "") || "file";
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
  const transfer = await getTransferByToken(token);
  if (!transfer || transfer.status !== "active") {
    return NextResponse.json({ ok: false, message: "This transfer is no longer available." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const password = typeof body.password === "string" ? body.password : "";
  if (transfer.hasPassword) {
    if (await isTransferPasswordLocked(request, token)) {
      return NextResponse.json({ ok: false, message: "Too many attempts. Please wait 15 minutes and try again." }, { status: 429 });
    }
    if (!verifyTransferPassword(password, await getTransferPasswordHash(token))) {
      await noteTransferPasswordResult(request, token, false);
      return NextResponse.json({ ok: false, message: "That password isn't right." }, { status: 403 });
    }
  }

  const files = transfer.files.filter(isDeliverable);
  const names = uniqueNames(files.map((file) => file.relativePath || file.originalName));
  const entries = await Promise.all(files.map(async (file, index) => ({
    name: names[index],
    size: file.sizeBytes,
    lastModified: file.createdAt,
    url: file.source === "archive"
      ? await createClientArchiveViewUrl(file.objectKey, LINK_SECONDS)
      : await createTransferViewUrl(file.objectKey, LINK_SECONDS),
  })));

  const first = await recordTransferDownloadAndCheckFirst({ transferId: transfer.id, eventType: "all" }).catch(() => false);
  if (first) {
    const adminUrl = (process.env.VERCEL_ENV === "production" ? "https://www.stevegregson.com" : new URL(request.url).origin) + "/admin/transfers/" + transfer.id;
    after(() => sendFirstDownloadNotice(transfer, adminUrl, "All files (" + files.length + ")"));
  }

  return NextResponse.json({ ok: true, name: transfer.title, files: entries });
}
