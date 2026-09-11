import fs from "node:fs/promises";
import path from "node:path";

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

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

const snapshot = JSON.parse(
  await fs.readFile(
    new URL(
      "./migration-selected-work-source.json",
      import.meta.url
    ),
    "utf8"
  )
);

if (snapshot.total !== 47) {
  throw new Error(
    `Expected 47 Selected Work items, found ${snapshot.total}.`
  );
}

const root = process.cwd();

let uploaded = 0;
let skipped = 0;
let processed = 0;

async function objectExists(key) {
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    return true;
  } catch (error) {
    const status =
      error?.$metadata?.httpStatusCode;

    if (status === 404) {
      return false;
    }

    throw error;
  }
}

for (const category of [
  "production",
  "rehearsal",
  "campaign",
]) {
  for (
    const item of
    snapshot.categories[category]
  ) {
    const localPath = path.join(
      root,
      "public",
      "images",
      "selected-work",
      category,
      item.filename
    );

    const storageKey =
      `selected-work/${category}/${item.filename}`;

    const bytes =
      await fs.readFile(localPath);

    if (await objectExists(storageKey)) {
      skipped += 1;
    } else {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: bytes,
          ContentType: "image/jpeg",
        })
      );

      uploaded += 1;
    }

    processed += 1;

    console.log(
      `${processed}/47 ${storageKey}`
    );
  }
}

if (processed !== 47) {
  throw new Error(
    `Processed ${processed} objects instead of 47.`
  );
}

console.log("");
console.log(`Uploaded: ${uploaded}`);
console.log(`Already present: ${skipped}`);
console.log(`Total processed: ${processed}`);
console.log("");
console.log("MIGRATION COMPLETED");
