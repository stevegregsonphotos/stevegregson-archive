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

/*
 * Small grid thumbnails live next to each proof as "thumb-<webFilename>",
 * so deleting a gallery's folder removes them too.
 */
export function getProofingThumbFilename(
  webFilename: string,
) {
  return `thumb-${safeSegment(webFilename)}`;
}

export async function createProofingThumbUploadUrl(
  galleryId: string,
  webFilename: string,
) {
  return createProofingImageUploadUrl(
    galleryId,
    getProofingThumbFilename(webFilename),
  );
}

/** Proofs in this gallery that already have a thumbnail (by webFilename). */
export async function listProofingThumbs(
  galleryId: string,
) {
  const client = getClient();
  const prefix = `${safeSegment(galleryId)}/thumb-`;
  const found = new Set<string>();
  let continuationToken: string | undefined;

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: getBucket(),
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    for (const item of page.Contents ?? []) {
      if (item.Key) found.add(item.Key.slice(prefix.length));
    }
    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return found;
}

/*
 * Thumbnail links for a whole gallery, signed in one go when the page is
 * built (instead of one trip through Vercel per photo). Links are signed
 * for a fixed 6-hour window, so they stay identical across reloads and the
 * browser can reuse photos it has already downloaded. Each link lasts 18
 * hours, so a page opened late in a window still has at least 12.
 */
const THUMB_WINDOW_MS = 6 * 60 * 60 * 1000;
const THUMB_LINK_SECONDS = 18 * 60 * 60;
const thumbLinkCache = new Map<string, Map<string, string>>();

export async function createProofingThumbUrls(
  galleryId: string,
  webFilenames: string[],
) {
  const window = Math.floor(Date.now() / THUMB_WINDOW_MS);
  const cacheKey = `${galleryId}:${window}`;
  let links = thumbLinkCache.get(cacheKey);

  if (!links) {
    // Forget older windows.
    for (const key of thumbLinkCache.keys()) {
      if (!key.endsWith(`:${window}`)) thumbLinkCache.delete(key);
    }
    links = new Map();
    thumbLinkCache.set(cacheKey, links);
  }

  const missing = webFilenames.filter((name) => !links.has(name));

  if (missing.length) {
    const client = getClient();
    const bucket = getBucket();
    const signingDate = new Date(window * THUMB_WINDOW_MS);
    const signed = await Promise.all(
      missing.map((name) =>
        getSignedUrl(
          client,
          new GetObjectCommand({
            Bucket: bucket,
            Key: getProofingImageObjectKey(
              galleryId,
              getProofingThumbFilename(name),
            ),
          }),
          { expiresIn: THUMB_LINK_SECONDS, signingDate },
        ),
      ),
    );
    missing.forEach((name, index) => links.set(name, signed[index]));
  }

  return new Map(
    webFilenames.map((name) => [name, links.get(name) as string]),
  );
}

function getProofingNotesReportObjectKey(
  galleryId: string,
) {
  return [
    "reports",
    safeSegment(galleryId),
    "client-editing-requests.pdf",
  ].join("/");
}

export async function createProofingNotesReportUploadUrl(
  galleryId: string,
) {
  const command =
    new PutObjectCommand({
      Bucket: getBucket(),
      Key:
        getProofingNotesReportObjectKey(
          galleryId,
        ),
      ContentType:
        "application/pdf",
      CacheControl:
        "private, no-store",
    });

  return getSignedUrl(
    getClient(),
    command,
    {
      expiresIn: 15 * 60,
    },
  );
}

export async function getProofingNotesReport(
  galleryId: string,
) {
  const result =
    await getClient().send(
      new GetObjectCommand({
        Bucket: getBucket(),
        Key:
          getProofingNotesReportObjectKey(
            galleryId,
          ),
      }),
    );

  if (!result.Body) {
    throw new Error(
      "Proofing notes report has no body.",
    );
  }

  return result.Body.transformToByteArray();
}

export async function createProofingNotesReportDownloadUrl(
  galleryId: string,
  downloadFilename: string,
) {
  const safeDownloadFilename =
    downloadFilename
      .replace(
        /[\r\n"]/g,
        "",
      )
      .trim() ||
    "client-editing-requests.pdf";

  const command =
    new GetObjectCommand({
      Bucket: getBucket(),
      Key:
        getProofingNotesReportObjectKey(
          galleryId,
        ),
      ResponseContentType:
        "application/pdf",
      ResponseContentDisposition:
        `attachment; filename="${safeDownloadFilename}"`,
    });

  return getSignedUrl(
    getClient(),
    command,
    {
      expiresIn: 15 * 60,
    },
  );
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

  // Its thumbnail too (if it has one; nothing happens if not).
  if (!webFilename.startsWith("thumb-")) {
    await getClient()
      .send(
        new DeleteObjectCommand({
          Bucket: getBucket(),
          Key: getProofingImageObjectKey(
            galleryId,
            getProofingThumbFilename(webFilename),
          ),
        }),
      )
      .catch(() => undefined);
  }
}

async function deleteProofingObjectsWithPrefix(
  prefix: string,
) {
  const client = getClient();
  const bucket = getBucket();

  let continuationToken:
    | string
    | undefined;

  do {
    const response =
      await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken:
            continuationToken,
        }),
      );

    const objects =
      (response.Contents ?? [])
        .flatMap((object) =>
          object.Key
            ? [{ Key: object.Key }]
            : [],
        );

    if (objects.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: objects,
            Quiet: true,
          },
        }),
      );
    }

    continuationToken =
      response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
  } while (continuationToken);
}

export async function deleteProofingGalleryObjects(
  galleryId: string,
) {
  const safeGalleryId =
    safeSegment(galleryId);

  await deleteProofingObjectsWithPrefix(
    `${safeGalleryId}/`,
  );

  await deleteProofingObjectsWithPrefix(
    `rendered/${safeGalleryId}/`,
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
