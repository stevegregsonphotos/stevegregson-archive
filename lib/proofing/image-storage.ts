import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  getSignedUrl,
} from "@aws-sdk/s3-request-presigner";

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

function safeSegment(value: string) {
  if (
    !value ||
    value.includes("/") ||
    value.includes("\\") ||
    value === "." ||
    value === ".."
  ) {
    throw new Error("Invalid proofing image storage segment.");
  }

  return value;
}

export function getProofingImageObjectKey(
  galleryId: string,
  webFilename: string,
) {
  return `${safeSegment(galleryId)}/${safeSegment(webFilename)}`;
}

function getRenderedProofObjectKey(
  galleryId: string,
  imageId: string,
  cacheKey: string,
) {
  return [
    "rendered",
    safeSegment(galleryId),
    safeSegment(imageId),
    `${safeSegment(cacheKey)}.webp`,
  ].join("/");
}

export async function createProofingImageUploadUrl(
  galleryId: string,
  webFilename: string,
) {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: getProofingImageObjectKey(
      galleryId,
      webFilename,
    ),
    ContentType: "image/webp",
    CacheControl: "private, max-age=31536000",
  });

  return getSignedUrl(
    getClient(),
    command,
    { expiresIn: 15 * 60 },
  );
}

export async function createProofingImageDownloadUrl(
  galleryId: string,
  webFilename: string,
  downloadFilename?: string,
) {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: getProofingImageObjectKey(
      galleryId,
      webFilename,
    ),
    ResponseContentType: "image/webp",
    ...(downloadFilename
      ? {
          ResponseContentDisposition:
            `attachment; filename="${downloadFilename.replace(/[\r\n"]/g, "")}"`,
        }
      : {}),
  });

  return getSignedUrl(
    getClient(),
    command,
    { expiresIn: 15 * 60 },
  );
}

export async function createRenderedProofDownloadUrl(
  galleryId: string,
  imageId: string,
  cacheKey: string,
) {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: getRenderedProofObjectKey(
      galleryId,
      imageId,
      cacheKey,
    ),
    ResponseContentType: "image/webp",
  });

  return getSignedUrl(
    getClient(),
    command,
    { expiresIn: 15 * 60 },
  );
}

export async function putProofingImage(
  galleryId: string,
  webFilename: string,
  body: Buffer,
) {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: getProofingImageObjectKey(galleryId, webFilename),
      Body: body,
      ContentType: "image/webp",
    }),
  );
}

export async function getProofingImage(
  galleryId: string,
  webFilename: string,
) {
  const result = await getClient().send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: getProofingImageObjectKey(galleryId, webFilename),
    }),
  );

  if (!result.Body) {
    throw new Error("Proofing image object has no body.");
  }

  const bytes = await result.Body.transformToByteArray();

  return Buffer.from(bytes);
}

export async function proofingImageExists(
  galleryId: string,
  webFilename: string,
) {
  try {
    await getClient().send(
      new HeadObjectCommand({
        Bucket: getBucket(),
        Key: getProofingImageObjectKey(galleryId, webFilename),
      }),
    );

    return true;
  } catch (error) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "$metadata" in error
        ? (error as {
            $metadata?: { httpStatusCode?: number };
          }).$metadata?.httpStatusCode
        : undefined;

    if (status === 404) {
      return false;
    }

    throw error;
  }
}

export async function deleteProofingImage(
  galleryId: string,
  webFilename: string,
) {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: getProofingImageObjectKey(galleryId, webFilename),
    }),
  );
}

export async function renderedProofExists(
  galleryId: string,
  imageId: string,
  cacheKey: string,
) {
  try {
    await getClient().send(
      new HeadObjectCommand({
        Bucket: getBucket(),
        Key: getRenderedProofObjectKey(
          galleryId,
          imageId,
          cacheKey,
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
            $metadata?: { httpStatusCode?: number };
          }).$metadata?.httpStatusCode
        : undefined;

    if (status === 404) {
      return false;
    }

    throw error;
  }
}

export async function getRenderedProof(
  galleryId: string,
  imageId: string,
  cacheKey: string,
) {
  try {
    const result = await getClient().send(
      new GetObjectCommand({
        Bucket: getBucket(),
        Key: getRenderedProofObjectKey(
          galleryId,
          imageId,
          cacheKey,
        ),
      }),
    );

    if (!result.Body) {
      return undefined;
    }

    const bytes =
      await result.Body.transformToByteArray();

    return Buffer.from(bytes);
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
      return undefined;
    }

    throw error;
  }
}

export async function putRenderedProof(
  galleryId: string,
  imageId: string,
  cacheKey: string,
  body: Buffer,
) {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: getRenderedProofObjectKey(
        galleryId,
        imageId,
        cacheKey,
      ),
      Body: body,
      ContentType: "image/webp",
      CacheControl: "private, max-age=31536000",
    }),
  );
}
