import type { Metadata } from "next";
import { requireBackstagePage } from "@/lib/backstage-page-auth";
import MacAppClient from "./MacAppClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Mac app | Storage | Backstage",
  robots: { index: false, follow: false },
};

export default async function MacAppPage() {
  await requireBackstagePage("/admin/storage/mac");
  return <MacAppClient />;
}
