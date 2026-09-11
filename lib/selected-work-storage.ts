import "server-only";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

function requiredEnv(
  name: string,
) {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is not configured.`,
    );
  }

  return value;
}

function getClient() {
  return new S3Client({
    region: "auto",
    endpoint: requiredEnv(
      "R2_SELECTED_WORK_ENDPOINT",
    ),
    credentials: {
      accessKeyId: requiredEnv(
        "R2_SELECTED_WORK_ACCESS_KEY_ID",
      ),
      secretAccessKey: requiredEnv(
        "R2_SELECTED_WORK_SECRET_ACCESS_KEY",
      ),
    },
  });
}

function getBucket() {
  return requiredEnv(
    "R2_SELECTED_WORK_BUCKET_NAME",
  );
}

export function selectedWorkStorageKey(
  category: string,
  filename: string,
) {
  return `selected-work/${category}/${filename}`;
}

export async function selectedWorkObjectExists(
  storageKey: string,
) {
  const client =
    getClient();

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: getBucket(),
        Key: storageKey,
      }),
    );

    return true;
  } catch (error) {
    const status =
      (
        error as {
          $metadata?: {
            httpStatusCode?: number;
          };
        }
      ).$metadata?.httpStatusCode;

    if (status === 404) {
      return false;
    }

    throw error;
  }
}

export async function putSelectedWorkObject(
  storageKey: string,
  bytes: Buffer,
  contentType = "image/jpeg",
) {
  const client =
    getClient();

  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: storageKey,
      Body: bytes,
      ContentType: contentType,
    }),
  );
}

export async function getSelectedWorkObject(
  storageKey: string,
) {
  const client =
    getClient();

  const response =
    await client.send(
      new GetObjectCommand({
        Bucket: getBucket(),
        Key: storageKey,
      }),
    );

  if (!response.Body) {
    throw new Error(
      "Selected Work image body is missing.",
    );
  }

  return Buffer.from(
    await response.Body.transformToByteArray(),
  );
}

export async function copySelectedWorkObject(
  sourceStorageKey: string,
  destinationStorageKey: string,
) {
  const client =
    getClient();

  const bucket =
    getBucket();

  const encodedSource =
    sourceStorageKey
      .split("/")
      .map((part) =>
        encodeURIComponent(part),
      )
      .join("/");

  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: destinationStorageKey,
      CopySource:
        `${bucket}/${encodedSource}`,
      ContentType: "image/jpeg",
      MetadataDirective: "REPLACE",
    }),
  );
}

export async function deleteSelectedWorkObject(
  storageKey: string,
) {
  const client =
    getClient();

  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: storageKey,
    }),
  );
}

export async function uniqueSelectedWorkFilename(
  category: string,
  originalName: string,
  currentFilename?: string,
  reservedFilenames:
    Set<string> = new Set(),
) {
  const extensionMatch =
    originalName.match(
      /(\.[A-Za-z0-9]+)$/,
    );

  const extension =
    extensionMatch
      ? extensionMatch[1].toLowerCase()
      : ".jpg";

  const rawBase =
    extensionMatch
      ? originalName.slice(
          0,
          -extensionMatch[1].length,
        )
      : originalName;

  const base =
    rawBase
      .normalize("NFKD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      ) ||
    "selected-work-image";

  const normalisedExtension =
    extension === ".jpeg"
      ? ".jpg"
      : extension;

  let candidate =
    `${base}${normalisedExtension}`;

  let counter = 2;

  while (true) {
    if (
      candidate === currentFilename
    ) {
      return candidate;
    }

    const reserved =
      reservedFilenames.has(
        candidate,
      );

    const exists =
      await selectedWorkObjectExists(
        selectedWorkStorageKey(
          category,
          candidate,
        ),
      );

    if (
      !reserved &&
      !exists
    ) {
      return candidate;
    }

    candidate =
      `${base}-${counter}${normalisedExtension}`;

    counter += 1;
  }
}
