import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getTransferByToken } from "@/lib/transfers/repository";
import { toPublicTransfer } from "@/lib/transfers/public";
import { TRANSFER_BRAND_BACKGROUNDS } from "@/lib/transfers/backgrounds";
import TransferDownloadClient from "./TransferDownloadClient";

export const dynamic = "force-dynamic";

export const viewport: Viewport = { themeColor: "#0b0a0a" };

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const transfer = await getTransferByToken(token).catch(() => undefined);
  const title = transfer && transfer.status !== "uploading"
    ? transfer.title + " · Files from Steve Gregson Photography"
    : "Files from Steve Gregson Photography";
  return {
    title: { absolute: title },
    description: "Files sent by Steve Gregson Photography.",
    robots: { index: false, follow: false, noarchive: true },
    referrer: "no-referrer",
    // Link previews (iMessage, WhatsApp, email) show one of Steve's photographs.
    openGraph: {
      title,
      description: "Files sent by Steve Gregson Photography.",
      images: [{ url: "https://www.stevegregson.com" + TRANSFER_BRAND_BACKGROUNDS[0] }],
      siteName: "Steve Gregson Photography",
    },
  };
}

export default async function TransferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const transfer = await getTransferByToken(token);
  if (!transfer || transfer.status === "uploading") notFound();
  return <TransferDownloadClient initial={await toPublicTransfer(transfer, { unlocked: false })} />;
}
