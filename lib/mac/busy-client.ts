"use client";

// "Is the Mac still sending changes to this folder?"
// The Mac app reports which folders still have files waiting to reach Storage
// (new exports, metadata edits, renames). Storage and Transfers use this to
// warn Steve before he sends a folder whose final versions aren't all up yet.

export type MacBusy = {
  /** Files still to reach Storage in the folders that matter. */
  files: number;
  /** Those folders (Storage paths). */
  folders: string[];
  /** Minutes since the Mac last reported. */
  minutesAgo: number;
  paused: boolean;
};

type MacStatusRow = {
  receivedAt: string;
  status?: { busyFolders?: Array<{ path: string; files: number }>; paused?: boolean };
};

/** How old a "still sending" report can be before it is ignored. */
export const BUSY_REPORT_MAX_AGE_MS = 15 * 60 * 1000;

let cache: { at: number; macs: MacStatusRow[] } | undefined;

async function loadMacs(maxAgeMs: number) {
  if (cache && Date.now() - cache.at < maxAgeMs) return cache.macs;
  const response = await fetch("/api/admin/storage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "mac-progress" }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  const macs: MacStatusRow[] = data && data.ok && Array.isArray(data.macs) ? data.macs : [];
  cache = { at: Date.now(), macs };
  return macs;
}

function overlaps(busy: string, path: string) {
  if (!path) return true; // "All files"
  return busy === path || busy.startsWith(path + "/") || path.startsWith(busy + "/");
}

/**
 * Pending Mac changes that touch any of these Storage paths (folders or
 * files), or null if there are none. Never throws: if the check itself
 * fails, it says nothing rather than blocking a send.
 */
export async function macBusyFor(paths: string[], maxAgeMs = 15000): Promise<MacBusy | null> {
  try {
    const macs = await loadMacs(maxAgeMs);
    let files = 0;
    let newest = 0;
    let paused = false;
    const folders = new Set<string>();
    for (const mac of macs) {
      const received = new Date(mac.receivedAt).getTime();
      // While the Mac is working it reports every 15 seconds, and it sends a
      // final "all done" report when it finishes. A "still sending" report
      // older than 15 minutes is left over from a run that has ended (or the
      // Mac went to sleep), so it isn't trusted.
      if (!received || Date.now() - received > BUSY_REPORT_MAX_AGE_MS) continue;
      for (const busy of mac.status?.busyFolders || []) {
        if (!paths.some((path) => overlaps(busy.path, path))) continue;
        files += busy.files;
        folders.add(busy.path);
        newest = Math.max(newest, received);
        if (mac.status?.paused) paused = true;
      }
    }
    if (!files) return null;
    return { files, folders: [...folders], minutesAgo: Math.max(0, Math.round((Date.now() - newest) / 60000)), paused };
  } catch {
    return null;
  }
}

/** One plain-English sentence for the warning. */
export function macBusyText(busy: MacBusy) {
  const what = busy.files === 1 ? "1 file" : busy.files.toLocaleString("en-GB") + " files";
  const where = busy.folders.length === 1 ? "“" + busy.folders[0].split("/").slice(-2).join(" › ") + "”" : busy.folders.length + " folders here";
  const status = busy.paused
    ? " Uploads are paused on your Mac, so they won't arrive until you resume."
    : "";
  return "Your Mac is still sending changes to " + where + ": " + what + " not in Storage yet (new exports, edits or renames)." + status +
    " Wait until it says everything's uploaded before sending, or the client may get old names or metadata.";
}
