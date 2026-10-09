import { NextResponse } from "next/server";
import {
  getTransferByToken,
  getTransferPasswordHash,
  verifyTransferPassword,
} from "@/lib/transfers/repository";
import {
  isTransferPasswordLocked,
  noteTransferPasswordResult,
  toPublicTransfer,
} from "@/lib/transfers/public";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const transfer = await getTransferByToken(token);
  if (!transfer || transfer.status !== "active") {
    return NextResponse.json({ ok: false, message: "This transfer is no longer available." }, { status: 404 });
  }

  if (await isTransferPasswordLocked(request, token)) {
    return NextResponse.json({ ok: false, message: "Too many attempts. Please wait 15 minutes and try again." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const password = typeof body.password === "string" ? body.password : "";
  const correct = verifyTransferPassword(password, await getTransferPasswordHash(token));
  await noteTransferPasswordResult(request, token, correct);
  if (!correct) {
    return NextResponse.json({ ok: false, message: "That password isn't right." }, { status: 403 });
  }

  return NextResponse.json({ ok: true, transfer: await toPublicTransfer(transfer, { unlocked: true }) });
}
