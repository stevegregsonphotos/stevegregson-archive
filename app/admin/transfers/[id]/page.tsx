import { notFound } from "next/navigation";
import { getTransferById } from "@/lib/transfers/repository";
import TransferDetailClient from "./TransferDetailClient";

export const dynamic = "force-dynamic";

export default async function TransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const transfer = await getTransferById(id);
  if (!transfer) notFound();

  const siteUrl =
    process.env.VERCEL_ENV === "production"
      ? "https://www.stevegregson.com"
      : process.env.VERCEL_URL
        ? "https://" + process.env.VERCEL_URL
        : "";

  return (
    <TransferDetailClient
      initialTransfer={transfer}
      publicUrl={siteUrl + "/transfer/" + transfer.token}
    />
  );
}
