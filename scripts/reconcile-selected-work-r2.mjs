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
    "R2_SELECTED_WORK_ENDPOINT"
  ),
  credentials: {
    accessKeyId: requiredEnv(
      "R2_SELECTED_WORK_ACCESS_KEY_ID"
    ),
    secretAccessKey: requiredEnv(
      "R2_SELECTED_WORK_SECRET_ACCESS_KEY"
    ),
  },
});

const bucket = requiredEnv(
  "R2_SELECTED_WORK_BUCKET_NAME"
);

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  requiredEnv("DATABASE_URL_UNPOOLED");

const sql = neon(databaseUrl);

const rows = await sql`
  SELECT
    category,
    storage_key,
    display_filename,
    position
  FROM selected_work_items
  WHERE deleted_at IS NULL
  ORDER BY category, position
`;

const referencedKeys =
  new Set(
    rows.map(
      (row) => row.storage_key
    )
  );

const bucketKeys = new Set();

let continuationToken;

do {
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken:
        continuationToken,
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
  .filter(
    (key) => !bucketKeys.has(key)
  )
  .sort();

const extra = [...bucketKeys]
  .filter(
    (key) => !referencedKeys.has(key)
  )
  .sort();

console.log(
  `Active Selected Work rows: ${rows.length}`
);
console.log(
  `Unique Neon storage keys: ${referencedKeys.size}`
);
console.log(
  `R2 objects found: ${bucketKeys.size}`
);
console.log(
  `Referenced keys missing from R2: ${missing.length}`
);
console.log(
  `R2 objects not referenced by Neon: ${extra.length}`
);

if (missing.length) {
  console.error("");
  console.error("MISSING R2 OBJECTS:");

  for (const key of missing) {
    console.error(key);
  }

  process.exit(1);
}

if (extra.length) {
  console.error("");
  console.error("UNEXPECTED EXTRA R2 OBJECTS:");

  for (const key of extra) {
    console.error(key);
  }

  process.exit(1);
}

console.log("");
console.log(
  "SELECTED WORK R2 RECONCILIATION PASSED"
);
