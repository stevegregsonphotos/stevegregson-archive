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

function derivativeKey(
  slug,
  displayFilename,
) {
  return [
    slug,
    "__cards",
    displayFilename,
  ].join("/");
}

const productions =
  await sql`
    SELECT
      id,
      slug,
      hero_storage_key,
      hero_display_filename
    FROM productions
    WHERE deleted_at IS NULL
    ORDER BY lower(slug)
  `;

const productionImages =
  await sql`
    SELECT
      production_id,
      storage_key,
      display_filename,
      position
    FROM production_images
    WHERE deleted_at IS NULL
    ORDER BY production_id, position, id
  `;

const imagesByProduction =
  new Map();

for (const image of productionImages) {
  const key =
    String(image.production_id);

  const existing =
    imagesByProduction.get(key) ??
    [];

  existing.push(image);
  imagesByProduction.set(
    key,
    existing,
  );
}

const authoritative = [];

for (const production of productions) {
  if (
    production.hero_storage_key &&
    production.hero_display_filename
  ) {
    authoritative.push({
      slug: production.slug,
      sourceKey:
        production.hero_storage_key,
      displayFilename:
        production.hero_display_filename,
      type: "hero",
    });
  }

  const images =
    imagesByProduction.get(
      String(production.id),
    ) ?? [];

  for (const image of images) {
    authoritative.push({
      slug: production.slug,
      sourceKey:
        image.storage_key,
      displayFilename:
        image.display_filename,
      type: "gallery",
    });
  }
}

/*
 * De-duplicate by final derivative path.
 * This also protects against a hero image
 * appearing in production_images.
 */
const unique =
  new Map();

for (const image of authoritative) {
  const destination =
    derivativeKey(
      image.slug,
      image.displayFilename,
    );

  if (!unique.has(destination)) {
    unique.set(
      destination,
      {
        ...image,
        destination,
      },
    );
  }
}

const items =
  [...unique.values()];

console.log(
  `\n=== AUTHORITATIVE PRODUCTION DERIVATIVE BACKFILL ===`,
);

console.log(
  `Mode: ${APPLY ? "APPLY" : "DRY RUN"}`,
);

console.log(
  `Active productions: ${productions.length}`,
);

console.log(
  `Active production image rows: ${productionImages.length}`,
);

console.log(
  `Unique authoritative assets: ${items.length}`,
);

let existing = 0;
let missing = 0;
let missingSource = 0;
let created = 0;

const missingItems = [];

const checkConcurrency = 12;

for (
  let index = 0;
  index < items.length;
  index += checkConcurrency
) {
  const batch =
    items.slice(
      index,
      index + checkConcurrency,
    );

  const results =
    await Promise.all(
      batch.map(
        async (item) => {
          const destinationExists =
            await head(
              item.destination,
            );

          if (destinationExists) {
            return {
              type: "existing",
              item,
            };
          }

          const sourceExists =
            await head(
              item.sourceKey,
            );

          if (!sourceExists) {
            return {
              type: "missing-source",
              item,
            };
          }

          return {
            type: "missing",
            item,
          };
        },
      ),
    );

  for (const result of results) {
    if (result.type === "existing") {
      existing += 1;
    } else if (
      result.type ===
      "missing-source"
    ) {
      missingSource += 1;

      console.log(
        `MISSING SOURCE: ${result.item.sourceKey}`,
      );
    } else {
      missing += 1;
      missingItems.push(
        result.item,
      );
    }
  }

  process.stdout.write(
    `Checked ${Math.min(
      index + checkConcurrency,
      items.length,
    )}/${items.length}\r`,
  );
}

console.log("\n");

console.log(
  `Existing derivatives: ${existing}`,
);

console.log(
  `Derivatives to create: ${missing}`,
);

console.log(
  `Missing authoritative source images: ${missingSource}`,
);

if (missingSource !== 0) {
  throw new Error(
    `${missingSource} authoritative source image(s) are missing from R2. No backfill will run.`,
  );
}

if (!APPLY) {
  console.log(
    "\nDRY RUN PASS: no R2 objects were written.",
  );

  process.exit(0);
}

console.log(
  "\n=== APPLYING BACKFILL ===\n",
);

const writeConcurrency = 4;

for (
  let index = 0;
  index < missingItems.length;
  index += writeConcurrency
) {
  const batch =
    missingItems.slice(
      index,
      index + writeConcurrency,
    );

  await Promise.all(
    batch.map(
      async (item) => {
        /*
         * Check again immediately before
         * writing so reruns remain safe.
         */
        if (
          await head(
            item.destination,
          )
        ) {
          return;
        }

        const source =
          await read(
            item.sourceKey,
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
            Key:
              item.destination,
            Body:
              output,
            ContentType:
              "image/webp",
            CacheControl:
              CACHE_CONTROL,
          }),
        );

        const verified =
          await head(
            item.destination,
          );

        if (
          !verified ||
          verified.ContentType
            ?.toLowerCase() !==
            "image/webp"
        ) {
          throw new Error(
            `Derivative verification failed: ${item.destination}`,
          );
        }

        created += 1;

        console.log(
          `Created ${created}/${missingItems.length}: ${item.destination} (${Math.round(
            output.length / 1024,
          )} KB)`,
        );
      },
    ),
  );
}

let verificationMissing = 0;

for (
  let index = 0;
  index < items.length;
  index += checkConcurrency
) {
  const batch =
    items.slice(
      index,
      index + checkConcurrency,
    );

  const results =
    await Promise.all(
      batch.map(
        (item) =>
          head(
            item.destination,
          ),
      ),
    );

  verificationMissing +=
    results.filter(
      (result) => !result,
    ).length;
}

console.log(
  `\nCreated this run: ${created}`,
);

console.log(
  `Missing after verification: ${verificationMissing}`,
);

if (verificationMissing !== 0) {
  throw new Error(
    `${verificationMissing} authoritative derivative(s) are missing after backfill.`,
  );
}

console.log(
  "\nAUTHORITATIVE PRODUCTION DERIVATIVE BACKFILL PASS.",
);
