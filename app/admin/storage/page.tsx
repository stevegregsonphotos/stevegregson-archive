import type { Metadata } from "next";
import StorageBrowser from "./StorageBrowser";
import { requireBackstagePage } from "@/lib/backstage-page-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Storage | Steve Gregson Backstage",
  robots: { index: false, follow: false },
};

export default async function StoragePage() {
  await requireBackstagePage("/admin/storage");
  return <StorageBrowser />;
}
