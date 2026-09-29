import {
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { neon } from "@neondatabase/serverless";
import sharp from "sharp";

const APPLY =
  process.argv.includes("--apply");

const CACHE_CONTROL =
  "public, max-age=31536000, immutable";

function required(name) {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is not configured.`,
    );
  }

  return value;
}

function client(
  endpoint,
  accessKeyId,
  secretAccessKey,
) {
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

const productionClient =
  client(
    required(
      "R2_PRODUCTIONS_ENDPOINT",
    ),
    required(
      "R2_PRODUCTIONS_ACCESS_KEY_ID",
    ),
    required(
      "R2_PRODUCTIONS_SECRET_ACCESS_KEY",
    ),
  );

const selectedClient =
  client(
    required(
      "R2_SELECTED_WORK_ENDPOINT",
    ),
    required(
      "R2_SELECTED_WORK_ACCESS_KEY_ID",
    ),
    required(
      "R2_SELECTED_WORK_SECRET_ACCESS_KEY",
    ),
  );

const productionBucket =
  required(
    "R2_PRODUCTIONS_BUCKET_NAME",
  );

const selectedBucket =
  required(
    "R2_SELECTED_WORK_BUCKET_NAME",
  );

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not configured.",
  );
}

const sql = neon(databaseUrl);

function mimeFor(key) {
  const lower =
    key.toLowerCase();

  if (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg")
  ) {
    return "image/jpeg";
  }

  if (lower.endsWith(".webp")) {
    return "image/webp";
  }

  return null;
}

async function exists(
  storageClient,
  bucket,
  key,
) {
  try {
    await storageClient.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    return true;
  } catch (error) {
    const status =
      error?.$metadata
        ?.httpStatusCode;

    if (status === 404) {
      return false;
    }

    throw error;
  }
}

async function inspect(
  storageClient,
  bucket,
  key,
) {
  const result =
    await storageClient.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

  return Number(
    result.ContentLength || 0,
  );
}

async function readObject(
  storageClient,
  bucket,
  key,
) {
  const result =
    await storageClient.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

  if (!result.Body) {
    throw new Error(
      `${key} has no body.`,
    );
  }

  return Buffer.from(
    await result.Body
      .transformToByteArray(),
  );
}

async function optimiseBuffer(
  input,
  key,
  maximumWidth,
  quality,
) {
  const mime =
    mimeFor(key);

  if (!mime) {
    return null;
  }

  let pipeline =
    sharp(input, {
      failOn: "none",
    })
      .rotate()
      .resize({
        width: maximumWidth,
        fit: "inside",
        withoutEnlargement: true,
      });

  if (mime === "image/jpeg") {
    pipeline =
      pipeline.jpeg({
        quality,
        progressive: true,
        mozjpeg: true,
      });
  } else {
    pipeline =
      pipeline.webp({
        quality,
        effort: 6,
        smartSubsample: true,
      });
  }

  return {
    body:
      await pipeline.toBuffer(),
    contentType: mime,
  };
}

async function optimiseObject({
  storageClient,
  bucket,
  key,
  threshold,
  maximumWidth,
  quality,
  label,
}) {
  const before =
    await inspect(
      storageClient,
      bucket,
      key,
    );

  if (before <= threshold) {
    return {
      skipped: true,
      before,
    };
  }

  console.log(
    `${label}: ${(before / 1024 / 1024).toFixed(2)} MB`,
  );

  if (!APPLY) {
    return {
      candidate: true,
      before,
    };
  }

  const original =
    await readObject(
      storageClient,
      bucket,
      key,
    );

  const optimised =
    await optimiseBuffer(
      original,
      key,
      maximumWidth,
      quality,
    );

  if (!optimised) {
    console.log(
      `  skipped unsupported type`,
    );

    return {
      skipped: true,
      before,
    };
  }

  if (
    optimised.body.length >=
    original.length * 0.9
  ) {
    console.log(
      `  no useful reduction`,
    );

    return {
      skipped: true,
      before,
    };
  }

  const backupKey =
    `__performance-originals/${key}`;

  if (
    !await exists(
      storageClient,
      bucket,
      backupKey,
    )
  ) {
    await storageClient.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: backupKey,
        CopySource:
          `${bucket}/${key
            .split("/")
            .map(encodeURIComponent)
            .join("/")}`,
      }),
    );
  }

  await storageClient.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body:
        optimised.body,
      ContentType:
        optimised.contentType,
      CacheControl:
        CACHE_CONTROL,
    }),
  );

  console.log(
    `  -> ${(optimised.body.length / 1024 / 1024).toFixed(2)} MB`,
  );

  return {
    changed: true,
    before,
    after:
      optimised.body.length,
  };
}

const selectedRows =
  await sql`
    SELECT
      category,
      storage_key,
      display_filename
    FROM selected_work_items
    WHERE deleted_at IS NULL
    ORDER BY category, position
  `;

const heroRows =
  await sql`
    SELECT
      slug,
      hero_display_filename AS hero
    FROM productions
    WHERE deleted_at IS NULL
      AND hero_display_filename IS NOT NULL
      AND hero_display_filename <> ''
    ORDER BY year DESC, month DESC NULLS LAST
  `;

console.log("");
console.log(
  APPLY
    ? "=== APPLY PUBLIC IMAGE OPTIMISATION ==="
    : "=== DRY RUN PUBLIC IMAGE OPTIMISATION ===",
);
console.log("");

let selectedCandidates = 0;
let selectedBytes = 0;

for (const row of selectedRows) {
  const result =
    await optimiseObject({
      storageClient:
        selectedClient,
      bucket:
        selectedBucket,
      key:
        row.storage_key,
      threshold:
        1.25 * 1024 * 1024,
      maximumWidth:
        2400,
      quality:
        82,
      label:
        `Selected Work ${row.category}/${row.display_filename}`,
    });

  if (result.candidate) {
    selectedCandidates += 1;
    selectedBytes +=
      result.before;
  }
}

let heroCandidates = 0;
let heroBytes = 0;

for (const row of heroRows) {
  const key =
    `${row.slug}/${row.hero}`;

  const result =
    await optimiseObject({
      storageClient:
        productionClient,
      bucket:
        productionBucket,
      key,
      threshold:
        1 * 1024 * 1024,
      maximumWidth:
        2200,
      quality:
        80,
      label:
        `Archive hero ${key}`,
    });

  if (result.candidate) {
    heroCandidates += 1;
    heroBytes +=
      result.before;
  }
}

if (!APPLY) {
  console.log("");
  console.log(
    `Selected Work candidates: ${selectedCandidates}`,
  );
  console.log(
    `Selected Work current bytes: ${(selectedBytes / 1024 / 1024).toFixed(1)} MB`,
  );
  console.log(
    `Archive hero candidates: ${heroCandidates}`,
  );
  console.log(
    `Archive hero current bytes: ${(heroBytes / 1024 / 1024).toFixed(1)} MB`,
  );
  console.log("");
  console.log(
    "DRY RUN ONLY - no R2 objects changed.",
  );
}
