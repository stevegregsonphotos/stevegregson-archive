import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { attachmentDisposition } from "@/lib/transfers/disposition";

function env(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

function config() {
  const endpoint = env("CLIENT_ARCHIVE_STORAGE_ENDPOINT", "TRANSFER_STORAGE_ENDPOINT");
  const accessKeyId = env("CLIENT_ARCHIVE_STORAGE_ACCESS_KEY_ID", "TRANSFER_STORAGE_ACCESS_KEY_ID");
  const secretAccessKey = env("CLIENT_ARCHIVE_STORAGE_SECRET_ACCESS_KEY", "TRANSFER_STORAGE_SECRET_ACCESS_KEY");
  const bucketName = env("CLIENT_ARCHIVE_STORAGE_BUCKET_NAME", "TRANSFER_STORAGE_BUCKET_NAME");
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error("Client archive storage is not configured.");
  }
  return { endpoint, accessKeyId, secretAccessKey, bucketName };
}

function client() {
  const c = config();
  return new S3Client({
    endpoint: c.endpoint,
    region: env("CLIENT_ARCHIVE_STORAGE_REGION", "TRANSFER_STORAGE_REGION") || "eu-central-003",
    forcePathStyle: env("CLIENT_ARCHIVE_STORAGE_FORCE_PATH_STYLE", "TRANSFER_STORAGE_FORCE_PATH_STYLE") === "true",
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
}

function ns() {
  return process.env.VERCEL_ENV === "production" ? "client-archive" : "client-archive-preview";
}

/** Deleted items live here until restored or cleared; hidden from browsing and search. */
export const TRASH_FOLDER = ".trash";

/** Steve can't create or upload into the hidden Deleted Files area. */
function assertNotTrash(path: string) {
  if (cleanPath(path).split("/")[0] === TRASH_FOLDER) throw new Error("That name is reserved.");
}

export function archiveKeyFor(path: string) {
  return getClientArchiveKey(path);
}

export function archivePathFor(objectKey: string) {
  if (!isClientArchiveKey(objectKey)) throw new Error("Invalid archive object.");
  return objectKey.slice((ns() + "/").length);
}

function cleanPath(value: string) {
  const parts = value.replace(/\\/g, "/").split("/").map((part) => part.trim()).filter(Boolean);
  if (parts.some((part) => part === "." || part === ".." || /[\u0000-\u001f]/.test(part))) throw new Error("Invalid archive path.");
  return parts.join("/");
}

export function isClientArchiveKey(key: string) {
  return key.startsWith(ns() + "/");
}

export function getClientArchiveKey(path: string) {
  const clean = cleanPath(path);
  if (!clean) throw new Error("A file path is required.");
  return ns() + "/" + clean;
}

export async function listClientArchive(path = "", cursor?: string) {
  const clean = cleanPath(path);
  const prefix = ns() + "/" + (clean ? clean + "/" : "");
  const page = await client().send(new ListObjectsV2Command({
    Bucket: config().bucketName,
    Prefix: prefix,
    Delimiter: "/",
    MaxKeys: 200,
    ContinuationToken: cursor || undefined,
  }));
  const folders = (page.CommonPrefixes || []).flatMap((item) => {
    if (!item.Prefix) return [];
    const relative = item.Prefix.slice((ns() + "/").length).replace(/\/$/, "");
    if (relative === TRASH_FOLDER) return [];
    return [{ name: relative.split("/").pop() || relative, path: relative }];
  });
  const files = (page.Contents || []).flatMap((item) => {
    if (!item.Key || item.Key === prefix) return [];
    const relative = item.Key.slice((ns() + "/").length);
    const name = relative.split("/").pop() || relative;
    if (name === ".folder") return [];
    return [{
      name,
      path: relative,
      objectKey: item.Key,
      sizeBytes: Number(item.Size) || 0,
      lastModified: item.LastModified?.toISOString(),
      isImage: /\.(jpe?g|png|webp|gif|tiff?|heic)$/i.test(name),
    }];
  });
  return { path: clean, folders, files, nextCursor: page.NextContinuationToken, truncated: Boolean(page.IsTruncated) };
}

export async function createClientArchiveFolder(path: string) {
  assertNotTrash(path);
  const clean = cleanPath(path);
  if (!clean) throw new Error("A folder name is required.");
  const key = ns() + "/" + clean + "/.folder";
  await client().send(new PutObjectCommand({
    Bucket: config().bucketName,
    Key: key,
    Body: "",
    ContentType: "application/x-directory",
  }));
}

export async function createClientArchiveUploadUrl(path: string) {
  assertNotTrash(path);
  const objectKey = getClientArchiveKey(path);
  return {
    objectKey,
    uploadUrl: await getSignedUrl(
      client(),
      new PutObjectCommand({ Bucket: config().bucketName, Key: objectKey }),
      // Long enough for a big batch; links only exist inside Backstage.
      { expiresIn: 6 * 60 * 60 },
    ),
  };
}

export async function createClientArchiveViewUrl(objectKey: string) {
  if (!isClientArchiveKey(objectKey)) throw new Error("Invalid archive object.");
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: config().bucketName,
      Key: objectKey,
      ResponseCacheControl: "private, no-store",
    }),
    { expiresIn: 900 },
  );
}

export async function createClientArchiveDownloadUrl(objectKey: string, name: string) {
  if (!isClientArchiveKey(objectKey)) throw new Error("Invalid archive object.");
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: config().bucketName,
      Key: objectKey,
      ResponseContentDisposition: attachmentDisposition(name),
      ResponseCacheControl: "private, no-store",
    }),
    { expiresIn: 900 },
  );
}

export async function deleteClientArchiveFile(objectKey: string) {
  if (!isClientArchiveKey(objectKey)) throw new Error("Invalid archive object.");
  await client().send(new DeleteObjectCommand({ Bucket: config().bucketName, Key: objectKey }));
}

function inferContentType(name: string) {
  const ext = name.toLowerCase().split(".").pop() || "";
  const types: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
    gif: "image/gif", tif: "image/tiff", tiff: "image/tiff", heic: "image/heic",
    pdf: "application/pdf", zip: "application/zip", txt: "text/plain", csv: "text/csv",
  };
  return types[ext] || "application/octet-stream";
}

export async function listClientArchiveFilesRecursive(path: string, limit = 5000) {
  const clean = cleanPath(path);
  const prefix = ns() + "/" + (clean ? clean + "/" : "");
  const files: Array<{
    name: string; path: string; objectKey: string; sizeBytes: number; contentType: string;
  }> = [];
  let continuationToken: string | undefined;

  do {
    const page = await client().send(new ListObjectsV2Command({
      Bucket: config().bucketName,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    for (const item of page.Contents || []) {
      if (!item.Key || item.Key === prefix) continue;
      const relative = item.Key.slice((ns() + "/").length);
      const name = relative.split("/").pop() || relative;
      files.push({
        name,
        path: relative,
        objectKey: item.Key,
        sizeBytes: Number(item.Size) || 0,
        contentType: inferContentType(name),
      });
      if (files.length > limit) throw new Error("This folder contains more than " + limit + " files.");
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return files;
}

export async function getClientArchiveFilesByKeys(keys: string[]) {
  if (keys.length > 5000) throw new Error("Too many archive files selected.");
  const unique = [...new Set(keys)];
  const results = [];
  for (const objectKey of unique) {
    if (!isClientArchiveKey(objectKey)) throw new Error("Invalid archive object.");
    const head = await client().send(new HeadObjectCommand({
      Bucket: config().bucketName,
      Key: objectKey,
    }));
    const relative = objectKey.slice((ns() + "/").length);
    const name = relative.split("/").pop() || relative;
    results.push({
      name,
      path: relative,
      objectKey,
      sizeBytes: Number(head.ContentLength) || 0,
      contentType: head.ContentType || inferContentType(name),
    });
  }
  return results;
}

export async function searchClientArchive(query: string, limit = 200) {
  const needle = query.trim().toLowerCase();
  if (!needle) return { folders: [], files: [] };

  const prefix = ns() + "/";
  const folders = new Map<string, { name: string; path: string }>();
  const files: Array<{
    name: string;
    path: string;
    objectKey: string;
    sizeBytes: number;
    lastModified?: string;
    isImage: boolean;
  }> = [];
  let continuationToken: string | undefined;

  do {
    const page = await client().send(new ListObjectsV2Command({
      Bucket: config().bucketName,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));

    for (const item of page.Contents || []) {
      if (!item.Key || item.Key === prefix) continue;
      const relative = item.Key.slice(prefix.length);
      if (relative.startsWith(TRASH_FOLDER + "/")) continue;
      const parts = relative.split("/").filter(Boolean);
      const name = parts[parts.length - 1] || relative;

      for (let index = 0; index < Math.max(0, parts.length - 1); index += 1) {
        const path = parts.slice(0, index + 1).join("/");
        const folderName = parts[index];
        if (folderName.toLowerCase().includes(needle)) {
          folders.set(path, { name: folderName, path });
        }
      }

      if (name !== ".folder" && name.toLowerCase().includes(needle)) {
        files.push({
          name,
          path: relative,
          objectKey: item.Key,
          sizeBytes: Number(item.Size) || 0,
          lastModified: item.LastModified?.toISOString(),
          isImage: /\.(jpe?g|png|webp|gif|tiff?|heic)$/i.test(name),
        });
      }

      if (folders.size + files.length >= limit) {
        continuationToken = undefined;
        break;
      }
    }

    if (folders.size + files.length >= limit) break;
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return {
    folders: [...folders.values()].slice(0, limit),
    files: files.slice(0, Math.max(0, limit - folders.size)),
  };
}

/** Every object under a folder (recursively), for moving or deleting it. */
export async function listArchiveObjectsUnder(path: string, limit = 20000) {
  const clean = cleanPath(path);
  const prefix = ns() + "/" + (clean ? clean + "/" : "");
  const objects: Array<{ key: string; path: string; sizeBytes: number }> = [];
  let continuationToken: string | undefined;
  do {
    const page = await client().send(new ListObjectsV2Command({
      Bucket: config().bucketName,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    for (const item of page.Contents || []) {
      if (!item.Key) continue;
      objects.push({ key: item.Key, path: item.Key.slice((ns() + "/").length), sizeBytes: Number(item.Size) || 0 });
      if (objects.length > limit) throw new Error("This folder holds more than " + limit + " items, which is too many to change in one go.");
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}

/** Size in bytes, or undefined if there's no such file. */
export async function archiveObjectSize(path: string) {
  try {
    const head = await client().send(new HeadObjectCommand({ Bucket: config().bucketName, Key: getClientArchiveKey(path) }));
    return Number(head.ContentLength) || 0;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (status === 404) return undefined;
    throw error;
  }
}

export async function archiveObjectExists(path: string) {
  return (await archiveObjectSize(path)) !== undefined;
}

/** True if anything (file or folder contents) exists at this path. */
export async function archivePathTaken(path: string) {
  const clean = cleanPath(path);
  if (await archiveObjectExists(clean)) return true;
  const page = await client().send(new ListObjectsV2Command({
    Bucket: config().bucketName,
    Prefix: ns() + "/" + clean + "/",
    MaxKeys: 1,
  }));
  return Boolean(page.KeyCount);
}

/** Server-side copy then delete — the file's data never passes through Vercel. */
export async function moveArchiveObject(fromPath: string, toPath: string) {
  const from = getClientArchiveKey(fromPath);
  const to = getClientArchiveKey(toPath);
  if (from === to) return;
  const bucket = config().bucketName;
  const c = client();
  await c.send(new CopyObjectCommand({
    Bucket: bucket,
    Key: to,
    CopySource: encodeURIComponent(bucket + "/" + from).replace(/%2F/g, "/"),
  }));
  await c.send(new DeleteObjectCommand({ Bucket: bucket, Key: from }));
}

/** Deletes up to 1,000 objects per request. */
export async function deleteArchiveObjects(paths: string[]) {
  const bucket = config().bucketName;
  const c = client();
  for (let start = 0; start < paths.length; start += 1000) {
    const chunk = paths.slice(start, start + 1000);
    await c.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: chunk.map((path) => ({ Key: getClientArchiveKey(path) })), Quiet: true },
    }));
  }
}

/** Keeps an (otherwise empty) folder visible after its contents move out. */
export async function ensureArchiveFolderMarker(path: string) {
  const clean = cleanPath(path);
  if (!clean || clean.split("/")[0] === TRASH_FOLDER) return;
  await client().send(new PutObjectCommand({
    Bucket: config().bucketName,
    Key: ns() + "/" + clean + "/.folder",
    Body: "",
    ContentType: "application/x-directory",
  }));
}
