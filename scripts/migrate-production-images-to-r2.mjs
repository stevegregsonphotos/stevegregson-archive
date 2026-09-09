import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  readdir,
  readFile,
} from "node:fs/promises";
import path from "node:path";

function required(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

const client = new S3Client({
  region: "auto",
  endpoint: required("R2_PRODUCTIONS_ENDPOINT"),
  credentials: {
    accessKeyId: required("R2_PRODUCTIONS_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_PRODUCTIONS_SECRET_ACCESS_KEY"),
  },
});

const Bucket = required(
  "R2_PRODUCTIONS_BUCKET_NAME",
);

const sourceRoot = path.resolve(
  "public",
  "images",
  "productions",
);

async function collectFiles(directory) {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });

  const files = [];

  for (const entry of entries) {
    const filepath = path.join(
      directory,
      entry.name,
    );

    if (entry.isDirectory()) {
      files.push(
        ...(await collectFiles(filepath)),
      );
    } else if (entry.isFile()) {
      files.push(filepath);
    }
  }

  return files;
}

async function objectExists(Key) {
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket,
        Key,
      }),
    );

    return true;
  } catch (error) {
    if (
      error?.$metadata?.httpStatusCode === 404
    ) {
      return false;
    }

    throw error;
  }
}

const files = await collectFiles(sourceRoot);

console.log(
  `Found ${files.length} local production image files.`,
);

let uploaded = 0;
let skipped = 0;
let failed = 0;

for (const [index, filepath] of files.entries()) {
  const Key = path
    .relative(sourceRoot, filepath)
    .split(path.sep)
    .join("/");

  try {
    if (await objectExists(Key)) {
      skipped += 1;

      console.log(
        `[${index + 1}/${files.length}] SKIP ${Key}`,
      );

      continue;
    }

    const Body = await readFile(filepath);

    await client.send(
      new PutObjectCommand({
        Bucket,
        Key,
        Body,
        ContentType:
          path.extname(filepath).toLowerCase() === ".webp"
            ? "image/webp"
            : path.extname(filepath).toLowerCase() === ".png"
              ? "image/png"
              : "image/jpeg",
      }),
    );

    uploaded += 1;

    console.log(
      `[${index + 1}/${files.length}] UPLOAD ${Key}`,
    );
  } catch (error) {
    failed += 1;

    console.error(
      `[${index + 1}/${files.length}] FAILED ${Key}`,
      error,
    );
  }
}

console.log("");
console.log("=== MIGRATION COMPLETE ===");
console.log(`Local files: ${files.length}`);
console.log(`Uploaded: ${uploaded}`);
console.log(`Already present: ${skipped}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exitCode = 1;
}
