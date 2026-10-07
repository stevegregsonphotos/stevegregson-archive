import type { Metadata } from "next";
import TransferWorkspace from "./TransferWorkspace";
import { listTransfers } from "@/lib/transfers/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Transfers | Backstage",
  robots: { index: false, follow: false },
};

export default async function TransfersPage() {
  const transfers = await listTransfers();
  return <TransferWorkspace initialTransfers={transfers} />;
}
