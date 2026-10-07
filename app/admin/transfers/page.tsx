import type { Metadata } from "next";
import TransferWorkspace from "./TransferWorkspace";
import { listTransfers } from "@/lib/transfers/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Transfers | Backstage",
  robots: { index: false, follow: false },
};

// This route is intentionally isolated to the feature/backstage-transfers preview branch.
export default async function TransfersPage() {
  const transfers = await listTransfers();
  return <TransferWorkspace initialTransfers={transfers} />;
}
