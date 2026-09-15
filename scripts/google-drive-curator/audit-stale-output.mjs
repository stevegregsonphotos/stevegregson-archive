import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const WORK_ROOT = path.join(
  os.homedir(),
  "Downloads",
  "Archive Download",
  "Automated Curation - Google Drive",
);

const NORMALISED_GALLERIES_PATH = path.join(
  WORK_ROOT,
  "normalised-galleries.json",
);

const manifest = JSON.parse(
  await fs.readFile(
    NORMALISED_GALLERIES_PATH,
    "utf8",
  ),
);

const validProductions = new Set(
  (Array.isArray(manifest.galleries)
    ? manifest.galleries
    : [])
    .map((gallery) =>
      String(gallery.path ?? "").trim(),
    )
    .filter(Boolean),
);

const entries = await fs.readdir(
  WORK_ROOT,
  { withFileTypes: true },
);

const stale = [];
const current = [];

for (const entry of entries) {
  if (!entry.isDirectory()) {
    continue;
  }

  const finalPath = path.join(
    WORK_ROOT,
    entry.name,
    "final-selection.json",
  );

  try {
    const final = JSON.parse(
      await fs.readFile(finalPath, "utf8"),
    );

    const production =
      typeof final.production === "string"
        ? final.production.trim()
        : "";

    if (!production) {
      continue;
    }

    const item = {
      folder: entry.name,
      production,
      imageCount:
        Array.isArray(final.images)
          ? final.images.length
          : 0,
    };

    if (validProductions.has(production)) {
      current.push(item);
    } else {
      stale.push(item);
    }
  } catch {}
}

stale.sort((a, b) =>
  a.production.localeCompare(b.production),
);

console.log();
console.log("GOOGLE DRIVE STALE OUTPUT AUDIT");
console.log("READ ONLY - NO FILES CHANGED");
console.log("Current galleries:", validProductions.size);
console.log("Current final selections:", current.length);
console.log("Stale final selections:", stale.length);

if (stale.length) {
  console.log();
  console.log("STALE FINAL SELECTIONS:");

  for (const item of stale) {
    console.log(
      `- ${item.production} [${item.folder}] - ${item.imageCount} selected image(s)`,
    );
  }
}
