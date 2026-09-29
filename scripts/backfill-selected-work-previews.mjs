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

async function backfill(row) {
  const destination =
    previewKey(
      row.category,
      row.display_filename,
    );

  if (
    await exists(destination)
  ) {
    return {
      status: "existing",
      key: destination,
    };
  }

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

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: destination,
      Body: preview,
      ContentType: "image/webp",
      CacheControl:
        "public, max-age=31536000, immutable",
    }),
  );

  if (
    !(await exists(destination))
  ) {
    throw new Error(
      `Preview verification failed: ${destination}`,
    );
  }

  return {
    status: "created",
    key: destination,
    bytes: preview.length,
  };
}

console.log(
  `\n=== SELECTED WORK PREVIEW BACKFILL: ${rows.length} IMAGES ===\n`,
);

let created = 0;
let existing = 0;

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

    if (
      result.status === "created"
    ) {
      created += 1;

      console.log(
        `${row.category}/${row.display_filename}: ${(result.bytes / 1024).toFixed(0)} KB`,
      );
    } else {
      existing += 1;
    }
  }
}

let missing = 0;

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
        async (row) =>
          exists(
            previewKey(
              row.category,
              row.display_filename,
            ),
          ),
      ),
    );

  missing +=
    checks.filter(
      (value) => !value,
    ).length;
}

console.log(
  `\nCreated: ${created}`,
);
console.log(
  `Already existed: ${existing}`,
);
console.log(
  `Missing after verification: ${missing}`,
);

if (missing !== 0) {
  process.exitCode = 1;
} else {
  console.log(
    "\nSELECTED WORK PREVIEW BACKFILL PASS.",
  );
}
