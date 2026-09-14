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

import JSZip from "jszip";

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
      await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix:
            DIRECT_STAGING_PREFIX,
          ContinuationToken:
            continuationToken,
        }),
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
  await deleteDirectStagingFiles();

  /*
   * Remove the old ZIP marker too. Once a direct-file
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
  ].sort();

  if (
    files.length === 0
  ) {
    throw new Error(
      "No curated files were staged.",
    );
  }

  const stagedKeys =
    new Set(
      await listDirectStagingKeys(),
    );

  const manifestFiles =
    files.filter(
      (relativePath) => {
        const expectedKey =
          `${DIRECT_STAGING_PREFIX}${relativePath}`;

        if (stagedKeys.has(expectedKey)) {
          return true;
        }

        if (
          /(^|\/)thumbnail-catalogue\.json$/i.test(
            relativePath,
          )
        ) {
          return false;
        }

        throw new Error(
          `Curated staged file "${relativePath}" is missing from R2.`,
        );
      },
    );

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

  const manifest = {
    version: 1,
    generatedAt:
      new Date().toISOString(),
    files: manifestFiles,
  };

  await getClient().send(
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
  );

  await clearLocalCache();

  return manifest;
}

export async function putCuratedImportArchive(
  archive: Buffer,
) {
  let client: S3Client;

  try {
    client = getClient();
  } catch (error) {
    throw new Error(
      `Could not initialise curated-import R2 client: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );
  }

  let bucket: string;

  try {
    bucket = getBucket();
  } catch (error) {
    throw new Error(
      `Could not resolve curated-import R2 bucket: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );
  }

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: STAGING_KEY,
        Body: archive,
        ContentType: "application/zip",
        CacheControl: "no-store",
      }),
    );
  } catch (error) {
    throw new Error(
      `Could not upload curated package to R2: ${
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error)
      }`,
    );
  }

  await clearLocalCache();
}

export async function deleteCuratedImportArchive() {
  /*
   * Clear both staging formats while the legacy ZIP
   * fallback still exists.
   */
  await deleteDirectStagingFiles();

  await getClient().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: STAGING_KEY,
    }),
  );

  await clearLocalCache();
}

async function getCurrentEtag() {
  try {
    const response =
      await getClient().send(
        new HeadObjectCommand({
          Bucket: getBucket(),
          Key: STAGING_KEY,
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
    return null;
  }

  return readDirectManifest();
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
      await getClient()
        .send(
          new GetObjectCommand({
            Bucket:
              getBucket(),
            Key:
              `${DIRECT_STAGING_PREFIX}${relativePath}`,
          }),
        )
        .catch((error: unknown) => {
          throw new Error(
            `Could not read curated staged file "${relativePath}" from R2: ${
              error instanceof Error
                ? `${error.name}: ${error.message}`
                : String(error)
            }`,
          );
        });

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

async function downloadArchive() {
  const response =
    await getClient().send(
      new GetObjectCommand({
        Bucket: getBucket(),
        Key: STAGING_KEY,
      }),
    );

  if (!response.Body) {
    throw new Error(
      "The staged curated archive has no body.",
    );
  }

  return Buffer.from(
    await response.Body.transformToByteArray(),
  );
}

async function extractArchive(
  archive: Buffer,
  etag: string,
) {
  await clearLocalCache();
  await fs.mkdir(
    LOCAL_ROOT,
    {
      recursive: true,
    },
  );

  const zip =
    await JSZip.loadAsync(archive);

  for (const entry of Object.values(zip.files)) {
    if (
      entry.name.startsWith("__MACOSX/") ||
      entry.name
        .split("/")
        .some((part) => part.startsWith("."))
    ) {
      continue;
    }

    const parts = safeZipPath(entry.name);
    const destination = path.resolve(
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
        "Curated archive contains a path outside its staging root.",
      );
    }

    if (entry.dir) {
      await fs.mkdir(
        destination,
        {
          recursive: true,
        },
      );
      continue;
    }

    await fs.mkdir(
      path.dirname(destination),
      {
        recursive: true,
      },
    );

    await fs.writeFile(
      destination,
      await entry.async("nodebuffer"),
    );
  }

  await fs.writeFile(
    ETAG_FILE,
    `${etag}\n`,
    "utf8",
  );

  return LOCAL_ROOT;
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
  /*
   * Prefer the new direct-file staging format.
   */
  const directEtag =
    await getDirectManifestEtag();

  if (directEtag) {
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

  /*
   * Temporary backward-compatible ZIP fallback.
   */
  const etag =
    await getCurrentEtag();

  if (!etag) {
    await clearLocalCache();
    return null;
  }

  const cacheTag =
    `zip:${etag}`;

  if (
    (await cachedEtag()) ===
    cacheTag
  ) {
    return resolveCuratedImportRoot();
  }

  await extractArchive(
    await downloadArchive(),
    cacheTag,
  );

  return resolveCuratedImportRoot();
}
