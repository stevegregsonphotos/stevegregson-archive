import type { Metadata, Viewport } from "next";
import { getFileRequestByToken } from "@/lib/requests/repository";
import { defaultBackgroundUrls } from "@/lib/transfers/public";
import RequestUploadClient from "./RequestUploadClient";

export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: "#0b0a0a" };

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const found = await getFileRequestByToken(token).catch(() => undefined);
  return {
    title: { absolute: (found ? found.title + " · " : "") + "Send files to Steve Gregson Photography" },
    robots: { index: false, follow: false, noarchive: true },
    referrer: "no-referrer",
  };
}

export default async function FileRequestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await getFileRequestByToken(token).catch(() => undefined);
  const open = Boolean(found && found.status === "open" && found.folderPath.split("/")[0] !== ".trash");
  const backgrounds = await defaultBackgroundUrls();
  return (
    <RequestUploadClient
      token={token}
      open={open}
      title={found?.title || "Send files"}
      message={open ? found!.message : ""}
      expiresAt={found?.expiresAt}
      background={backgrounds[0]}
    />
  );
}
