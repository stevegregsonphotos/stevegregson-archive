import "server-only";

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  getSignedUrl,
} from "@aws-sdk/s3-request-presigner";

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";


const STAGING_KEY =
  "__curated-import-staging/current.zip";

/*
 * New folder-based staging.
 *
 * The browser will upload only the authoritative curated
 * files individually. No browser-created ZIP is required.
 *
 * The existing ZIP staging code remains below temporarily
 * while the client and API route are migrated.
 */
const DIRECT_STAGING_PREFIX =
  "__curated-import-staging/files/";

const DIRECT_MANIFEST_KEY =
  "__curated-import-staging/current.json";

let directManifestCache:
  | {
      etag: string;
      files: string[];
      expiresAt: number;
    }
  | null = null;

const DIRECT_MANIFEST_CACHE_MS =
  60 * 1000;

async function withR2Retry<T>(
  operation: () => Promise<T>,
  context: string,
  attempts = 5,
) {
  let lastError: unknown = null;

  for (
    let attempt = 1;
    attempt <= attempts;
    attempt += 1
  ) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.min(
              4000,
              300 * 2 ** (attempt - 1),
            ),
          ),
        );
      }
    }
  }

  throw new Error(
    `${context} failed after ${attempts} attempts: ${
      lastError instanceof Error
        ? `${lastError.name}: ${lastError.message}`
        : String(lastError)
    }`,
  );
}

const LOCAL_ROOT = path.join(
  os.tmpdir(),
  "stevegregson-curated-import",
  "current",
);

const ETAG_FILE = path.join(
  LOCAL_ROOT,
  ".source-etag",
);

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

function getClient() {
  return new S3Client({
    region: "auto",
    endpoint: requiredEnv(
      "R2_PRODUCTIONS_ENDPOINT",
    ),
    credentials: {
      accessKeyId: requiredEnv(
        "R2_PRODUCTIONS_ACCESS_KEY_ID",
      ),
      secretAccessKey: requiredEnv(
        "R2_PRODUCTIONS_SECRET_ACCESS_KEY",
      ),
    },
  });
}

function getBucket() {
  return requiredEnv(
    "R2_PRODUCTIONS_BUCKET_NAME",
  );
}

async function clearLocalCache() {
  await fs.rm(
    LOCAL_ROOT,
    {
      recursive: true,
      force: true,
    },
  );
}

function safeZipPath(value: string) {
  const normalised = value
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");

  if (
    !normalised ||
    normalised.startsWith("/") ||
    normalised.includes("\0")
  ) {
    throw new Error(
      "Curated archive contains an unsafe path.",
    );
  }

  const parts =
    normalised.split("/");

  if (
    parts.some(
      (part) =>
        !part ||
        part === "." ||
        part === "..",
    )
  ) {
    throw new Error(
      "Curated archive contains an unsafe path.",
    );
  }

  return parts;
}

function safeCuratedRelativePath(
  value: string,
) {
  return safeZipPath(
    value,
  ).join("/");
}

async function listDirectStagingKeys() {
  const client =
    getClient();

  const bucket =
    getBucket();

  const keys: string[] = [];

  let continuationToken:
    | string
    | undefined;

  do {
    const response =
      await withR2Retry(
        () =>
          client.send(
            new ListObjectsV2Command({
              Bucket: bucket,
              Prefix:
                DIRECT_STAGING_PREFIX,
              ContinuationToken:
                continuationToken,
            }),
          ),
        "Listing curated staging objects",
      );

    for (
      const object
      of response.Contents ?? []
    ) {
      if (object.Key) {
        keys.push(
          object.Key,
        );
      }
    }

    continuationToken =
      response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
  } while (continuationToken);

  return keys;
}

async function deleteDirectStagingFiles() {
  const client =
    getClient();

  const bucket =
    getBucket();

  const keys =
    await listDirectStagingKeys();

  for (
    let index = 0;
    index < keys.length;
    index += 1000
  ) {
    const batch =
      keys.slice(
        index,
        index + 1000,
      );

    if (
      batch.length === 0
    ) {
      continue;
    }

    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects:
            batch.map(
              (Key) => ({
                Key,
              }),
            ),
          Quiet: true,
        },
      }),
    );
  }

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key:
        DIRECT_MANIFEST_KEY,
    }),
  );
}

export async function beginCuratedImportFileStaging() {
  /*
   * Direct-file staging is intentionally additive.
   * Beginning a new folder upload must preserve every
   * production already waiting in the curator pipeline.
   * Exact object keys from the new upload may be replaced,
   * but unrelated staged folders and the current manifest
   * remain intact until finalize merges the new file set.
   */

  /*
   * Remove only the legacy ZIP marker. Once a direct-file
   * import starts, preflight must not accidentally read
   * an older ZIP package.
   */
  await getClient().send(
    new DeleteObjectCommand({
      Bucket:
        getBucket(),
      Key:
        STAGING_KEY,
    }),
  );

  await clearLocalCache();
}

export async function createCuratedImportUploadUrl(
  relativePath: string,
  contentType:
    | string
    | undefined,
) {
  const safePath =
    safeCuratedRelativePath(
      relativePath,
    );

  const command =
    new PutObjectCommand({
      Bucket:
        getBucket(),
      Key:
        `${DIRECT_STAGING_PREFIX}${safePath}`,
      ContentType:
        contentType ||
        "application/octet-stream",
      CacheControl:
        "no-store",
    });

  const url =
    await getSignedUrl(
      getClient(),
      command,
      {
        expiresIn: 15 * 60,
      },
    );

  return {
    url,
    path: safePath,
  };
}

export async function curatedImportFileExists(
  relativePath: string,
) {
  const safePath =
    safeCuratedRelativePath(
      relativePath,
    );

  try {
    await getClient().send(
      new HeadObjectCommand({
        Bucket: getBucket(),
        Key:
          `${DIRECT_STAGING_PREFIX}${safePath}`,
      }),
    );
    return true;
  } catch (error) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "$metadata" in error
        ? (error as {
            $metadata?: {
              httpStatusCode?: number;
            };
          }).$metadata?.httpStatusCode
        : undefined;

    if (status === 404) {
      return false;
    }

    throw error;
  }
}

export async function createCuratedImportDownloadUrl(
  relativePath: string,
  contentType = "application/octet-stream",
) {
  const safePath =
    safeCuratedRelativePath(
      relativePath,
    );

  return getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: getBucket(),
      Key:
        `${DIRECT_STAGING_PREFIX}${safePath}`,
      ResponseContentType:
        contentType,
    }),
    { expiresIn: 15 * 60 },
  );
}

export async function putCuratedImportFile(
  relativePath: string,
  body: Buffer,
  contentType:
    | string
    | undefined,
) {
  const safePath =
    safeCuratedRelativePath(
      relativePath,
    );

  await getClient().send(
    new PutObjectCommand({
      Bucket:
        getBucket(),
      Key:
        `${DIRECT_STAGING_PREFIX}${safePath}`,
      Body: body,
      ContentType:
        contentType ||
        "application/octet-stream",
      CacheControl:
        "no-store",
    }),
  );

  return safePath;
}

export async function finalizeCuratedImportFiles(
  relativePaths: string[],
  mode: "additive" | "replace" =
    "additive",
) {
  const files = [
    ...new Set(
      relativePaths.map(
        (value) =>
          safeCuratedRelativePath(
            value,
          ),
      ),
    ),
  ]
    .filter(
      (relativePath) =>
        !/(^|\/)thumbnail-catalogue\.json$/i.test(
          relativePath,
        ),
    )
    .sort();

  if (
    files.length === 0
  ) {
    throw new Error(
      "No curated files were staged.",
    );
  }

  /*
   * Browser PUT success is already checked before finalize.
   * Do not issue one HeadObject request per staged file here:
   * large curated imports contain thousands of images and that
   * turns finalization into thousands of serial R2 operations,
   * which is exactly the wrong shape for a Vercel control route.
   *
   * Instead, take a paginated R2 inventory (with transient retry)
   * and compare the expected object keys in memory. This verifies
   * the complete upload in O(R2 pages), not O(files) requests.
   */
  let stagedKeys =
    await listDirectStagingKeys();

  let stagedRelativePaths =
    new Set(
      stagedKeys
        .filter((key) =>
          key.startsWith(
            DIRECT_STAGING_PREFIX,
          ),
        )
        .map((key) =>
          key.slice(
            DIRECT_STAGING_PREFIX.length,
          ),
        ),
    );

  let missingFiles =
    files.filter(
      (relativePath) =>
        !stagedRelativePaths.has(
          relativePath,
        ),
    );

  for (
    let attempt = 1;
    missingFiles.length > 0 &&
    attempt < 4;
    attempt += 1
  ) {
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        500 * 2 ** (attempt - 1),
      ),
    );

    stagedKeys =
      await listDirectStagingKeys();

    stagedRelativePaths =
      new Set(
        stagedKeys
          .filter((key) =>
            key.startsWith(
              DIRECT_STAGING_PREFIX,
            ),
          )
          .map((key) =>
            key.slice(
              DIRECT_STAGING_PREFIX.length,
            ),
          ),
      );

    missingFiles =
      files.filter(
        (relativePath) =>
          !stagedRelativePaths.has(
            relativePath,
          ),
      );
  }

  if (missingFiles.length > 0) {
    const preview =
      missingFiles
        .slice(0, 10)
        .join(", ");

    throw new Error(
      `Curated upload is incomplete: ${missingFiles.length} expected staged file${
        missingFiles.length === 1 ? " is" : "s are"
      } missing from R2${preview ? ` (${preview}${missingFiles.length > 10 ? ", …" : ""})` : ""}. The manifest was not committed.`,
    );
  }

  const manifestFiles = files;

  const hasFinalSelection =
    manifestFiles.some(
      (value) =>
        /(^|\/)final-selection\.json$/i.test(
          value,
        ),
    );

  const hasSelectedImage =
    manifestFiles.some(
      (value) =>
        /(^|\/)selected-web-staging\/[^/]+$/i.test(
          value,
        ),
    );

  const hasMetadata =
    manifestFiles.some(
      (value) =>
        /(^|\/)metadata-research\.json$/i.test(
          value,
        ) ||
        /(^|\/)metadata-proposed\.txt$/i.test(
          value,
        ),
    );

  if (
    !hasFinalSelection &&
    !hasMetadata
  ) {
    throw new Error(
      "The staged folder does not contain curated selection or production metadata.",
    );
  }

  if (
    hasFinalSelection &&
    !hasSelectedImage
  ) {
    throw new Error(
      "A final selection was found, but its selected-web-staging images are missing.",
    );
  }

  /*
   * Staging contract:
   *
   * - a single-production upload is additive and replaces only that
   *   production folder;
   * - a collection upload is authoritative and replaces the complete
   *   staged collection;
   * - stale R2 objects are removed after the new upload has been verified;
   * - every manifest path begins at the production-folder level.
   */
  const uploadedFolderNames =
    new Set(
      manifestFiles.map(
        (relativePath) =>
          relativePath.split("/")[0],
      ),
    );

  const existingManifestFiles =
    (
      await getCuratedImportDirectFiles()
    )
      ?.filter(
        (relativePath) =>
          !/(^|\/)thumbnail-catalogue\.json$/i.test(
            relativePath,
          ),
      ) ?? [];

  const preservedManifestFiles =
    mode === "replace"
      ? []
      : existingManifestFiles.filter(
          (relativePath) =>
            !uploadedFolderNames.has(
              relativePath.split("/")[0],
            ),
        );

  const currentUploadSet =
    new Set(manifestFiles);

  const staleKeys =
    stagedKeys
      .filter((key) => {
        if (
          !key.startsWith(
            DIRECT_STAGING_PREFIX,
          )
        ) {
          return false;
        }

        const relativePath =
          key.slice(
            DIRECT_STAGING_PREFIX.length,
          );

        const folderName =
          relativePath.split("/")[0];

        return (
          (
            mode === "replace" ||
            uploadedFolderNames.has(
              folderName,
            )
          ) &&
          !currentUploadSet.has(
            relativePath,
          )
        );
      });

  if (staleKeys.length > 0) {
    const client = getClient();
    const bucket = getBucket();

    for (
      let index = 0;
      index < staleKeys.length;
      index += 1000
    ) {
      const batch =
        staleKeys.slice(
          index,
          index + 1000,
        );

      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects:
              batch.map(
                (Key) => ({
                  Key,
                }),
              ),
            Quiet: true,
          },
        }),
      );
    }
  }

  const combinedManifestFiles =
    [
      ...new Set([
        ...preservedManifestFiles,
        ...manifestFiles,
      ]),
    ].sort();

  const manifest = {
    version: 1,
    generatedAt:
      new Date().toISOString(),
    files: combinedManifestFiles,
  };

  await withR2Retry(
    () =>
      getClient().send(
        new PutObjectCommand({
          Bucket:
            getBucket(),
          Key:
            DIRECT_MANIFEST_KEY,
          Body:
            JSON.stringify(
              manifest,
              null,
              2,
            ) + "\n",
          ContentType:
            "application/json",
          CacheControl:
            "no-store",
        }),
      ),
    "Writing curated staging manifest",
  );

  directManifestCache = null;
  await clearLocalCache();

  return manifest;
}

export async function deleteCuratedImportArchive() {
  /*
   * Clear both staging formats while the legacy ZIP
   * fallback still exists.
   */
  await deleteDirectStagingFiles();
  directManifestCache = null;

  await getClient().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: STAGING_KEY,
    }),
  );

  await clearLocalCache();
}

async function getDirectManifestEtag() {
  try {
    const response =
      await getClient().send(
        new HeadObjectCommand({
          Bucket: getBucket(),
          Key:
            DIRECT_MANIFEST_KEY,
        }),
      );

    return response.ETag ?? "present";
  } catch (error) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "$metadata" in error
        ? (error as {
            $metadata?: {
              httpStatusCode?: number;
            };
          }).$metadata?.httpStatusCode
        : undefined;

    if (status === 404) {
      return null;
    }

    throw error;
  }
}

async function readDirectManifest() {
  const response =
    await getClient().send(
      new GetObjectCommand({
        Bucket:
          getBucket(),
        Key:
          DIRECT_MANIFEST_KEY,
      }),
    );

  if (!response.Body) {
    throw new Error(
      "The curated direct-file manifest has no body.",
    );
  }

  const parsed =
    JSON.parse(
      Buffer.from(
        await response.Body.transformToByteArray(),
      ).toString("utf8"),
    ) as {
      version?: unknown;
      files?: unknown;
    };

  if (
    parsed.version !== 1 ||
    !Array.isArray(parsed.files)
  ) {
    throw new Error(
      "The curated direct-file manifest is invalid.",
    );
  }

  const files =
    parsed.files
      .filter(
        (
          value,
        ): value is string =>
          typeof value ===
          "string" &&
          Boolean(
            value.trim(),
          ),
      )
      .map(
        (value) =>
          safeCuratedRelativePath(
            value,
          ),
      );

  if (
    files.length === 0
  ) {
    throw new Error(
      "The curated direct-file manifest contains no files.",
    );
  }

  return files;
}

export async function getCuratedImportDirectFiles() {
  const etag =
    await getDirectManifestEtag();

  if (!etag) {
    directManifestCache = null;
    return null;
  }

  if (
    directManifestCache &&
    directManifestCache.etag === etag &&
    directManifestCache.expiresAt > Date.now()
  ) {
    return directManifestCache.files;
  }

  const files =
    await readDirectManifest();

  directManifestCache = {
    etag,
    files,
    expiresAt:
      Date.now() + DIRECT_MANIFEST_CACHE_MS,
  };

  return files;
}

export function findCuratedImportFileBySuffix(
  files: string[],
  suffix: string,
) {
  const safeSuffix =
    safeCuratedRelativePath(
      suffix,
    );

  return (
    files.find(
      (relativePath) =>
        relativePath === safeSuffix ||
        relativePath.endsWith(
          `/${safeSuffix}`,
        ),
    ) ?? null
  );
}

export function findCuratedImportStagedImage(
  files: string[],
  folder: string,
  stagedFile: string,
) {
  const safeFolder =
    safeCuratedRelativePath(
      folder,
    );

  const safeFile =
    safeCuratedRelativePath(
      stagedFile,
    );

  const suffix =
    `${safeFolder}/selected-web-staging/${safeFile}`;

  return (
    files.find(
      (relativePath) =>
        relativePath === suffix ||
        relativePath.endsWith(
          `/${suffix}`,
        ),
    ) ?? null
  );
}

export async function readCuratedImportDirectFileRange(
  relativePath: string,
  start = 0,
  end = 65535,
) {
  const safePath =
    safeCuratedRelativePath(
      relativePath,
    );

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start
  ) {
    throw new Error(
      "Invalid curated staged file range.",
    );
  }

  const response =
    await getClient().send(
      new GetObjectCommand({
        Bucket:
          getBucket(),
        Key:
          `${DIRECT_STAGING_PREFIX}${safePath}`,
        Range:
          `bytes=${start}-${end}`,
      }),
    );

  if (!response.Body) {
    throw new Error(
      `Curated staged file "${safePath}" has no body.`,
    );
  }

  return Buffer.from(
    await response.Body.transformToByteArray(),
  );
}

export async function readCuratedImportDirectFile(
  relativePath: string,
) {
  const safePath =
    safeCuratedRelativePath(
      relativePath,
    );

  const response =
    await getClient().send(
      new GetObjectCommand({
        Bucket:
          getBucket(),
        Key:
          `${DIRECT_STAGING_PREFIX}${safePath}`,
      }),
    );

  if (!response.Body) {
    throw new Error(
      `Curated staged file "${safePath}" has no body.`,
    );
  }

  return Buffer.from(
    await response.Body.transformToByteArray(),
  );
}

async function materializeDirectFiles(
  etag: string,
) {
  await clearLocalCache();

  await fs.mkdir(
    LOCAL_ROOT,
    {
      recursive: true,
    },
  );

  const files =
    await readDirectManifest();

  for (const relativePath of files) {
    /*
     * Production photographs remain in R2.
     * Only the small metadata/control files are
     * materialised onto the temporary filesystem.
     */
    if (
      /(^|\/)selected-web-staging\/[^/]+$/i.test(
        relativePath,
      ) ||
      /(^|\/)\.editor-thumbnails\/[^/]+\.webp$/i.test(
        relativePath,
      )
    ) {
      continue;
    }

    const parts =
      safeZipPath(
        relativePath,
      );

    const destination =
      path.resolve(
        LOCAL_ROOT,
        ...parts,
      );

    if (
      destination !== LOCAL_ROOT &&
      !destination.startsWith(
        `${LOCAL_ROOT}${path.sep}`,
      )
    ) {
      throw new Error(
        "Curated staged file resolves outside its local staging root.",
      );
    }

    const response =
      await withR2Retry(
        () =>
          getClient().send(
            new GetObjectCommand({
              Bucket:
                getBucket(),
              Key:
                `${DIRECT_STAGING_PREFIX}${relativePath}`,
            }),
          ),
        `Reading curated staged file "${relativePath}"`,
      );

    if (!response.Body) {
      throw new Error(
        `Curated staged file "${relativePath}" has no body.`,
      );
    }

    await fs.mkdir(
      path.dirname(
        destination,
      ),
      {
        recursive: true,
      },
    );

    await fs.writeFile(
      destination,
      Buffer.from(
        await response.Body.transformToByteArray(),
      ),
    );
  }

  await fs.writeFile(
    ETAG_FILE,
    `${etag}
`,
    "utf8",
  );

  return LOCAL_ROOT;
}

async function cachedEtag() {
  try {
    return (
      await fs.readFile(
        ETAG_FILE,
        "utf8",
      )
    ).trim();
  } catch {
    return null;
  }
}

async function resolveCuratedImportRoot() {
  let entries:
    import("node:fs").Dirent[];

  try {
    entries =
      await fs.readdir(
        LOCAL_ROOT,
        {
          withFileTypes: true,
        },
      );
  } catch {
    return LOCAL_ROOT;
  }

  const directories =
    entries.filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith("."),
    );

  if (directories.length !== 1) {
    return LOCAL_ROOT;
  }

  const candidate =
    path.join(
      LOCAL_ROOT,
      directories[0].name,
    );

  try {
    const stat =
      await fs.stat(
        path.join(
          candidate,
          "final-selection.json",
        ),
      );

    if (stat.isFile()) {
      return LOCAL_ROOT;
    }
  } catch {}

  let children:
    import("node:fs").Dirent[];

  try {
    children =
      await fs.readdir(
        candidate,
        {
          withFileTypes: true,
        },
      );
  } catch {
    return LOCAL_ROOT;
  }

  for (const child of children) {
    if (!child.isDirectory()) {
      continue;
    }

    try {
      const stat =
        await fs.stat(
          path.join(
            candidate,
            child.name,
            "final-selection.json",
          ),
        );

      if (stat.isFile()) {
        return candidate;
      }
    } catch {}
  }

  return LOCAL_ROOT;
}

export async function materializeCuratedImport() {
  const directEtag =
    await getDirectManifestEtag();

  if (!directEtag) {
    await clearLocalCache();
    return null;
  }

  const cacheTag =
    `direct:${directEtag}`;

  if (
    (await cachedEtag()) !==
    cacheTag
  ) {
    await materializeDirectFiles(
      cacheTag,
    );
  }

  return resolveCuratedImportRoot();
}
