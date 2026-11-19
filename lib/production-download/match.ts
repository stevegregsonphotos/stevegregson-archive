// Backstage › Productions › Edit › Download photos.
//
// The website keeps only a web-sized WebP copy of each gallery photo, named
// after the file it was made from: "hero-<name>.webp" or "07-<name>.webp",
// where <name> is the original JPEG's name lower-cased with runs of other
// characters turned into "-". These helpers pair those website photos with
// Steve's own Full / Web JPEGs in Storage, and pick the show's folder.
// Pure functions only (no storage calls), so they can be tested on their own.

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Same rule the publisher uses to name website files (createWebFilename). */
export function slugStem(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Words that only say which export a file came from ("FullRes-…", "Web_…").
const SIZE_WORDS = new Set(["full", "fullres", "res", "web", "webres", "hi", "hires", "high", "low", "lowres", "small", "large"]);

/** A name with the export-size words taken out, so a Full and a Web file of the same photo agree. */
export function photoKey(stem: string) {
  return stem.split("-").filter((part) => part && !SIZE_WORDS.has(part)).join("-");
}

/** The website file name without its "hero-" / "07-" start and ".webp" end. */
export function websiteStem(websiteFilename: string) {
  return websiteFilename
    .replace(/\.[^.]+$/, "")
    .replace(/^(hero|\d{1,3})-/, "");
}

/** Last run of digits in a name (the frame number), if any. */
export function frameNumber(stem: string) {
  const match = stem.match(/(\d+)(?!.*\d)/);
  return match ? String(Number(match[1])) : null;
}

export type StorageFile = { name: string; path: string; objectKey: string; sizeBytes: number };
export type Kind = "full" | "web";

/** Which export a file is in, from its folder names ("Full", "Full Res", "Web New"…). */
export function fileKind(path: string): Kind | null {
  const folders = path.split("/").slice(0, -1).map((part) => part.toLowerCase());
  for (let index = folders.length - 1; index >= 0; index -= 1) {
    const words = folders[index].split(/[^a-z0-9]+/).filter(Boolean);
    if (words.some((word) => word === "full" || word === "fullres" || word === "hires")) return "full";
    if (words.some((word) => word === "web" || word === "webres" || word === "lowres")) return "web";
  }
  const name = (path.split("/").pop() || "").toLowerCase();
  if (/^(full|fullres|hires)[^a-z]/.test(name)) return "full";
  if (/^(web|webres)[^a-z]/.test(name)) return "web";
  return null;
}

function words(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[’']/g, "").split(/[^a-z0-9]+/).filter((word) => word.length > 1);
}

const COMMON = new Set(["the", "and", "of", "a", "in", "company", "cast", "rehearsal", "dress"]);

/** How well a Storage folder name fits the production (higher is better; 0 = no fit). */
export function scoreShowFolder(folderName: string, show: { title: string; month?: number | null; year: number }) {
  const folderWords = new Set(words(folderName));
  const titleWords = words(show.title).filter((word) => !COMMON.has(word));
  if (!titleWords.length) return 0;
  const hits = titleWords.filter((word) => folderWords.has(word)).length;
  if (!hits) return 0;
  let score = hits / titleWords.length;
  if (folderWords.has(String(show.year))) score += 0.5;
  else if ([...folderWords].some((word) => /^(19|20)\d\d$/.test(word))) score -= 0.5;
  const month = show.month ? MONTHS[show.month - 1] : null;
  if (month && (folderWords.has(month) || folderWords.has(month.slice(0, 3)))) score += 0.25;
  return score;
}

export type PhotoMatch = { full?: StorageFile; web?: StorageFile };

/**
 * Pairs each website photo with its Full and Web file. Exact name match
 * first (ignoring size words); otherwise the frame number, but only when
 * exactly one file of that kind has it, so nothing is guessed.
 */
export function matchPhotos(websiteFilenames: string[], files: StorageFile[], titleHint = "") {
  const images = files.filter((file) => /\.(jpe?g|tiff?|png|heic)$/i.test(file.name) && !file.name.startsWith("."));
  const hintWords = new Set(words(titleHint));
  const closeness = (file: StorageFile) => words(file.path).filter((word) => hintWords.has(word)).length;

  const byKey: Record<Kind, Map<string, StorageFile[]>> = { full: new Map(), web: new Map() };
  const byFrame: Record<Kind, Map<string, StorageFile[]>> = { full: new Map(), web: new Map() };
  for (const file of images) {
    const kind = fileKind(file.path);
    if (!kind) continue;
    const stem = slugStem(file.name);
    const key = photoKey(stem);
    byKey[kind].set(key, [...(byKey[kind].get(key) || []), file]);
    const frame = frameNumber(stem);
    if (frame) byFrame[kind].set(frame, [...(byFrame[kind].get(frame) || []), file]);
  }

  const pick = (list: StorageFile[] | undefined) => {
    if (!list?.length) return undefined;
    if (list.length === 1) return list[0];
    // Same photo name in two places (e.g. both casts): take the folder nearer the title.
    const sorted = [...list].sort((a, b) => closeness(b) - closeness(a));
    return closeness(sorted[0]) > closeness(sorted[1]) ? sorted[0] : undefined;
  };

  return websiteFilenames.map((websiteFilename): PhotoMatch => {
    const stem = websiteStem(websiteFilename);
    const key = photoKey(stem);
    const frame = frameNumber(stem);
    const result: PhotoMatch = {};
    for (const kind of ["full", "web"] as const) {
      const found = pick(byKey[kind].get(key)) ?? (frame ? pick(byFrame[kind].get(frame)) : undefined);
      if (found) result[kind] = found;
    }
    return result;
  });
}
