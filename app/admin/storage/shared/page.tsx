import type { Metadata } from "next";
import { requireBackstagePage } from "@/lib/backstage-page-auth";
import SharedFoldersClient from "./SharedFoldersClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Shared with clients | Storage | Backstage",
  robots: { index: false, follow: false },
};

export default async function SharedFoldersPage() {
  await requireBackstagePage("/admin/storage/shared");
  return <SharedFoldersClient />;
}
