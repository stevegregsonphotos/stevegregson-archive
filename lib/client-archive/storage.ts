import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

function cleanPath(value: string) {
  const parts = value.replace(/\\/g, "/").split("/").map((part) => part.trim()).filter(Boolean);
  if (parts.some((part) => part === "." || part === "..")) throw new Error("Invalid archive path.");
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
    return [{ name: relative.split("/").pop() || relative, path: relative }];
  });
  const files = (page.Contents || []).flatMap((item) => {
    if (!item.Key || item.Key === prefix) return [];
    const relative = item.Key.slice((ns() + "/").length);
    const name = relative.split("/").pop() || relative;
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

export async function createClientArchiveUploadUrl(path: string) {
  const objectKey = getClientArchiveKey(path);
  return {
    objectKey,
    uploadUrl: await getSignedUrl(
      client(),
      new PutObjectCommand({ Bucket: config().bucketName, Key: objectKey }),
      { expiresIn: 900 },
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
  const filename = name.replace(/[\r\n"]/g, "").trim() || "download";
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: config().bucketName,
      Key: objectKey,
      ResponseContentDisposition: 'attachment; filename="' + filename + '"',
      ResponseCacheControl: "private, no-store",
    }),
    { expiresIn: 900 },
  );
}

export async function deleteClientArchiveFile(objectKey: string) {
  if (!isClientArchiveKey(objectKey)) throw new Error("Invalid archive object.");
  await client().send(new DeleteObjectCommand({ Bucket: config().bucketName, Key: objectKey }));
}
