import type { Metadata } from "next";
import { requireBackstagePage } from "@/lib/backstage-page-auth";
import BrandBackgroundsClient from "./BrandBackgroundsClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Client page backgrounds | Backstage",
  robots: { index: false, follow: false },
};

export default async function BrandBackgroundsPage() {
  await requireBackstagePage("/admin/transfers/backgrounds");
  return <BrandBackgroundsClient />;
}
