import { NextResponse } from "next/server";
import { getTransferByToken } from "@/lib/transfers/repository";
import { coverImageUrl } from "@/lib/transfers/public";
import { TRANSFER_BRAND_BACKGROUNDS } from "@/lib/transfers/backgrounds";

// The photograph at the top of a client's email. Email apps need a fixed web
// address, so this always forwards to a fresh, short-lived link to the image.
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const origin = new URL(request.url).origin;
  let target = origin + TRANSFER_BRAND_BACKGROUNDS[0];
  try {
    const transfer = await getTransferByToken(token);
    if (transfer) {
      const url = await coverImageUrl(transfer);
      if (url) target = url.startsWith("/") ? origin + url : url;
    }
  } catch (error) {
    console.error("Transfer cover unavailable", error);
  }
  return NextResponse.redirect(target, {
    status: 302,
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
