import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTransferByToken } from "@/lib/transfers/repository";
import { toPublicTransfer } from "@/lib/transfers/public";
import TransferDownloadClient from "./TransferDownloadClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Files from Steve Gregson Photography",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

export default async function TransferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const transfer = await getTransferByToken(token);
  if (!transfer || transfer.status === "uploading") notFound();
  return <TransferDownloadClient initial={await toPublicTransfer(transfer, { unlocked: false })} />;
}
