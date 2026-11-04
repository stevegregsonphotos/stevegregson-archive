import type { Metadata } from "next";
import TransferWorkspace from "./TransferWorkspace";
import { listKnownRecipientEmails, listTransfers } from "@/lib/transfers/repository";
import { requireBackstagePage } from "@/lib/backstage-page-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Transfers | Backstage",
  robots: { index: false, follow: false },
};

export default async function TransfersPage() {
  await requireBackstagePage("/admin/transfers");
  const [transfers, knownEmails] = await Promise.all([listTransfers(), listKnownRecipientEmails()]);
  return <TransferWorkspace initialTransfers={transfers} knownEmails={knownEmails} />;
}
