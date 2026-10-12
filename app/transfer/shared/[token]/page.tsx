import type { Metadata, Viewport } from "next";
import { getShareByToken } from "@/lib/shares/repository";
import { defaultBackgroundUrls } from "@/lib/transfers/public";
import { TRANSFER_BRAND_BACKGROUNDS } from "@/lib/transfers/backgrounds";
import SharedFolderClient from "./SharedFolderClient";

export const dynamic = "force-dynamic";

export const viewport: Viewport = { themeColor: "#0b0a0a" };

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const found = await getShareByToken(token).catch(() => undefined);
  const title = (found ? found.share.title + " · " : "") + "Shared by Steve Gregson Photography";
  return {
    title: { absolute: title },
    description: "Photographs shared by Steve Gregson Photography.",
    robots: { index: false, follow: false, noarchive: true },
    referrer: "no-referrer",
    openGraph: {
      title,
      description: "Photographs shared by Steve Gregson Photography.",
      images: [{ url: "https://www.stevegregson.com" + TRANSFER_BRAND_BACKGROUNDS[1] }],
      siteName: "Steve Gregson Photography",
    },
  };
}

export default async function SharedFolderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await getShareByToken(token).catch(() => undefined);
  const available = Boolean(found && found.share.path.split("/")[0] !== ".trash");
  return (
    <SharedFolderClient
      token={token}
      available={available}
      title={found && available ? found.share.title : "Shared folder"}
      message={found && available && !found.share.hasPassword ? found.share.message : ""}
      hasPassword={Boolean(found?.share.hasPassword)}
      backgrounds={await defaultBackgroundUrls()}
    />
  );
}
