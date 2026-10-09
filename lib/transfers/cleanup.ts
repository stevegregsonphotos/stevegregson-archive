import {
  deleteUploadingTransferRecord,
  listAbandonedTransferIds,
  listTransfersToPurge,
  markTransferFilesPurged,
} from "./repository";
import { deleteTransferObjects } from "./storage";
import { listExpiredTrashIds } from "@/lib/client-archive/trash-repository";
import { purgeTrashEntry } from "@/lib/client-archive/operations";

/** Days kept after a transfer expires, so it can still be extended. */
export const KEEP_AFTER_EXPIRY_DAYS = 30;
/** Days items stay in Storage's Deleted Files. */
export const KEEP_DELETED_DAYS = 30;

/** Removes transfers whose upload never finished (closed tab, lost connection). */
export async function cleanUpAbandonedTransfers() {
  let removed = 0;
  for (const id of await listAbandonedTransferIds(24)) {
    await deleteTransferObjects(id);
    if (await deleteUploadingTransferRecord(id)) removed += 1;
  }
  return removed;
}

/**
 * Daily housekeeping so storage doesn't quietly fill up and cost money:
 * - files uploaded for a transfer are removed 30 days after it expires
 *   (files sent from Storage stay in Storage — only the transfer's copy goes)
 * - Deleted Files older than 30 days are deleted for good
 * - unfinished uploads older than a day are removed
 */
export async function runDailyCleanup() {
  const summary = { abandonedUploads: 0, expiredTransfers: 0, deletedFiles: 0, errors: [] as string[] };

  try {
    summary.abandonedUploads = await cleanUpAbandonedTransfers();
  } catch (error) {
    summary.errors.push("abandoned uploads: " + String(error));
  }

  try {
    for (const id of await listTransfersToPurge(KEEP_AFTER_EXPIRY_DAYS)) {
      await deleteTransferObjects(id);
      await markTransferFilesPurged(id);
      summary.expiredTransfers += 1;
    }
  } catch (error) {
    summary.errors.push("expired transfers: " + String(error));
  }

  try {
    for (const id of await listExpiredTrashIds(KEEP_DELETED_DAYS)) {
      await purgeTrashEntry(id);
      summary.deletedFiles += 1;
    }
  } catch (error) {
    summary.errors.push("deleted files: " + String(error));
  }

  return summary;
}
