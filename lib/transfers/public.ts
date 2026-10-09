import type { PublicTransferView, TransferRecord } from "./types";
import { MAX_BACKGROUNDS, TRANSFER_BRAND_BACKGROUNDS, isTransferImage, isWebImage } from "./backgrounds";
import { createTransferViewUrl, getTransferBackdropKey } from "./storage";
import { listBrandBackgrounds } from "./brand-repository";
import { createClientArchiveViewUrl } from "@/lib/client-archive/storage";
import {
  clearProductionUnlockFailures,
  isProductionUnlockRateLimited,
  recordProductionUnlockFailure,
} from "@/lib/production-unlock-rate-limit";

/** Storage files Steve has moved to Deleted Files are hidden from clients. */
export function isDeliverable(file: TransferRecord["files"][number]) {
  return !(file.source === "archive" && file.objectKey.split("/")[1] === ".trash");
}

/**
 * Steve's default backgrounds: his uploaded ones if he has any, otherwise the
 * built-in collection. Shown when a transfer has no photos picked.
 */
export async function defaultBackgroundUrls() {
  try {
    const uploaded = await listBrandBackgrounds();
    if (uploaded.length) {
      const urls = await Promise.all(
        uploaded.slice(0, MAX_BACKGROUNDS).map((item) => createTransferViewUrl(item.objectKey).catch(() => "")),
      );
      const usable = urls.filter(Boolean);
      if (usable.length) return usable;
    }
  } catch (error) {
    console.error("Default backgrounds unavailable", error);
  }
  return [...TRANSFER_BRAND_BACKGROUNDS];
}

async function backgroundUrls(transfer: TransferRecord) {
  const chosen = transfer.backgroundFileIds
    .map((id) => transfer.files.find((file) => file.id === id))
    .filter((file): file is NonNullable<typeof file> => Boolean(file && isTransferImage(file) && isDeliverable(file)))
    .slice(0, MAX_BACKGROUNDS);

  const urls = await Promise.all(chosen.map(async (file) => {
    try {
      // Prefer the web-sized copy; fall back to the original if it's a web image.
      if (transfer.backdropFileIds.includes(file.id)) {
        return await createTransferViewUrl(getTransferBackdropKey(transfer.id, file.id));
      }
      if (!isWebImage(file)) return "";
      return file.source === "archive"
        ? await createClientArchiveViewUrl(file.objectKey)
        : await createTransferViewUrl(file.objectKey);
    } catch {
      return "";
    }
  }));
  const usable = urls.filter(Boolean);
  return usable.length ? usable : defaultBackgroundUrls();
}

/**
 * Builds the client-facing view of a transfer. Recipient and sender emails,
 * download history and storage locations are never included. When a
 * transfer has a password, nothing beyond the title and size is revealed
 * until the password has been checked.
 */
export async function toPublicTransfer(
  transfer: TransferRecord,
  options: { unlocked: boolean },
): Promise<PublicTransferView> {
  const available = transfer.status === "active";
  const locked = available && transfer.hasPassword && !options.unlocked;
  const open = available && !locked;
  const deliverable = transfer.files.filter(isDeliverable);

  return {
    token: transfer.token,
    title: transfer.title,
    available,
    locked,
    message: open ? transfer.message : "",
    fileCount: available ? deliverable.length : 0,
    totalSizeBytes: available ? deliverable.reduce((sum, file) => sum + file.sizeBytes, 0) : 0,
    expiresAt: transfer.expiresAt,
    files: open
      ? deliverable.map((file) => ({
          id: file.id,
          name: file.relativePath || file.originalName,
          sizeBytes: file.sizeBytes,
        }))
      : [],
    backgroundUrls: open ? await backgroundUrls(transfer) : await defaultBackgroundUrls(),
  };
}

/** Wrong-password protection: 5 tries per 15 minutes per visitor per transfer. */
export async function isTransferPasswordLocked(request: Request, token: string) {
  try {
    return await isProductionUnlockRateLimited(request, "transfer:" + token);
  } catch {
    return false;
  }
}

export async function noteTransferPasswordResult(
  request: Request,
  token: string,
  success: boolean,
) {
  try {
    if (success) await clearProductionUnlockFailures(request, "transfer:" + token);
    else await recordProductionUnlockFailure(request, "transfer:" + token);
  } catch {
    // Rate limiting is best-effort; never block a download because of it.
  }
}
