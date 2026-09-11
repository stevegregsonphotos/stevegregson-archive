import {
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

import { neon } from "@neondatabase/serverless";

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

const client = new S3Client({
  region: "auto",
  endpoint: requiredEnv(
    "R2_PRODUCTIONS_ENDPOINT"
  ),
  credentials: {
    accessKeyId: requiredEnv(
      "R2_PRODUCTIONS_ACCESS_KEY_ID"
    ),
    secretAccessKey: requiredEnv(
      "R2_PRODUCTIONS_SECRET_ACCESS_KEY"
    ),
  },
});

const bucket = requiredEnv(
  "R2_PRODUCTIONS_BUCKET_NAME"
);

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  requiredEnv("DATABASE_URL_UNPOOLED");

const sql = neon(databaseUrl);

const productionRows = await sql`
  SELECT hero_storage_key
  FROM productions
  WHERE deleted_at IS NULL
`;

const imageRows = await sql`
  SELECT storage_key
  FROM production_images
  WHERE deleted_at IS NULL
`;

const referencedKeys = new Set([
  ...productionRows.map(
    (row) => row.hero_storage_key
  ),
  ...imageRows.map(
    (row) => row.storage_key
  ),
]);

const bucketKeys = new Set();

let continuationToken;

do {
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
    })
  );

  for (const object of response.Contents ?? []) {
    if (object.Key) {
      bucketKeys.add(object.Key);
    }
  }

  continuationToken =
    response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
} while (continuationToken);

const missing = [...referencedKeys]
  .filter((key) => !bucketKeys.has(key))
  .sort();

const extra = [...bucketKeys]
  .filter((key) => !referencedKeys.has(key))
  .sort();

console.log(
  `Production heroes referenced: ${productionRows.length}`
);
console.log(
  `Gallery images referenced: ${imageRows.length}`
);
console.log(
  `Unique R2 keys referenced: ${referencedKeys.size}`
);
console.log(
  `R2 objects found: ${bucketKeys.size}`
);
console.log(
  `Referenced keys missing from R2: ${missing.length}`
);
console.log(
  `R2 objects not referenced by active Neon production data: ${extra.length}`
);

if (missing.length) {
  console.error("");
  console.error("MISSING R2 OBJECTS:");

  for (const key of missing.slice(0, 100)) {
    console.error(key);
  }

  if (missing.length > 100) {
    console.error(
      `... ${missing.length - 100} more`
    );
  }

  process.exit(1);
}

console.log("");
console.log(
  "R2 RECONCILIATION PASSED: every active Neon production image exists."
);

if (extra.length) {
  console.log("");
  console.log(
    "Extra R2 objects retained intentionally during migration."
  );
}
