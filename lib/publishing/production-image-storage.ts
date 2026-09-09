import {
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
