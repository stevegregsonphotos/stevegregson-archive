import { NextResponse } from "next/server";
import { isBackstageRequestAuthenticated } from "@/lib/backstage-auth";
import {
  createFileRequest,
  deleteFileRequest,
  getFileRequestById,
  listFileRequests,
  setFileRequestStatus,
} from "@/lib/requests/repository";
import { requestLink, sendFileRequestEmail } from "@/lib/requests/email";
import { ensureArchiveFolderMarker } from "@/lib/client-archive/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanFolder(value: string) {
  return value.replace(/\\/g, "/").split("/").map((part) => part.replace(/[\u0000-\u001f]/g, "").trim()).filter((part) => part && part !== "." && part !== "..").join("/");
}

export async function POST(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const withLink = <T extends { token: string }>(item: T) => ({ ...item, link: requestLink(item.token, request.url) });

    if (body.action === "list") {
      return NextResponse.json({ ok: true, requests: (await listFileRequests()).map(withLink) });
    }
    if (body.action === "create") {
      const title = text(body.title);
      if (!title) throw new Error("Give the request a title.");
      const email = text(body.email).toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("That email address doesn't look right.");
      const folderPath = cleanFolder(text(body.folder) || "Received/" + title);
      if (!folderPath || folderPath.split("/")[0] === ".trash") throw new Error("Choose a different folder name.");
      const days = [7, 14, 30, 60, 90].includes(Number(body.expiryDays)) ? Number(body.expiryDays) : 30;
      await ensureArchiveFolderMarker(folderPath);
      const created = await createFileRequest({ title, message: text(body.message), recipientEmail: email || undefined, folderPath, expiryDays: days });
      const link = requestLink(created.token, request.url);
      const emailResult = email && body.sendEmail !== false ? await sendFileRequestEmail(created, link) : null;
      return NextResponse.json({ ok: true, request: { ...created, link }, email: emailResult });
    }
    const id = text(body.id);
    if (body.action === "close") await setFileRequestStatus(id, "closed");
    else if (body.action === "reopen") await setFileRequestStatus(id, "open", 14);
    else if (body.action === "delete") await deleteFileRequest(id);
    else if (body.action === "resend") {
      const found = await getFileRequestById(id);
      if (!found) throw new Error("That request no longer exists.");
      return NextResponse.json({ ok: true, email: await sendFileRequestEmail(found, requestLink(found.token, request.url)) });
    } else return NextResponse.json({ ok: false, message: "Unknown action." }, { status: 400 });
    return NextResponse.json({ ok: true, requests: (await listFileRequests()).map(withLink) });
  } catch (error) {
    console.error("File request admin failed", error);
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Something went wrong." }, { status: 400 });
  }
}
