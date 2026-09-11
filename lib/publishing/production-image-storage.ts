import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

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

function safeSegment(
  value: string,
  label: string,
) {
  if (
    !value ||
    value.includes("/") ||
    value.includes("\\") ||
    value === "." ||
    value === ".."
  ) {
    throw new Error(
      `Invalid production image ${label}.`,
    );
  }

  return value;
}

export function getProductionImageObjectKey(
  productionSlug: string,
  filename: string,
) {
  return [
    safeSegment(
      productionSlug,
      "production slug",
    ),
    safeSegment(
      filename,
      "filename",
    ),
  ].join("/");
}

export async function putProductionImage(
  productionSlug: string,
  filename: string,
  body: Buffer,
) {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: getProductionImageObjectKey(
        productionSlug,
        filename,
      ),
      Body: body,
      ContentType: "image/webp",
    }),
  );
}

export async function productionImageExists(
  productionSlug: string,
  filename: string,
) {
  try {
    await getClient().send(
      new HeadObjectCommand({
        Bucket: getBucket(),
        Key: getProductionImageObjectKey(
          productionSlug,
          filename,
        ),
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



export async function getProductionImage(
  productionSlug: string,
  filename: string,
) {
  const response = await getClient().send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: getProductionImageObjectKey(
        productionSlug,
        filename,
      ),
    }),
  );

  if (!response.Body) {
    throw new Error(
      `Production image "${productionSlug}/${filename}" has no body.`,
    );
  }

  return Buffer.from(
    await response.Body.transformToByteArray(),
  );
}

export async function listProductionImages(
  productionSlug: string,
) {
  const prefix =
    `${safeSegment(
      productionSlug,
      "production slug",
    )}/`;

  const keys: string[] = [];
  let continuationToken:
    | string
    | undefined;

  do {
    const response = await getClient().send(
      new ListObjectsV2Command({
        Bucket: getBucket(),
        Prefix: prefix,
        ContinuationToken:
          continuationToken,
      }),
    );

    for (const object of response.Contents ?? []) {
      if (object.Key) {
        keys.push(object.Key);
      }
    }

    continuationToken =
      response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
  } while (continuationToken);

  return keys;
}

export async function deleteProductionImages(
  productionSlug: string,
) {
  const keys =
    await listProductionImages(
      productionSlug,
    );

  for (const key of keys) {
    await getClient().send(
      new DeleteObjectCommand({
        Bucket: getBucket(),
        Key: key,
      }),
    );
  }

  return keys.length;
}

export async function copyProductionImage(
  productionSlug: string,
  sourceFilename: string,
  destinationFilename: string,
) {
  const bucket = getBucket();
  const sourceKey = getProductionImageObjectKey(
    productionSlug,
    sourceFilename,
  );
  const destinationKey = getProductionImageObjectKey(
    productionSlug,
    destinationFilename,
  );
  const encodedSource = sourceKey
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  await getClient().send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: destinationKey,
      CopySource: `${bucket}/${encodedSource}`,
      ContentType: "image/webp",
      MetadataDirective: "REPLACE",
    }),
  );
}

export async function uniqueProductionImageFilename(
  productionSlug: string,
  proposedFilename: string,
  currentFilename?: string,
  reserved: Set<string> = new Set(),
) {
  const parsed = proposedFilename.match(/^(.*?)(\.[A-Za-z0-9]+)?$/);
  const rawStem = parsed?.[1] ?? proposedFilename;
  const extension = (parsed?.[2] ?? ".webp").toLowerCase();
  const stem = rawStem
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "production-image";

  let candidate = `${stem}${extension === ".jpeg" ? ".jpg" : extension}`;
  let counter = 2;

  while (true) {
    if (candidate === currentFilename) {
      return candidate;
    }
    const exists = await productionImageExists(
      productionSlug,
      candidate,
    );
    if (!reserved.has(candidate) && !exists) {
      return candidate;
    }
    candidate = `${stem}-${counter}${extension === ".jpeg" ? ".jpg" : extension}`;
    counter += 1;
  }
}

export async function deleteProductionImage(
  productionSlug: string,
  filename: string,
) {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: getProductionImageObjectKey(
        productionSlug,
        filename,
      ),
    }),
  );
}
