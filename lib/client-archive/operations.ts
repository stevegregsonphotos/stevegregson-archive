import {
  TRASH_FOLDER,
  archiveKeyFor,
  archiveObjectExists,
  archiveObjectSize,
  archivePathTaken,
  deleteArchiveObjects,
  ensureArchiveFolderMarker,
  listArchiveObjectsUnder,
  moveArchiveObject,
} from "./storage";
import { addTrashEntry, getTrashEntry, removeTrashEntry } from "./trash-repository";
import {
  removeArchiveFilesFromTransfers,
  updateArchiveObjectKeys,
} from "@/lib/transfers/repository";

// Rename, move, delete-to-Deleted-Files and restore for Storage.
//
// Each operation is first "planned" into a list of from → to moves (one per
// stored object, so a folder of 300 photos is 300 moves). The browser then
// applies them in small chunks, which keeps every request short and lets a
// half-finished move simply be retried.

export type StorageItem = { kind: "file" | "folder"; path: string };
export type MovePair = { from: string; to: string };

export const MAX_PAIRS_PER_APPLY = 100;

function clean(path: string) {
  return path.replace(/\\/g, "/").split("/").map((p) => p.trim()).filter(Boolean).join("/");
}
function parentOf(path: string) {
  const parts = clean(path).split("/");
  parts.pop();
  return parts.join("/");
}
function baseOf(path: string) {
  return clean(path).split("/").pop() || "";
}
function join(...parts: string[]) {
  return parts.map(clean).filter(Boolean).join("/");
}

export function validName(name: string) {
  const value = name.trim();
  if (!value || value === "." || value === ".." || /[\/\\\u0000-\u001f]/.test(value)) {
    throw new Error("Names can't be empty or contain slashes.");
  }
  if (value === TRASH_FOLDER || value === ".folder") throw new Error("That name is reserved.");
  return value;
}

function normaliseItems(items: unknown): StorageItem[] {
  if (!Array.isArray(items) || !items.length) throw new Error("Choose something first.");
  if (items.length > 500) throw new Error("Choose 500 items or fewer at once.");
  return items.map((raw) => {
    const item = raw as Partial<StorageItem>;
    const path = clean(typeof item.path === "string" ? item.path : "");
    if (!path || path.split("/")[0] === TRASH_FOLDER) throw new Error("Invalid item.");
    return { kind: item.kind === "folder" ? "folder" : "file", path };
  });
}

/** from/to pairs for one item going to a new location (file, or a whole folder). */
async function pairsFor(item: StorageItem, target: string): Promise<{ pairs: MovePair[]; count: number; bytes: number }> {
  if (item.kind === "file") {
    const size = await archiveObjectSize(item.path);
    if (size === undefined) throw new Error("\"" + baseOf(item.path) + "\" no longer exists.");
    return { pairs: [{ from: item.path, to: target }], count: 1, bytes: size };
  }
  const objects = await listArchiveObjectsUnder(item.path);
  return {
    pairs: objects.map((object) => ({ from: object.path, to: target + object.path.slice(item.path.length) })),
    count: objects.filter((object) => !object.path.endsWith("/.folder")).length,
    bytes: objects.reduce((sum, object) => sum + object.sizeBytes, 0),
  };
}

export async function planMove(rawItems: unknown, rawDestination: unknown) {
  const items = normaliseItems(rawItems);
  const destination = clean(typeof rawDestination === "string" ? rawDestination : "");
  if (destination.split("/")[0] === TRASH_FOLDER) throw new Error("Invalid destination.");
  const pairs: MovePair[] = [];
  for (const item of items) {
    if (item.kind === "folder" && (destination === item.path || destination.startsWith(item.path + "/"))) {
      throw new Error("A folder can't be moved inside itself.");
    }
    if (parentOf(item.path) === destination) continue;
    const target = join(destination, baseOf(item.path));
    if (await archivePathTaken(target)) {
      throw new Error("Something called \"" + baseOf(item.path) + "\" is already in that folder.");
    }
    pairs.push(...(await pairsFor(item, target)).pairs);
    await ensureArchiveFolderMarker(parentOf(item.path));
  }
  return pairs;
}

export async function planRename(rawItem: unknown, rawName: unknown) {
  const [item] = normaliseItems([rawItem]);
  const name = validName(typeof rawName === "string" ? rawName : "");
  const target = join(parentOf(item.path), name);
  if (target === item.path) return [];
  // A change of capitals only is fine; anything else must not clash.
  if (target.toLowerCase() !== item.path.toLowerCase() && (await archivePathTaken(target))) {
    throw new Error("Something called \"" + name + "\" is already in this folder.");
  }
  return (await pairsFor(item, target)).pairs;
}

/** Moves items into Deleted Files, one restorable entry per item. */
export async function planDelete(rawItems: unknown) {
  const items = normaliseItems(rawItems);
  const pairs: MovePair[] = [];
  for (const item of items) {
    const id = crypto.randomUUID();
    const name = baseOf(item.path);
    const planned = await pairsFor(item, join(TRASH_FOLDER, id, name));
    await addTrashEntry({
      id,
      name,
      kind: item.kind,
      originalParent: parentOf(item.path),
      itemCount: planned.count,
      sizeBytes: planned.bytes,
    });
    await ensureArchiveFolderMarker(parentOf(item.path));
    pairs.push(...planned.pairs);
  }
  return pairs;
}

function restoredName(name: string, kind: StorageItem["kind"], attempt: number) {
  const suffix = attempt === 1 ? " (restored)" : " (restored " + attempt + ")";
  if (kind === "folder") return name + suffix;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) + suffix + name.slice(dot) : name + suffix;
}

/** Puts a Deleted Files entry back where it came from (renamed if that spot is now taken). */
export async function planRestore(trashId: string) {
  const entry = await getTrashEntry(trashId);
  if (!entry) throw new Error("That item is no longer in Deleted Files.");
  let name = entry.name;
  for (let attempt = 1; await archivePathTaken(join(entry.originalParent, name)); attempt += 1) {
    if (attempt > 20) throw new Error("Couldn't find a free name to restore to.");
    name = restoredName(entry.name, entry.kind, attempt);
  }
  const trashRoot = join(TRASH_FOLDER, entry.id, entry.name);
  const target = join(entry.originalParent, name);
  const objects = await listArchiveObjectsUnder(join(TRASH_FOLDER, entry.id));
  return {
    restoredAs: target,
    pairs: objects.map((object) => ({ from: object.path, to: target + object.path.slice(trashRoot.length) })),
  };
}

/** Applies up to 100 planned moves. Safe to repeat if interrupted. */
export async function applyPairs(rawPairs: unknown) {
  if (!Array.isArray(rawPairs) || rawPairs.length > MAX_PAIRS_PER_APPLY) throw new Error("Invalid request.");
  const pairs = rawPairs.map((raw) => {
    const pair = raw as Partial<MovePair>;
    const from = clean(typeof pair.from === "string" ? pair.from : "");
    const to = clean(typeof pair.to === "string" ? pair.to : "");
    if (!from || !to) throw new Error("Invalid request.");
    return { from, to };
  });

  let next = 0;
  const worker = async () => {
    while (next < pairs.length) {
      const pair = pairs[next++];
      try {
        await moveArchiveObject(pair.from, pair.to);
      } catch (error) {
        // Already moved on an earlier, interrupted attempt.
        if (!(await archiveObjectExists(pair.from)) && (await archiveObjectExists(pair.to))) continue;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, pairs.length) }, worker));

  await updateArchiveObjectKeys(pairs.map((pair) => ({ from: archiveKeyFor(pair.from), to: archiveKeyFor(pair.to) })));
  return pairs.length;
}

/** Finishes a restore once every object is back. */
export async function forgetTrashEntry(trashId: string) {
  const remaining = await listArchiveObjectsUnder(join(TRASH_FOLDER, trashId)).catch(() => []);
  if (!remaining.length) await removeTrashEntry(trashId);
}

/** Permanently deletes a Deleted Files entry, and takes it out of any transfers. */
export async function purgeTrashEntry(trashId: string) {
  const root = join(TRASH_FOLDER, clean(trashId));
  if (root === TRASH_FOLDER) throw new Error("Invalid item.");
  const objects = await listArchiveObjectsUnder(root);
  await deleteArchiveObjects(objects.map((object) => object.path));
  await removeArchiveFilesFromTransfers(archiveKeyFor(root) + "/");
  await removeTrashEntry(trashId);
}
