import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + " is not configured.");
  return value;
}

function getClient() {
  return new S3Client({
    region: "auto",
    endpoint: requiredEnv("R2_ENDPOINT"),
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

function getBucket() {
  return requiredEnv("R2_BUCKET_NAME");
}

function namespace() {
  return process.env.VERCEL_ENV === "production"
    ? "transfers"
    : "transfers-preview";
}

function safeSegment(value: string) {
  const clean = value.trim();
  if (!clean || clean.includes("/") || clean.includes("\\") || clean === "." || clean === "..") {
    throw new Error("Invalid transfer storage segment.");
  }
  return clean.replace(/[\u0000-\u001f]/g, "");
}

export function getTransferObjectKey(transferId: string, fileId: string) {
  return namespace() + "/" + safeSegment(transferId) + "/" + safeSegment(fileId);
}

export async function createTransferUploadUrl(
  transferId: string,
  fileId: string,
  contentType: string,
) {
  const objectKey = getTransferObjectKey(transferId, fileId);
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: objectKey,
    ContentType: contentType || "application/octet-stream",
    CacheControl: "private, no-store",
  });

  return {
    objectKey,
    uploadUrl: await getSignedUrl(getClient(), command, { expiresIn: 60 * 60 }),
  };
}


export async function putTransferObject(
  objectKey: string,
  body: Uint8Array,
  contentType: string,
) {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: objectKey,
      Body: body,
      ContentType: contentType || "application/octet-stream",
      CacheControl: "private, no-store",
    }),
  );
}


export async function beginTransferMultipartUpload(
  objectKey: string,
  contentType: string,
) {
  const response = await getClient().send(
    new CreateMultipartUploadCommand({
      Bucket: getBucket(),
      Key: objectKey,
      ContentType: contentType || "application/octet-stream",
      CacheControl: "private, no-store",
    }),
  );

  if (!response.UploadId) {
    throw new Error("R2 did not return a multipart upload ID.");
  }

  return response.UploadId;
}

export async function uploadTransferMultipartPart(
  objectKey: string,
  uploadId: string,
  partNumber: number,
  body: Uint8Array,
) {
  const response = await getClient().send(
    new UploadPartCommand({
      Bucket: getBucket(),
      Key: objectKey,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: body,
    }),
  );

  if (!response.ETag) {
    throw new Error("R2 did not return an ETag for the uploaded part.");
  }

  return response.ETag;
}

export async function completeTransferMultipartUpload(
  objectKey: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>,
) {
  await getClient().send(
    new CompleteMultipartUploadCommand({
      Bucket: getBucket(),
      Key: objectKey,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((part) => ({
          PartNumber: part.partNumber,
          ETag: part.etag,
        })),
      },
    }),
  );
}

export async function abortTransferMultipartUpload(
  objectKey: string,
  uploadId: string,
) {
  await getClient().send(
    new AbortMultipartUploadCommand({
      Bucket: getBucket(),
      Key: objectKey,
      UploadId: uploadId,
    }),
  );
}

export async function transferObjectExists(objectKey: string) {
  try {
    await getClient().send(new HeadObjectCommand({
      Bucket: getBucket(),
      Key: objectKey,
    }));
    return true;
  } catch (error) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "$metadata" in error
        ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        : undefined;
    if (status === 404) return false;
    throw error;
  }
}

function safeDownloadFilename(value: string) {
  return value.replace(/[\r\n"]/g, "").trim() || "download";
}

export async function createTransferDownloadUrl(
  objectKey: string,
  filename: string,
) {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: objectKey,
    ResponseContentDisposition:
      'attachment; filename="' + safeDownloadFilename(filename) + '"',
    ResponseCacheControl: "private, no-store",
  });
  return getSignedUrl(getClient(), command, { expiresIn: 15 * 60 });
}

export async function deleteTransferObjects(transferId: string) {
  const client = getClient();
  const prefix = namespace() + "/" + safeSegment(transferId) + "/";
  let continuationToken: string | undefined;

  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: getBucket(),
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    const objects = (page.Contents ?? []).flatMap((item) =>
      item.Key ? [{ Key: item.Key }] : [],
    );
    if (objects.length) {
      await client.send(new DeleteObjectsCommand({
        Bucket: getBucket(),
        Delete: { Objects: objects, Quiet: true },
      }));
    }
    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);
}
