import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBackstagePage } from "@/lib/backstage-page-auth";
import { getTransferById } from "@/lib/transfers/repository";
import { defaultBackgroundUrls, toPublicTransfer } from "@/lib/transfers/public";
import type { PublicTransferView } from "@/lib/transfers/types";
import TransferDownloadClient from "../[token]/TransferDownloadClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Client page preview · Steve Gregson Backstage" },
  robots: { index: false, follow: false },
};

// Steve-only preview of what clients see: either a real transfer (?id=…)
// shown unlocked, or a sample transfer using the current default backgrounds.
export default async function TransferPreviewPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  await requireBackstagePage("/transfer/preview" + (id ? "?id=" + encodeURIComponent(id) : ""));

  if (id) {
    const transfer = await getTransferById(id);
    if (!transfer) notFound();
    const view = await toPublicTransfer({ ...transfer, status: "active", hasPassword: false }, { unlocked: true });
    return <TransferDownloadClient initial={view} demo />;
  }

  return <TransferDownloadClient initial={sampleTransfer(await defaultBackgroundUrls())} demo />;
}

/** A realistic example transfer for previewing the design. */
function sampleTransfer(backgroundUrls: string[]): PublicTransferView {
  const names = [
    "Hamlet_Dress_001.jpg", "Hamlet_Dress_002.jpg", "Hamlet_Dress_003.jpg", "Hamlet_Dress_004.jpg",
    "Hamlet_Dress_005.jpg", "Hamlet_Dress_006.jpg", "Hamlet_Dress_007.jpg", "Hamlet_Dress_008.jpg",
    "Press selects/Hamlet_Press_01.jpg", "Press selects/Hamlet_Press_02.jpg", "Press selects/Hamlet_Press_03.jpg",
    "Hamlet_Contact_Sheet.pdf",
  ];
  return {
    token: "preview",
    title: "Hamlet — Dress rehearsal",
    available: true,
    locked: false,
    message: "Hi both — here are the edited images from last night's dress. The press selects are in their own folder. Any questions, just shout!\n\nSteve",
    fileCount: names.length,
    totalSizeBytes: names.length * 14_200_000,
    expiresAt: new Date(Date.now() + 60 * 86_400_000).toISOString(),
    files: names.map((name, index) => ({ id: "sample-" + index, name, sizeBytes: 14_200_000 })),
    backgroundUrls,
  };
}
