// Makes light, web-sized JPEG copies of photographs in the browser, so client
// pages load quickly without any image processing on Vercel.

import { postTransferAction } from "./upload-client";

export const BACKDROP_LONG_EDGE = 2560;

export type Backdrop = { blob: Blob; width: number; height: number };

/** Resizes an image (File/Blob) to at most `longEdge` pixels on its long side. */
export async function makeBackdrop(source: Blob, longEdge = BACKDROP_LONG_EDGE, quality = 0.84): Promise<Backdrop> {
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't prepare images.");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("This browser couldn't prepare the image.");
  return { blob, width, height };
}

/** Browser-friendly photo formats that can be turned into backgrounds. */
export function canMakeBackdrop(file: { name: string; type: string }) {
  return /^image\/(jpeg|png|webp)$/i.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

async function putJpeg(url: string, blob: Blob) {
  const response = await fetch(url, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" } });
  if (!response.ok) throw new Error("Upload failed (HTTP " + response.status + ").");
}

/** Makes and stores the web-sized background copy for one photo in a transfer. */
export async function uploadTransferBackdrop(transferId: string, fileId: string, source: Blob) {
  const backdrop = await makeBackdrop(source);
  const { uploadUrl } = await postTransferAction<{ uploadUrl: string }>({ action: "backdrop-presign", transferId, fileId });
  await putJpeg(uploadUrl, backdrop.blob);
  await postTransferAction({ action: "backdrop-commit", transferId, fileId });
}

/**
 * For photos already uploaded: fetches the original from storage and makes the
 * copy. Needs the storage bucket to allow reading from the browser; if it
 * doesn't, the client page simply uses the original photo instead.
 */
export async function uploadTransferBackdropFromUrl(transferId: string, fileId: string, url: string) {
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) throw new Error("Couldn't read the photo (HTTP " + response.status + ").");
  await uploadTransferBackdrop(transferId, fileId, await response.blob());
}

/** Adds one of Steve's own default backgrounds. */
export async function uploadBrandBackground(file: File) {
  const backdrop = await makeBackdrop(file);
  const { id, uploadUrl } = await postTransferAction<{ id: string; uploadUrl: string }>({ action: "brand-presign" });
  await putJpeg(uploadUrl, backdrop.blob);
  await postTransferAction({ action: "brand-commit", id, width: backdrop.width, height: backdrop.height });
}
