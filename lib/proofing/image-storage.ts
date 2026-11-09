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

/*
 * Full-size download originals: Steve's own JPEG, kept next to the proof as
 * "orig-<proof name>.jpg" for galleries where visitors download. Removable
 * in one go from Backstage (they're the big files).
 */
export function getProofingOriginalFilename(
  webFilename: string,
) {
  return `orig-${safeSegment(webFilename).replace(/\.[^.]+$/, "")}.jpg`;
}

export async function createProofingOriginalUploadUrl(
  galleryId: string,
  webFilename: string,
) {
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: getProofingImageObjectKey(
        galleryId,
        getProofingOriginalFilename(webFilename),
      ),
      ContentType: "image/jpeg",
      CacheControl: "private, max-age=31536000",
    }),
    { expiresIn: 60 * 60 },
  );
}

/*
 * Same as listProofingOriginals, remembered for a minute per server, for
 * the visitor page (so 300 visitors don't each list the storage folder).
 */
const originalsCache = new Map<string, { at: number; names: Set<string> }>();

export async function listProofingOriginalsCached(
  galleryId: string,
) {
  const cached = originalsCache.get(galleryId);
  if (cached && Date.now() - cached.at < 60_000) return cached.names;
  const names = await listProofingOriginals(galleryId);
  originalsCache.set(galleryId, { at: Date.now(), names });
  return names;
}

/** Proofs with a full-size original, as a set of their webFilenames. */
export async function listProofingOriginals(
  galleryId: string,
) {
  const keys = await listProofingObjectNames(galleryId, "orig-");
  // "orig-<base>.jpg" → match against each proof's "<base>.<ext>".
  return new Set([...keys].map((name) => name.replace(/\.jpg$/, "")));
}

export function proofingBaseName(webFilename: string) {
  return safeSegment(webFilename).replace(/\.[^.]+$/, "");
}

/** Deletes every full-size original in a gallery. Returns how many. */
export async function deleteProofingOriginals(
  galleryId: string,
) {
  const names = [...(await listProofingObjectNames(galleryId, "orig-"))];
  const client = getClient();
  for (let start = 0; start < names.length; start += 20) {
    await Promise.all(
      names.slice(start, start + 20).map((name) =>
        client.send(
          new DeleteObjectCommand({
            Bucket: getBucket(),
            Key: getProofingImageObjectKey(galleryId, `orig-${name}`),
          }),
        ),
      ),
    );
  }
  return names.length;
}

/**
 * Download link for a proof: the full-size original JPEG when there is
 * one, otherwise the proof itself.
 */
export async function createProofingBestDownloadUrl(
  galleryId: string,
  webFilename: string,
  baseName?: string,
) {
  const original = getProofingOriginalFilename(webFilename);
  const hasOriginal = await proofingImageExists(galleryId, original);
  if (!hasOriginal) {
    return createProofingImageDownloadUrl(
      galleryId,
      webFilename,
      baseName ? `${baseName}.webp` : undefined,
    );
  }
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: getProofingImageObjectKey(galleryId, original),
      ResponseContentType: "image/jpeg",
      ...(baseName
        ? {
            ResponseContentDisposition: `attachment; filename="${baseName.replace(/[\r\n"]/g, "")}.jpg"`,
          }
        : {}),
    }),
    { expiresIn: 15 * 60 },
  );
}

async function listProofingObjectNames(
  galleryId: string,
  namePrefix: string,
) {
  const client = getClient();
  const prefix = `${safeSegment(galleryId)}/${namePrefix}`;
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

  // Its thumbnail and full-size original too (nothing happens if none).
  if (
    !webFilename.startsWith("thumb-") &&
    !webFilename.startsWith("orig-")
  ) {
    await getClient()
      .send(
        new DeleteObjectCommand({
          Bucket: getBucket(),
          Key: getProofingImageObjectKey(
            galleryId,
            getProofingOriginalFilename(webFilename),
          ),
        }),
      )
      .catch(() => undefined);
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

/**
 * Delete many photos' files at once: each photo's proof, thumbnail and
 * full-size original, up to 1,000 files per request, requests in parallel.
 */
export async function deleteProofingImages(
  galleryId: string,
  webFilenames: string[],
) {
  const client = getClient();
  const bucket = getBucket();

  const keys = webFilenames.flatMap((webFilename) => {
    const own = getProofingImageObjectKey(galleryId, webFilename);

    if (
      webFilename.startsWith("thumb-") ||
      webFilename.startsWith("orig-")
    ) {
      return [own];
    }

    return [
      own,
      getProofingImageObjectKey(
        galleryId,
        getProofingThumbFilename(webFilename),
      ),
      getProofingImageObjectKey(
        galleryId,
        getProofingOriginalFilename(webFilename),
      ),
    ];
  });

  const batches: string[][] = [];
  for (let start = 0; start < keys.length; start += 1000) {
    batches.push(keys.slice(start, start + 1000));
  }

  await Promise.all(
    batches.map((batch) =>
      client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: batch.map((Key) => ({ Key })),
            Quiet: true,
          },
        }),
      ),
    ),
  );
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
