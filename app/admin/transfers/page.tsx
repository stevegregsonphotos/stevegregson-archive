import type { Metadata } from "next";
import TransferWorkspace from "./TransferWorkspace";
import { listTransfers } from "@/lib/transfers/repository";
import { requireBackstagePage } from "@/lib/backstage-page-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Transfers | Backstage",
  robots: { index: false, follow: false },
};

export default async function TransfersPage() {
  await requireBackstagePage("/admin/transfers");
  const transfers = await listTransfers();
  return <TransferWorkspace initialTransfers={transfers} />;
}
