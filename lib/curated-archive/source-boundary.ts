export type CuratedSourceBoundaryRoot = {
  id: string;
  path: string;
};

export type CuratedSourceBoundary = {
  version: number;
  galleryPath: string;
  galleryManifestGeneratedAt?: string | null;
  sourceRoots: CuratedSourceBoundaryRoot[];
};

type BoundaryImage = {
  sourcePath?: unknown;
  sourceFolder?: unknown;
  sourceRootId?: unknown;
  sourceRootPath?: unknown;
};

type BoundarySelection = {
  source?: unknown;
  production?: unknown;
  sourceBoundary?: unknown;
  images?: unknown;
};

function normaliseProductionName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[—–−]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normaliseDrivePath(value: string) {
  return value
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
}

function folderIsWithinRoot(folder: string, root: string) {
  const cleanFolder = normaliseDrivePath(folder);
  const cleanRoot = normaliseDrivePath(root);

  return (
    cleanFolder === cleanRoot ||
    cleanFolder.startsWith(`${cleanRoot}/`)
  );
}

function parseBoundary(value: unknown): CuratedSourceBoundary | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const boundary = value as Record<string, unknown>;
  const roots = boundary.sourceRoots;

  if (
    boundary.version !== 1 ||
    typeof boundary.galleryPath !== "string" ||
    !boundary.galleryPath.trim() ||
    !Array.isArray(roots) ||
    roots.length === 0
  ) {
    return null;
  }

  const sourceRoots: CuratedSourceBoundaryRoot[] = [];
  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();

  for (const value of roots) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const root = value as Record<string, unknown>;

    if (
      typeof root.id !== "string" ||
      !root.id.trim() ||
      typeof root.path !== "string" ||
      !root.path.trim()
    ) {
      return null;
    }

    const id = root.id.trim();
    const path = normaliseDrivePath(root.path);

    if (seenIds.has(id) || seenPaths.has(path)) {
      return null;
    }

    seenIds.add(id);
    seenPaths.add(path);
    sourceRoots.push({ id, path });
  }

  return {
    version: 1,
    galleryPath: boundary.galleryPath.trim(),
    galleryManifestGeneratedAt:
      typeof boundary.galleryManifestGeneratedAt === "string"
        ? boundary.galleryManifestGeneratedAt
        : null,
    sourceRoots,
  };
}

export function looksLikeGoogleDriveCuratedSelection(
  finalSelection: BoundarySelection,
) {
  if (
    finalSelection.source === "google-drive" ||
    finalSelection.sourceBoundary !== undefined
  ) {
    return true;
  }

  const images = Array.isArray(finalSelection.images)
    ? (finalSelection.images as BoundaryImage[])
    : [];

  if (images.length === 0) {
    return false;
  }

  if (
    images.some(
      (image) =>
        image?.sourceRootId !== undefined ||
        image?.sourceRootPath !== undefined,
    )
  ) {
    return true;
  }

  const sourcePaths = images
    .map((image) => image?.sourcePath)
    .filter(
      (value): value is string =>
        typeof value === "string" && Boolean(value.trim()),
    );

  /*
   * Dropbox curator source paths are absolute Dropbox paths beginning
   * with '/'. Google Drive curator sourcePath values are Drive file IDs.
   * This lets us fail closed for old Google Drive selections which predate
   * explicit provenance stamping.
   */
  return (
    sourcePaths.length === images.length &&
    sourcePaths.every((value) => !value.trim().startsWith("/"))
  );
}

export function validateCuratedSourceBoundary(
  finalSelection: BoundarySelection,
) {
  const issues: string[] = [];

  if (!looksLikeGoogleDriveCuratedSelection(finalSelection)) {
    return issues;
  }

  if (finalSelection.source !== "google-drive") {
    issues.push(
      "Google Drive source-boundary provenance is missing. Run the local boundary audit/stamp before importing this production.",
    );
    return issues;
  }

  const boundary = parseBoundary(finalSelection.sourceBoundary);

  if (!boundary) {
    issues.push(
      "Google Drive source-boundary provenance is invalid or incomplete.",
    );
    return issues;
  }

  if (
    typeof finalSelection.production !== "string" ||
    normaliseProductionName(finalSelection.production) !==
      normaliseProductionName(boundary.galleryPath)
  ) {
    issues.push(
      "Google Drive production identity does not match its verified source boundary.",
    );
  }

  const rootsById = new Map(
    boundary.sourceRoots.map((root) => [root.id, root]),
  );

  const images = Array.isArray(finalSelection.images)
    ? (finalSelection.images as BoundaryImage[])
    : [];

  let foreignImages = 0;
  let incompleteImages = 0;

  for (const image of images) {
    if (!image || typeof image !== "object") {
      incompleteImages += 1;
      continue;
    }

    const sourceRootId =
      typeof image.sourceRootId === "string"
        ? image.sourceRootId.trim()
        : "";
    const sourceRootPath =
      typeof image.sourceRootPath === "string"
        ? normaliseDrivePath(image.sourceRootPath)
        : "";
    const sourceFolder =
      typeof image.sourceFolder === "string"
        ? normaliseDrivePath(image.sourceFolder)
        : "";

    if (!sourceRootId || !sourceRootPath || !sourceFolder) {
      incompleteImages += 1;
      continue;
    }

    const root = rootsById.get(sourceRootId);

    if (
      !root ||
      normaliseDrivePath(root.path) !== sourceRootPath ||
      !folderIsWithinRoot(sourceFolder, root.path)
    ) {
      foreignImages += 1;
    }
  }

  if (incompleteImages > 0) {
    issues.push(
      `${incompleteImages} Google Drive selected image${incompleteImages === 1 ? " is" : "s are"} missing verified source-boundary provenance.`,
    );
  }

  if (foreignImages > 0) {
    issues.push(
      `${foreignImages} Google Drive selected image${foreignImages === 1 ? " falls" : "s fall"} outside the verified production source boundary. Publishing is blocked.`,
    );
  }

  return issues;
}
