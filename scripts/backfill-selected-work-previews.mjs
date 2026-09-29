import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { neon } from "@neondatabase/serverless";
import sharp from "sharp";

function env(name) {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is not configured.`,
    );
  }

  return value;
}

const sql =
  neon(env("DATABASE_URL"));

const client =
  new S3Client({
    region: "auto",
    endpoint:
      env("R2_SELECTED_WORK_ENDPOINT"),
    credentials: {
      accessKeyId:
        env(
          "R2_SELECTED_WORK_ACCESS_KEY_ID",
        ),
      secretAccessKey:
        env(
          "R2_SELECTED_WORK_SECRET_ACCESS_KEY",
        ),
    },
  });

const bucket =
  env(
    "R2_SELECTED_WORK_BUCKET_NAME",
  );

const rows =
  await sql`
    SELECT
      category,
      storage_key,
      display_filename
    FROM selected_work_items
    WHERE deleted_at IS NULL
    ORDER BY category, position
  `;

function previewKey(
  category,
  filename,
) {
  return `selected-work/${category}/__previews/${filename}`;
}

function displayKey(
  category,
  filename,
) {
  return `selected-work/${category}/__display/${filename}`;
}

async function exists(key) {
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    return true;
  } catch (error) {
    if (
      error?.$metadata
        ?.httpStatusCode === 404
    ) {
      return false;
    }

    throw error;
  }
}

async function putDerivative(
  key,
  bytes,
) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: "image/webp",
      CacheControl:
        "public, max-age=31536000, immutable",
    }),
  );

  if (!(await exists(key))) {
    throw new Error(
      `Derivative verification failed: ${key}`,
    );
  }
}

async function backfill(row) {
  const source =
    await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: row.storage_key,
      }),
    );

  if (!source.Body) {
    throw new Error(
      `${row.storage_key} has no body.`,
    );
  }

  const bytes =
    Buffer.from(
      await source.Body
        .transformToByteArray(),
    );

  const preview =
    await sharp(bytes)
      .rotate()
      .resize({
        width: 1000,
        withoutEnlargement: true,
      })
      .webp({
        quality: 75,
        effort: 4,
      })
      .toBuffer();

  const display =
    await sharp(bytes)
      .rotate()
      .resize({
        width: 1800,
        withoutEnlargement: true,
      })
      .webp({
        quality: 80,
        effort: 4,
      })
      .toBuffer();

  const previewDestination =
    previewKey(
      row.category,
      row.display_filename,
    );

  const displayDestination =
    displayKey(
      row.category,
      row.display_filename,
    );

  await Promise.all([
    putDerivative(
      previewDestination,
      preview,
    ),
    putDerivative(
      displayDestination,
      display,
    ),
  ]);

  return {
    previewBytes: preview.length,
    displayBytes: display.length,
  };
}

console.log(
  `\n=== SELECTED WORK RESPONSIVE DERIVATIVE BACKFILL: ${rows.length} IMAGES ===\n`,
);

let processed = 0;

const concurrency = 4;

for (
  let index = 0;
  index < rows.length;
  index += concurrency
) {
  const batch =
    rows.slice(
      index,
      index + concurrency,
    );

  const results =
    await Promise.all(
      batch.map(backfill),
    );

  for (
    let offset = 0;
    offset < results.length;
    offset += 1
  ) {
    const result =
      results[offset];

    const row =
      batch[offset];

    processed += 1;

    console.log(
      `${row.category}/${row.display_filename}: preview ${(result.previewBytes / 1024).toFixed(0)} KB | display ${(result.displayBytes / 1024).toFixed(0)} KB`,
    );
  }
}

let missingPreview = 0;
let missingDisplay = 0;

for (
  let index = 0;
  index < rows.length;
  index += 12
) {
  const batch =
    rows.slice(
      index,
      index + 12,
    );

  const checks =
    await Promise.all(
      batch.map(
        async (row) => ({
          preview:
            await exists(
              previewKey(
                row.category,
                row.display_filename,
              ),
            ),
          display:
            await exists(
              displayKey(
                row.category,
                row.display_filename,
              ),
            ),
        }),
      ),
    );

  missingPreview +=
    checks.filter(
      (value) => !value.preview,
    ).length;

  missingDisplay +=
    checks.filter(
      (value) => !value.display,
    ).length;
}

console.log(
  `\nProcessed: ${processed}`,
);
console.log(
  `Missing previews: ${missingPreview}`,
);
console.log(
  `Missing display derivatives: ${missingDisplay}`,
);

if (
  missingPreview !== 0 ||
  missingDisplay !== 0
) {
  process.exitCode = 1;
} else {
  console.log(
    "\nSELECTED WORK RESPONSIVE DERIVATIVE BACKFILL PASS.",
  );
}
