import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const APPLY = process.argv.includes("--stamp");

const ROOT = path.join(
  os.homedir(),
  "Downloads",
  "Archive Download",
  "Automated Curation - Google Drive",
);

const GALLERIES_PATH = path.join(
  ROOT,
  "normalised-galleries.json",
);

function normaliseProductionName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[—–−]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function cleanPath(value) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
}

function safeName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function commonPathAncestor(paths) {
  const split = paths
    .map(cleanPath)
    .filter(Boolean)
    .map((value) => value.split("/"));

  if (!split.length) return "";

  const common = [];
  const shortest = Math.min(...split.map((parts) => parts.length));

  for (let index = 0; index < shortest; index += 1) {
    const part = split[0][index];
    if (split.every((parts) => parts[index] === part)) {
      common.push(part);
    } else {
      break;
    }
  }

  return common.join("/");
}

function sourceRootsForGallery(gallery) {
  const sourcePaths = (gallery.sources ?? [])
    .map((source) => source?.path)
    .filter((value) => typeof value === "string" && value.trim());

  const boundaryPath = commonPathAncestor(sourcePaths) || cleanPath(gallery.path);

  return boundaryPath
    ? [{ id: `path:${boundaryPath}`, path: boundaryPath }]
    : [];
}

function rootForFolder(folder, roots) {
  const cleanFolder = cleanPath(folder);

  return [...roots]
    .sort((a, b) => b.path.length - a.path.length)
    .find(
      (root) =>
        cleanFolder === root.path ||
        cleanFolder.startsWith(`${root.path}/`),
    ) ?? null;
}

const manifest = JSON.parse(
  await fs.readFile(GALLERIES_PATH, "utf8"),
);

const galleries = Array.isArray(manifest.galleries)
  ? manifest.galleries
  : [];

const galleryByName = new Map(
  galleries.map((gallery) => [
    normaliseProductionName(gallery.path),
    gallery,
  ]),
);

const entries = await fs.readdir(ROOT, { withFileTypes: true });
const reports = [];
let stamped = 0;

for (const entry of entries) {
  if (!entry.isDirectory()) continue;

  const folder = path.join(ROOT, entry.name);
  const finalPath = path.join(folder, "final-selection.json");
  const discoveryPath = path.join(folder, "discovery.json");

  let finalSelection;
  let discovery;

  try {
    finalSelection = JSON.parse(await fs.readFile(finalPath, "utf8"));
  } catch {
    continue;
  }

  const production = String(finalSelection.production ?? "").trim();
  const gallery = galleryByName.get(normaliseProductionName(production));
  const issues = [];

  if (!gallery) {
    reports.push({ folder: entry.name, production, status: "STALE", issues: ["not present in current normalised galleries"] });
    continue;
  }

  try {
    discovery = JSON.parse(await fs.readFile(discoveryPath, "utf8"));
  } catch {
    discovery = null;
  }

  if (
    discovery &&
    normaliseProductionName(discovery.production) !==
      normaliseProductionName(gallery.path)
  ) {
    issues.push("discovery production does not match current gallery");
  }

  if (safeName(gallery.path) !== entry.name) {
    issues.push(`output folder does not match current gallery (${safeName(gallery.path)})`);
  }

  const roots = sourceRootsForGallery(gallery);
  if (!roots.length) {
    issues.push("current gallery has no usable source roots");
  }

  const candidates = discovery && Array.isArray(discovery.candidates)
    ? discovery.candidates
    : [];
  const candidateByIndex = new Map();
  const candidateByPath = new Map();
  let foreignCandidates = 0;

  for (const candidate of candidates) {
    const root = rootForFolder(candidate.sourceFolder, roots);
    if (!root) {
      foreignCandidates += 1;
      continue;
    }

    candidateByIndex.set(candidate.index, { candidate, root });
    if (typeof candidate.path === "string") {
      candidateByPath.set(candidate.path, { candidate, root });
    }
  }

  if (foreignCandidates) {
    issues.push(`${foreignCandidates} discovery candidate(s) fall outside current source roots`);
  }

  const selected = Array.isArray(finalSelection.images)
    ? finalSelection.images
    : [];
  let foreignSelected = 0;
  let missingSelectedProvenance = 0;
  const stampedImages = [];

  for (const image of selected) {
    const finalFolder = cleanPath(image.sourceFolder);
    let root = finalFolder ? rootForFolder(finalFolder, roots) : null;

    const byIndex = candidateByIndex.get(image.index);
    const byPath = typeof image.sourcePath === "string"
      ? candidateByPath.get(image.sourcePath)
      : null;
    const discoveryMatch = byIndex ?? byPath;

    if (!root) {
      if (!finalFolder) {
        missingSelectedProvenance += 1;
      } else {
        foreignSelected += 1;
      }
      stampedImages.push(image);
      continue;
    }

    const sourcePath =
      typeof image.sourcePath === "string" && image.sourcePath
        ? image.sourcePath
        : String(discoveryMatch?.candidate?.path ?? "");
    const sourceFolder =
      finalFolder || cleanPath(discoveryMatch?.candidate?.sourceFolder);

    stampedImages.push({
      ...image,
      sourcePath,
      sourceFolder,
      sourceRootId: root.id,
      sourceRootPath: root.path,
    });
  }

  if (foreignSelected) {
    issues.push(`${foreignSelected} selected image(s) fall outside the current production source roots`);
  }
  if (missingSelectedProvenance) {
    issues.push(`${missingSelectedProvenance} selected image(s) have no source-folder provenance to verify`);
  }
  if (!selected.length) {
    issues.push("final selection contains no selected images");
  }

  const sourceBoundary = {
    version: 1,
    galleryPath: gallery.path,
    galleryManifestGeneratedAt:
      typeof manifest.generatedAt === "string"
        ? manifest.generatedAt
        : null,
    sourceRoots: roots,
  };

  if (APPLY) {
    const stampedDiscovery = discovery
      ? {
          ...discovery,
          source: "google-drive",
          sourceBoundary,
          candidates: candidates.map((candidate) => {
            const root = rootForFolder(candidate.sourceFolder, roots);
            return {
              ...candidate,
              sourceRootId: root.id,
              sourceRootPath: root.path,
            };
          }),
        }
      : null;

    const stampedFinal = {
      ...finalSelection,
      source: "google-drive",
      sourceBoundary,
      images: stampedImages,
      boundaryVerification: {
        version: 1,
        verifiedAt: new Date().toISOString(),
        selectedCount: stampedImages.length,
        foreignSelectedCount: 0,
      },
    };

    if (stampedDiscovery) {
      await fs.writeFile(
        discoveryPath,
        JSON.stringify(stampedDiscovery, null, 2) + "\n",
        "utf8",
      );
    }
    await fs.writeFile(
      finalPath,
      JSON.stringify(stampedFinal, null, 2) + "\n",
      "utf8",
    );
    stamped += 1;
  }

  reports.push({ folder: entry.name, production, status: "PASS", issues: [] });
}

const passed = reports.filter((item) => item.status === "PASS");
const failed = reports.filter((item) => item.status === "FAIL");
const stale = reports.filter((item) => item.status === "STALE");

console.log("=".repeat(96));
console.log("GOOGLE DRIVE SELECTED-IMAGE SOURCE BOUNDARY AUDIT");
console.log("=".repeat(96));
console.log(APPLY ? "MODE: VERIFY + STAMP" : "MODE: READ ONLY");
console.log(`Current galleries: ${galleries.length}`);
console.log(`Final selections inspected: ${reports.length}`);
console.log(`PASS: ${passed.length}`);
console.log(`FAIL: ${failed.length}`);
console.log(`STALE: ${stale.length}`);
if (APPLY) console.log(`Stamped: ${stamped}`);
console.log();

for (const item of [...failed, ...stale]) {
  console.log(`${item.status}: ${item.production || item.folder} [${item.folder}]`);
  for (const issue of item.issues) console.log(`  - ${issue}`);
}

if (!failed.length && !stale.length) {
  console.log("ALL ACTIVE FINAL SELECTIONS ARE WITHIN THEIR CURRENT GOOGLE DRIVE PRODUCTION BOUNDARIES.");
}

if (!APPLY) {
  console.log();
  console.log("No files changed. Re-run with --stamp only after PASS/STALE results are understood.");
}

if (failed.length > 0 || stale.length > 0) {
  process.exitCode = 2;
}
