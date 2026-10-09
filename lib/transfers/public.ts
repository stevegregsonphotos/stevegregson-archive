import type { PublicTransferView, TransferRecord } from "./types";
import { isTransferImage } from "./backgrounds";
import { createTransferViewUrl } from "./storage";
import { createClientArchiveViewUrl } from "@/lib/client-archive/storage";
import {
  clearProductionUnlockFailures,
  isProductionUnlockRateLimited,
  recordProductionUnlockFailure,
} from "@/lib/production-unlock-rate-limit";

const MAX_BACKGROUNDS = 6;

async function backgroundUrls(transfer: TransferRecord) {
  const chosen = transfer.backgroundFileIds.length
    ? transfer.backgroundFileIds
        .map((id) => transfer.files.find((file) => file.id === id))
        .filter((file): file is NonNullable<typeof file> => Boolean(file && isTransferImage(file)))
    : [];

  const urls = await Promise.all(
    chosen.slice(0, MAX_BACKGROUNDS).map((file) =>
      (file.source === "archive"
        ? createClientArchiveViewUrl(file.objectKey)
        : createTransferViewUrl(file.objectKey)
      ).catch(() => ""),
    ),
  );
  return urls.filter(Boolean);
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

  return {
    token: transfer.token,
    title: transfer.title,
    available,
    locked,
    message: open ? transfer.message : "",
    fileCount: available ? transfer.fileCount : 0,
    totalSizeBytes: available ? transfer.totalSizeBytes : 0,
    expiresAt: transfer.expiresAt,
    files: open
      ? transfer.files.map((file) => ({
          id: file.id,
          name: file.relativePath || file.originalName,
          sizeBytes: file.sizeBytes,
        }))
      : [],
    backgroundUrls: open ? await backgroundUrls(transfer) : [],
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
