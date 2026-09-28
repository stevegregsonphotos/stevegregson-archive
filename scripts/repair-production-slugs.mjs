import {
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { neon } from "@neondatabase/serverless";

const APPLY =
  process.argv.includes("--apply");

const repairs = [
  {
    from: "g-tterd-mmerung",
    to: "gotterdammerung",
    title: "Götterdämmerung",
  },
  {
    from: "die-walk-re",
    to: "die-walkure",
    title: "Die Walküre",
  },
  {
    from:
      "die-walk-re-york-hall-bethnal-green-london-february-2025",
    to:
      "die-walkure-york-hall-bethnal-green-london-february-2025",
    title: "Die Walküre",
  },
];

function requiredEnv(name) {
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
  process.env.DATABASE_URL ||
  requiredEnv(
    "DATABASE_URL_UNPOOLED",
  );

const sql = neon(databaseUrl);

const client = new S3Client({
  region: "auto",
  endpoint: requiredEnv(
    "R2_PRODUCTIONS_ENDPOINT",
  ),
  credentials: {
    accessKeyId: requiredEnv(
      "R2_PRODUCTIONS_ACCESS_KEY_ID",
    ),
    secretAccessKey: requiredEnv(
      "R2_PRODUCTIONS_SECRET_ACCESS_KEY",
    ),
  },
});

const bucket = requiredEnv(
  "R2_PRODUCTIONS_BUCKET_NAME",
);

async function listKeys(prefix) {
  const keys = [];
  let continuationToken;

  do {
    const response =
      await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: `${prefix}/`,
          ContinuationToken:
            continuationToken,
        }),
      );

    for (
      const object of
      response.Contents ?? []
    ) {
      if (object.Key) {
        keys.push(
          object.Key,
        );
      }
    }

    continuationToken =
      response.IsTruncated
        ? response
            .NextContinuationToken
        : undefined;
  } while (
    continuationToken
  );

  return keys.sort();
}

async function objectExists(key) {
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    return true;
  } catch (error) {
    const status =
      typeof error ===
        "object" &&
      error !== null &&
      "$metadata" in error
        ? error.$metadata
            ?.httpStatusCode
        : undefined;

    if (status === 404) {
      return false;
    }

    throw error;
  }
}

function destinationKey(
  sourceKey,
  from,
  to,
) {
  return `${to}/${sourceKey.slice(
    from.length + 1,
  )}`;
}

async function copyObject(
  sourceKey,
  targetKey,
) {
  const encodedSource =
    sourceKey
      .split("/")
      .map((part) =>
        encodeURIComponent(
          part,
        ),
      )
      .join("/");

  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: targetKey,
      CopySource:
        `${bucket}/${encodedSource}`,
    }),
  );
}

console.log(
  APPLY
    ? "\nPRODUCTION SLUG REPAIR — APPLY MODE"
    : "\nPRODUCTION SLUG REPAIR — DRY RUN ONLY",
);

const plans = [];
let failures = 0;

for (const repair of repairs) {
  console.log(
    `\n=== ${repair.from} -> ${repair.to} ===`,
  );

  const sourceRows =
    await sql`
      SELECT
        id,
        slug,
        title,
        venue,
        month,
        year,
        hero_storage_key,
        hero_display_filename
      FROM productions
      WHERE deleted_at IS NULL
        AND lower(slug) =
          lower(${repair.from})
      LIMIT 1
    `;

  const source =
    sourceRows[0];

  if (!source) {
    console.error(
      `FAIL: source production not found: ${repair.from}`,
    );
    failures += 1;
    continue;
  }

  const targetRows =
    await sql`
      SELECT slug
      FROM productions
      WHERE deleted_at IS NULL
        AND lower(slug) =
          lower(${repair.to})
      LIMIT 1
    `;

  if (targetRows[0]) {
    console.error(
      `FAIL: target slug already exists in Neon: ${repair.to}`,
    );
    failures += 1;
    continue;
  }

  const imageRows =
    await sql`
      SELECT
        id,
        storage_key,
        display_filename
      FROM production_images
      WHERE deleted_at IS NULL
        AND production_id =
          ${source.id}
      ORDER BY position
    `;

  const sourceKeys =
    await listKeys(
      repair.from,
    );

  const targetKeys =
    await listKeys(
      repair.to,
    );

  if (
    targetKeys.length >
    0
  ) {
    console.error(
      `FAIL: target R2 prefix is not empty: ${repair.to}`,
    );
    failures += 1;
    continue;
  }

  const expectedKeys =
    new Set([
      source.hero_storage_key,
      ...imageRows.map(
        (row) =>
          row.storage_key,
      ),
    ]);

  const missing =
    [...expectedKeys].filter(
      (key) =>
        !sourceKeys.includes(
          key,
        ),
    );

  if (
    missing.length >
    0
  ) {
    console.error(
      `FAIL: ${missing.length} referenced R2 object(s) are missing.`,
    );

    for (
      const key of
      missing
    ) {
      console.error(
        `  ${key}`,
      );
    }

    failures += 1;
    continue;
  }

  const extraR2 =
    sourceKeys.filter(
      (key) =>
        !expectedKeys.has(
          key,
        ),
    );

  if (
    extraR2.length >
    0
  ) {
    console.error(
      `FAIL: ${extraR2.length} unexpected R2 object(s) exist under ${repair.from}.`,
    );

    for (
      const key of
      extraR2
    ) {
      console.error(
        `  ${key}`,
      );
    }

    failures += 1;
    continue;
  }

  const copyPlan =
    sourceKeys.map(
      (sourceKey) => ({
        sourceKey,
        targetKey:
          destinationKey(
            sourceKey,
            repair.from,
            repair.to,
          ),
      }),
    );

  const nextHeroStorageKey =
    `${repair.to}/${source.hero_display_filename}`;

  const nextImageStorageKeys =
    imageRows.map(
      (row) => ({
        id: row.id,
        from:
          row.storage_key,
        to:
          `${repair.to}/${row.display_filename}`,
      }),
    );

  console.log(
    `Title: ${source.title} -> ${repair.title}`,
  );
  console.log(
    `Venue: ${source.venue}`,
  );
  console.log(
    `Date: ${source.month ?? "?"}/${source.year}`,
  );
  console.log(
    `R2 source objects: ${sourceKeys.length}`,
  );
  console.log(
    `Gallery rows: ${imageRows.length}`,
  );
  console.log(
    `Hero storage key: ${source.hero_storage_key} -> ${nextHeroStorageKey}`,
  );
  console.log(
    `R2 objects to copy: ${copyPlan.length}`,
  );
  console.log(
    `Neon image storage keys to update: ${nextImageStorageKeys.length}`,
  );
  console.log(
    "PLAN PASS",
  );

  plans.push({
    repair,
    source,
    copyPlan,
    nextHeroStorageKey,
    nextImageStorageKeys,
  });
}

console.log("");

if (
  failures > 0
) {
  console.error(
    `PRECHECK FAILED: ${failures} repair(s) require attention.`,
  );
  process.exit(1);
}

if (!APPLY) {
  console.log(
    "DRY RUN PASSED: all planned production slug repairs are safe to prepare.",
  );
  console.log(
    "No Neon or R2 writes were made.",
  );
  process.exit(0);
}

console.log(
  "STAGE 1 — COPYING R2 OBJECTS",
);

for (
  const plan of
  plans
) {
  console.log(
    `\nCopying ${plan.copyPlan.length} objects: ${plan.repair.from} -> ${plan.repair.to}`,
  );

  const concurrency = 8;

  for (
    let index = 0;
    index <
    plan.copyPlan.length;
    index += concurrency
  ) {
    const batch =
      plan.copyPlan.slice(
        index,
        index +
          concurrency,
      );

    await Promise.all(
      batch.map(
        ({
          sourceKey,
          targetKey,
        }) =>
          copyObject(
            sourceKey,
            targetKey,
          ),
      ),
    );

    console.log(
      `  copied ${Math.min(
        index +
          concurrency,
        plan.copyPlan
          .length,
      )}/${plan.copyPlan.length}`,
    );
  }
}

console.log(
  "\nSTAGE 2 — VERIFYING COPIED R2 OBJECTS",
);

for (
  const plan of
  plans
) {
  const concurrency = 12;

  for (
    let index = 0;
    index <
    plan.copyPlan.length;
    index += concurrency
  ) {
    const batch =
      plan.copyPlan.slice(
        index,
        index +
          concurrency,
      );

    const results =
      await Promise.all(
        batch.map(
          async ({
            targetKey,
          }) => ({
            targetKey,
            exists:
              await objectExists(
                targetKey,
              ),
          }),
        ),
      );

    const missing =
      results.filter(
        (result) =>
          !result.exists,
      );

    if (
      missing.length >
      0
    ) {
      console.error(
        "COPY VERIFICATION FAILED.",
      );

      for (
        const item of
        missing
      ) {
        console.error(
          `  ${item.targetKey}`,
        );
      }

      console.error(
        "Neon was not changed. Old R2 prefixes remain intact.",
      );

      process.exit(1);
    }
  }

  console.log(
    `Verified ${plan.copyPlan.length}: ${plan.repair.to}`,
  );
}

console.log(
  "\nSTAGE 3 — UPDATING NEON TRANSACTIONALLY",
);

const queries = [];

for (
  const plan of
  plans
) {
  queries.push(
    sql`
      UPDATE productions
      SET
        slug =
          ${plan.repair.to},
        title =
          ${plan.repair.title},
        hero_storage_key =
          ${plan.nextHeroStorageKey},
        version =
          version + 1,
        updated_at =
          now()
      WHERE id =
        ${plan.source.id}
        AND deleted_at
          IS NULL
        AND lower(slug) =
          lower(${plan.repair.from})
      RETURNING id
    `,
  );

  for (
    const image of
    plan.nextImageStorageKeys
  ) {
    queries.push(
      sql`
        UPDATE production_images
        SET
          storage_key =
            ${image.to},
          updated_at =
            now()
        WHERE id =
          ${image.id}
          AND production_id =
            ${plan.source.id}
          AND deleted_at
            IS NULL
          AND storage_key =
            ${image.from}
        RETURNING id
      `,
    );
  }
}

const results =
  await sql.transaction(
    queries,
  );

const failedUpdates =
  results.filter(
    (rows) =>
      rows.length !== 1,
  );

if (
  failedUpdates.length >
  0
) {
  throw new Error(
    `Unexpected Neon update result for ${failedUpdates.length} statement(s).`,
  );
}

console.log(
  `Neon updates committed: ${results.length}`,
);

console.log(
  "\nSTAGE 4 — VERIFYING NEW LIVE DATA",
);

for (
  const plan of
  plans
) {
  const rows =
    await sql`
      SELECT
        slug,
        title,
        hero_storage_key
      FROM productions
      WHERE id =
        ${plan.source.id}
        AND deleted_at
          IS NULL
      LIMIT 1
    `;

  const row =
    rows[0];

  if (
    !row ||
    row.slug !==
      plan.repair.to ||
    row.title !==
      plan.repair.title ||
    row.hero_storage_key !==
      plan.nextHeroStorageKey
  ) {
    throw new Error(
      `Post-update verification failed for ${plan.repair.to}.`,
    );
  }

  const targetKeys =
    await listKeys(
      plan.repair.to,
    );

  if (
    targetKeys.length !==
    plan.copyPlan.length
  ) {
    throw new Error(
      `R2 target count mismatch for ${plan.repair.to}: expected ${plan.copyPlan.length}, found ${targetKeys.length}.`,
    );
  }

  console.log(
    `PASS: ${plan.repair.to} — ${targetKeys.length} R2 objects`,
  );
}

console.log(
  "\nPRODUCTION SLUG REPAIR COMPLETE.",
);
console.log(
  "Old R2 prefixes were intentionally retained for rollback.",
);
console.log(
  "Do not delete the old R2 prefixes until the deployed site, redirects, sitemap and production images have been verified.",
);
