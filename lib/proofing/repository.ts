import fs from "node:fs";
import path from "node:path";

import type { ProofingGallery } from "./types";

const proofingDirectory = path.join(
  process.cwd(),
  "data",
  "proofing",
);

function ensureProofingDirectory() {
  if (!fs.existsSync(proofingDirectory)) {
    fs.mkdirSync(proofingDirectory, {
      recursive: true,
    });
  }
}

function galleryFilePath(id: string) {
  return path.join(
    proofingDirectory,
    `${id}.json`,
  );
}

export function getProofingGalleries(): ProofingGallery[] {
  ensureProofingDirectory();

  const filenames = fs
    .readdirSync(proofingDirectory)
    .filter((filename) => filename.endsWith(".json"));

  const galleries = filenames.map((filename) => {
    const filePath = path.join(
      proofingDirectory,
      filename,
    );

    const contents = fs.readFileSync(
      filePath,
      "utf8",
    );

    return JSON.parse(contents) as ProofingGallery;
  });

  return galleries.sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt),
  );
}

export function getProofingGallery(
  id: string,
): ProofingGallery | undefined {
  ensureProofingDirectory();

  const filePath = galleryFilePath(id);

  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const contents = fs.readFileSync(
    filePath,
    "utf8",
  );

  return JSON.parse(contents) as ProofingGallery;
}

export function getProofingGalleryBySlug(
  slug: string,
): ProofingGallery | undefined {
  const normalisedSlug = decodeURIComponent(slug)
    .trim()
    .toLowerCase();

  return getProofingGalleries().find(
    (gallery) =>
      gallery.slug.trim().toLowerCase() ===
      normalisedSlug,
  );
}

export function saveProofingGallery(
  gallery: ProofingGallery,
) {
  ensureProofingDirectory();

  fs.writeFileSync(
    galleryFilePath(gallery.id),
    JSON.stringify(gallery, null, 2),
    "utf8",
  );
}

export function updateProofingGallery(
  id: string,
  updater: (
    gallery: ProofingGallery,
  ) => ProofingGallery,
): ProofingGallery | undefined {
  const gallery = getProofingGallery(id);

  if (!gallery) {
    return undefined;
  }

  const updatedGallery = updater(gallery);

  updatedGallery.updatedAt =
    new Date().toISOString();

  saveProofingGallery(updatedGallery);

  return updatedGallery;
}