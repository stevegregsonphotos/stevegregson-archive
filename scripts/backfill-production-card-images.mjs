import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  neon,
} from "@neondatabase/serverless";

import sharp from "sharp";

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

const client =
  new S3Client({
    region: "auto",
    endpoint: required(
      "R2_PRODUCTIONS_ENDPOINT",
    ),
    credentials: {
      accessKeyId: required(
        "R2_PRODUCTIONS_ACCESS_KEY_ID",
      ),
      secretAccessKey: required(
        "R2_PRODUCTIONS_SECRET_ACCESS_KEY",
      ),
    },
  });

const bucket =
  required(
    "R2_PRODUCTIONS_BUCKET_NAME",
  );

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not configured.",
  );
}

const sql =
  neon(databaseUrl);

async function head(key) {
  try {
    return await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  } catch (error) {
    if (
      error?.$metadata
        ?.httpStatusCode === 404
    ) {
      return null;
    }

    throw error;
  }
}

async function read(key) {
  const response =
    await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

  if (!response.Body) {
    throw new Error(
      `${key} has no body.`,
    );
  }

  return Buffer.from(
    await response.Body
      .transformToByteArray(),
  );
}

function cardKey(
  slug,
  filename,
) {
  return `${slug}/__cards/${filename}`;
}

const productions =
  await sql`
    SELECT
      slug,
      hero_storage_key,
      hero_display_filename
    FROM productions
    WHERE deleted_at IS NULL
      AND hero_storage_key IS NOT NULL
      AND hero_display_filename IS NOT NULL
    ORDER BY lower(slug)
  `;

console.log(
  `\n=== PRODUCTION CARD BACKFILL: ${productions.length} PRODUCTIONS ===\n`,
);

let created = 0;
let existing = 0;

const concurrency = 4;

for (
  let index = 0;
  index < productions.length;
  index += concurrency
) {
  const batch =
    productions.slice(
      index,
      index + concurrency,
    );

  await Promise.all(
    batch.map(
      async (production) => {
        const destination =
          cardKey(
            production.slug,
            production.hero_display_filename,
          );

        if (
          await head(
            destination,
          )
        ) {
          existing += 1;
          return;
        }

        const source =
          await read(
            production.hero_storage_key,
          );

        const output =
          await sharp(
            source,
            {
              failOn: "none",
            },
          )
            .rotate()
            .resize({
              width: 1000,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({
              quality: 75,
              effort: 6,
              smartSubsample: true,
            })
            .toBuffer();

        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: destination,
            Body: output,
            ContentType:
              "image/webp",
            CacheControl:
              CACHE_CONTROL,
          }),
        );

        const verified =
          await head(
            destination,
          );

        if (
          !verified ||
          verified.ContentType
            ?.toLowerCase() !==
            "image/webp"
        ) {
          throw new Error(
            `Card derivative verification failed: ${destination}`,
          );
        }

        created += 1;

        console.log(
          `${production.slug}: ${(output.length / 1024).toFixed(0)} KB`,
        );
      },
    ),
  );
}

console.log(
  `\nCreated: ${created}`,
);
console.log(
  `Already existed: ${existing}`,
);

let missing = 0;

for (
  let index = 0;
  index < productions.length;
  index += 12
) {
  const batch =
    productions.slice(
      index,
      index + 12,
    );

  const results =
    await Promise.all(
      batch.map(
        (production) =>
          head(
            cardKey(
              production.slug,
              production.hero_display_filename,
            ),
          ),
      ),
    );

  missing +=
    results.filter(
      (result) =>
        !result,
    ).length;
}

console.log(
  `Missing after verification: ${missing}`,
);

if (missing !== 0) {
  throw new Error(
    `${missing} production card derivative(s) are missing.`,
  );
}

console.log(
  "\nPRODUCTION CARD BACKFILL PASS.",
);
