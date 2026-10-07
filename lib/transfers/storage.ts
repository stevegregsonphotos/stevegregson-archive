import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type TransferStorageConfig = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
};

function firstEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

export function getTransferStorageConfiguration() {
  const endpoint = firstEnv(
    "TRANSFER_STORAGE_ENDPOINT",
    "TRANSFER_R2_ENDPOINT",
  );
  const accessKeyId = firstEnv(
    "TRANSFER_STORAGE_ACCESS_KEY_ID",
    "TRANSFER_R2_ACCESS_KEY_ID",
  );
  const secretAccessKey = firstEnv(
    "TRANSFER_STORAGE_SECRET_ACCESS_KEY",
    "TRANSFER_R2_SECRET_ACCESS_KEY",
  );
  const bucketName = firstEnv(
    "TRANSFER_STORAGE_BUCKET_NAME",
    "TRANSFER_R2_BUCKET_NAME",
  );

  const missing = [
    !endpoint ? "endpoint" : "",
    !accessKeyId ? "access key" : "",
    !secretAccessKey ? "secret key" : "",
    !bucketName ? "bucket name" : "",
  ].filter(Boolean);

  let endpointValid = false;
  if (endpoint) {
    try {
      const parsed = new URL(endpoint);
      endpointValid =
        parsed.protocol === "https:" ||
        parsed.protocol === "http:";
    } catch {
      endpointValid = false;
    }
  }

  return {
    configured:
      missing.length === 0 &&
      endpointValid,
    missing,
    endpointValid,
    provider:
      endpoint.includes("backblazeb2.com")
        ? "Backblaze B2"
        : endpoint.includes("r2.cloudflarestorage.com")
          ? "Cloudflare R2"
          : endpoint
            ? "S3-compatible storage"
            : "Not configured",
  };
}

function getConfig(): TransferStorageConfig {
  const status =
    getTransferStorageConfiguration();

  if (!status.configured) {
    const detail =
      status.missing.length > 0
        ? "Missing " +
          status.missing.join(", ") +
          "."
        : "The storage endpoint is not a valid URL.";

    throw new Error(
      "Transfer storage is not configured. " +
        detail,
    );
  }

  return {
    endpoint: firstEnv(
      "TRANSFER_STORAGE_ENDPOINT",
      "TRANSFER_R2_ENDPOINT",
    ),
    accessKeyId: firstEnv(
      "TRANSFER_STORAGE_ACCESS_KEY_ID",
      "TRANSFER_R2_ACCESS_KEY_ID",
    ),
    secretAccessKey: firstEnv(
      "TRANSFER_STORAGE_SECRET_ACCESS_KEY",
      "TRANSFER_R2_SECRET_ACCESS_KEY",
    ),
    bucketName: firstEnv(
      "TRANSFER_STORAGE_BUCKET_NAME",
      "TRANSFER_R2_BUCKET_NAME",
    ),
  };
}

function getClient() {
  const config = getConfig();

  return new S3Client({
    region:
      firstEnv(
        "TRANSFER_STORAGE_REGION",
      ) || "auto",
    endpoint: config.endpoint,
    forcePathStyle:
      firstEnv(
        "TRANSFER_STORAGE_FORCE_PATH_STYLE",
      ) === "true",
    credentials: {
      accessKeyId:
        config.accessKeyId,
      secretAccessKey:
        config.secretAccessKey,
    },
  });
}

function getBucket() {
  return getConfig().bucketName;
}

function namespace() {
  return process.env.VERCEL_ENV === "production"
    ? "transfers"
    : "transfers-preview";
}

function safeSegment(value: string) {
  const clean = value.trim();

  if (
    !clean ||
    clean.includes("/") ||
    clean.includes("\\") ||
    clean === "." ||
    clean === ".."
  ) {
    throw new Error(
      "Invalid transfer storage segment.",
    );
  }

  return clean.replace(
    /[\u0000-\u001f]/g,
    "",
  );
}

export function getTransferObjectKey(
  transferId: string,
  fileId: string,
) {
  return (
    namespace() +
    "/" +
    safeSegment(transferId) +
    "/" +
    safeSegment(fileId)
  );
}

export async function createTransferUploadUrl(
  transferId: string,
  fileId: string,
  contentType: string,
) {
  const objectKey =
    getTransferObjectKey(
      transferId,
      fileId,
    );

  const command =
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: objectKey,
      ContentType:
        contentType ||
        "application/octet-stream",
      CacheControl:
        "private, no-store",
    });

  return {
    objectKey,
    uploadUrl:
      await getSignedUrl(
        getClient(),
        command,
        {
          expiresIn:
            15 * 60,
        },
      ),
  };
}

export async function transferObjectExists(
  objectKey: string,
) {
  try {
    await getClient().send(
      new HeadObjectCommand({
        Bucket: getBucket(),
        Key: objectKey,
      }),
    );

    return true;
  } catch (error) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "$metadata" in error
        ? (
            error as {
              $metadata?: {
                httpStatusCode?: number;
              };
            }
          ).$metadata
            ?.httpStatusCode
        : undefined;

    if (status === 404) {
      return false;
    }

    throw error;
  }
}

function safeDownloadFilename(
  value: string,
) {
  return (
    value
      .replace(
        /[\r\n"]/g,
        "",
      )
      .trim() ||
    "download"
  );
}

export async function createTransferDownloadUrl(
  objectKey: string,
  filename: string,
) {
  const command =
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: objectKey,
      ResponseContentDisposition:
        'attachment; filename="' +
        safeDownloadFilename(
          filename,
        ) +
        '"',
      ResponseCacheControl:
        "private, no-store",
    });

  return getSignedUrl(
    getClient(),
    command,
    {
      expiresIn:
        15 * 60,
    },
  );
}

export async function deleteTransferObjects(
  transferId: string,
) {
  const client =
    getClient();

  const prefix =
    namespace() +
    "/" +
    safeSegment(
      transferId,
    ) +
    "/";

  let continuationToken:
    | string
    | undefined;

  do {
    const page =
      await client.send(
        new ListObjectsV2Command({
          Bucket: getBucket(),
          Prefix: prefix,
          ContinuationToken:
            continuationToken,
        }),
      );

    const objects =
      (
        page.Contents ??
        []
      ).flatMap(
        (item) =>
          item.Key
            ? [
                {
                  Key: item.Key,
                },
              ]
            : [],
      );

    if (
      objects.length
    ) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: getBucket(),
          Delete: {
            Objects:
              objects,
            Quiet: true,
          },
        }),
      );
    }

    continuationToken =
      page.IsTruncated
        ? page.NextContinuationToken
        : undefined;
  } while (
    continuationToken
  );
}
