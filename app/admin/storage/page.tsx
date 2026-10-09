import type { Metadata } from "next";
import StorageBrowser from "./StorageBrowser";

export const metadata: Metadata = {
  title: "Storage | Steve Gregson Backstage",
  robots: { index: false, follow: false },
};

export default function StoragePage() {
  return <StorageBrowser />;
}
