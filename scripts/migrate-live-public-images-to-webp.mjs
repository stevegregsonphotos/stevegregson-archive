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

const EXPECTED = {
  heroes: 7,
  gallery: 91,
  selected: 44,
};

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

function makeClient(
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
  makeClient(
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
  makeClient(
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

const sql =
  neon(databaseUrl);

function webpFilename(filename) {
  if (
    !/\.(?:jpe?g)$/i.test(
      filename,
    )
  ) {
    throw new Error(
      `Not a JPEG filename: ${filename}`,
    );
  }

  return filename.replace(
    /\.(?:jpe?g)$/i,
    ".webp",
  );
}

function webpKey(key) {
  return key.replace(
    /\.(?:jpe?g)$/i,
    ".webp",
  );
}

async function head(
  client,
  bucket,
  key,
) {
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

async function read(
  client,
  bucket,
  key,
) {
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

async function bestSourceKey(
  client,
  bucket,
  key,
) {
  const backup =
    `__performance-originals/${key}`;

  if (
    await head(
      client,
      bucket,
      backup,
    )
  ) {
    return backup;
  }

  return key;
}

async function prepareWebp({
  client,
  bucket,
  sourceKey,
  destinationKey,
  maxWidth,
}) {
  if (
    await head(
      client,
      bucket,
      destinationKey,
    )
  ) {
    throw new Error(
      `Destination already exists: ${destinationKey}`,
    );
  }

  const actualSourceKey =
    await bestSourceKey(
      client,
      bucket,
      sourceKey,
    );

  const bytes =
    await read(
      client,
      bucket,
      actualSourceKey,
    );

  const transformed =
    await sharp(
      bytes,
      {
        failOn: "none",
      },
    )
      .rotate()
      .resize({
        width: maxWidth,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: 82,
        effort: 6,
        smartSubsample: true,
      })
      .toBuffer({
        resolveWithObject: true,
      });

  if (
    !transformed.info.width ||
    !transformed.info.height
  ) {
    throw new Error(
      `Could not determine output dimensions for ${sourceKey}.`,
    );
  }

  return {
    sourceKey,
    actualSourceKey,
    destinationKey,
    body:
      transformed.data,
    width:
      transformed.info.width,
    height:
      transformed.info.height,
  };
}

async function uploadWebp(
  client,
  bucket,
  item,
) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key:
        item.destinationKey,
      Body:
        item.body,
      ContentType:
        "image/webp",
      CacheControl:
        CACHE_CONTROL,
    }),
  );

  const verified =
    await head(
      client,
      bucket,
      item.destinationKey,
    );

  if (!verified) {
    throw new Error(
      `Uploaded WebP could not be verified: ${item.destinationKey}`,
    );
  }

  const contentType =
    verified.ContentType?.toLowerCase();

  if (
    contentType !==
    "image/webp"
  ) {
    throw new Error(
      `Unexpected Content-Type for ${item.destinationKey}: ${contentType}`,
    );
  }
}

console.log(
  "\n=== WEBP MIGRATION PREFLIGHT ===\n",
);

const heroRows =
  await sql`
    SELECT
      id,
      slug,
      hero_storage_key,
      hero_display_filename
    FROM productions
    WHERE deleted_at IS NULL
      AND hero_display_filename
        IS NOT NULL
      AND LOWER(
        hero_display_filename
      ) !~ '\\.webp$'
    ORDER BY slug
  `;

const galleryRows =
  await sql`
    SELECT
      pi.id,
      pi.production_id,
      p.slug,
      pi.storage_key,
      pi.display_filename
    FROM production_images pi
    JOIN productions p
      ON p.id =
        pi.production_id
    WHERE
      pi.deleted_at IS NULL
      AND p.deleted_at IS NULL
      AND LOWER(
        pi.display_filename
      ) !~ '\\.webp$'
    ORDER BY
      p.slug,
      pi.position
  `;

const selectedRows =
  await sql`
    SELECT
      id,
      category,
      storage_key,
      display_filename,
      original_display_filename
    FROM selected_work_items
    WHERE deleted_at IS NULL
      AND LOWER(
        display_filename
      ) !~ '\\.webp$'
    ORDER BY
      category,
      position
  `;

console.log(
  `Production heroes: ${heroRows.length}`,
);
console.log(
  `Production gallery: ${galleryRows.length}`,
);
console.log(
  `Selected Work: ${selectedRows.length}`,
);

if (
  heroRows.length !==
    EXPECTED.heroes ||
  galleryRows.length !==
    EXPECTED.gallery ||
  selectedRows.length !==
    EXPECTED.selected
) {
  throw new Error(
    `STOP: expected ${EXPECTED.heroes} heroes + ${EXPECTED.gallery} gallery + ${EXPECTED.selected} Selected Work, found ${heroRows.length} + ${galleryRows.length} + ${selectedRows.length}.`,
  );
}

const total =
  heroRows.length +
  galleryRows.length +
  selectedRows.length;

if (total !== 142) {
  throw new Error(
    `STOP: expected 142 records, found ${total}.`,
  );
}

const destinationKeys =
  new Set();

function reserve(
  destinationKey,
) {
  if (
    destinationKeys.has(
      destinationKey,
    )
  ) {
    throw new Error(
      `Duplicate migration destination: ${destinationKey}`,
    );
  }

  destinationKeys.add(
    destinationKey,
  );
}

for (const row of heroRows) {
  reserve(
    webpKey(
      row.hero_storage_key,
    ),
  );
}

for (
  const row of galleryRows
) {
  reserve(
    webpKey(
      row.storage_key,
    ),
  );
}

for (
  const row of selectedRows
) {
  reserve(
    webpKey(
      row.storage_key,
    ),
  );
}

console.log(
  "\nChecking source objects and destination collisions…",
);

for (const row of heroRows) {
  if (
    !await head(
      productionClient,
      productionBucket,
      row.hero_storage_key,
    )
  ) {
    throw new Error(
      `Missing production hero: ${row.hero_storage_key}`,
    );
  }

  const destination =
    webpKey(
      row.hero_storage_key,
    );

  if (
    await head(
      productionClient,
      productionBucket,
      destination,
    )
  ) {
    throw new Error(
      `Destination already exists: ${destination}`,
    );
  }
}

for (
  const row of galleryRows
) {
  if (
    !await head(
      productionClient,
      productionBucket,
      row.storage_key,
    )
  ) {
    throw new Error(
      `Missing production gallery image: ${row.storage_key}`,
    );
  }

  const destination =
    webpKey(
      row.storage_key,
    );

  if (
    await head(
      productionClient,
      productionBucket,
      destination,
    )
  ) {
    throw new Error(
      `Destination already exists: ${destination}`,
    );
  }
}

for (
  const row of selectedRows
) {
  if (
    !await head(
      selectedClient,
      selectedBucket,
      row.storage_key,
    )
  ) {
    throw new Error(
      `Missing Selected Work image: ${row.storage_key}`,
    );
  }

  const destination =
    webpKey(
      row.storage_key,
    );

  if (
    await head(
      selectedClient,
      selectedBucket,
      destination,
    )
  ) {
    throw new Error(
      `Destination already exists: ${destination}`,
    );
  }
}

console.log(
  "Preflight PASS — all 142 source records are present and all WebP destinations are free.",
);

console.log(
  "\n=== CREATING WEBP OBJECTS ===\n",
);

const heroPlan = [];
const galleryPlan = [];
const selectedPlan = [];

const concurrency = 3;

async function processBatches(
  rows,
  worker,
) {
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
        batch.map(worker),
      );

    for (
      const result of results
    ) {
      console.log(
        `${result.sourceKey} -> ${result.destinationKey} (${(result.body.length / 1024 / 1024).toFixed(2)} MB)`,
      );
    }
  }
}

await processBatches(
  heroRows,
  async (row) => {
    const item =
      await prepareWebp({
        client:
          productionClient,
        bucket:
          productionBucket,
        sourceKey:
          row.hero_storage_key,
        destinationKey:
          webpKey(
            row.hero_storage_key,
          ),
        maxWidth: 2560,
      });

    await uploadWebp(
      productionClient,
      productionBucket,
      item,
    );

    heroPlan.push({
      row,
      ...item,
      filename:
        webpFilename(
          row.hero_display_filename,
        ),
    });

    return item;
  },
);

await processBatches(
  galleryRows,
  async (row) => {
    const item =
      await prepareWebp({
        client:
          productionClient,
        bucket:
          productionBucket,
        sourceKey:
          row.storage_key,
        destinationKey:
          webpKey(
            row.storage_key,
          ),
        maxWidth: 2560,
      });

    await uploadWebp(
      productionClient,
      productionBucket,
      item,
    );

    galleryPlan.push({
      row,
      ...item,
      filename:
        webpFilename(
          row.display_filename,
        ),
    });

    return item;
  },
);

await processBatches(
  selectedRows,
  async (row) => {
    const item =
      await prepareWebp({
        client:
          selectedClient,
        bucket:
          selectedBucket,
        sourceKey:
          row.storage_key,
        destinationKey:
          webpKey(
            row.storage_key,
          ),
        maxWidth: 2400,
      });

    await uploadWebp(
      selectedClient,
      selectedBucket,
      item,
    );

    selectedPlan.push({
      row,
      ...item,
      filename:
        webpFilename(
          row.display_filename,
        ),
    });

    return item;
  },
);

console.log(
  "\nAll new R2 WebP objects verified.",
);

console.log(
  "\n=== UPDATING NEON ===\n",
);

const queries = [];

for (
  const item of heroPlan
) {
  queries.push(
    sql`
      UPDATE productions
      SET
        hero_storage_key =
          ${item.destinationKey},
        hero_display_filename =
          ${item.filename},
        version =
          version + 1,
        updated_at =
          now()
      WHERE id =
        ${item.row.id}
        AND deleted_at
          IS NULL
        AND hero_storage_key =
          ${item.row.hero_storage_key}
      RETURNING id
    `,
  );
}

for (
  const item of galleryPlan
) {
  queries.push(
    sql`
      UPDATE production_images
      SET
        storage_key =
          ${item.destinationKey},
        display_filename =
          ${item.filename},
        original_display_filename =
          COALESCE(
            original_display_filename,
            ${item.row.display_filename}
          ),
        updated_at =
          now()
      WHERE id =
        ${item.row.id}
        AND deleted_at
          IS NULL
        AND storage_key =
          ${item.row.storage_key}
      RETURNING id
    `,
  );
}

for (
  const item of selectedPlan
) {
  queries.push(
    sql`
      UPDATE selected_work_items
      SET
        storage_key =
          ${item.destinationKey},
        display_filename =
          ${item.filename},
        original_display_filename =
          COALESCE(
            original_display_filename,
            ${item.row.display_filename}
          ),
        width =
          ${item.width},
        height =
          ${item.height},
        version =
          version + 1,
        updated_at =
          now()
      WHERE id =
        ${item.row.id}
        AND deleted_at
          IS NULL
        AND storage_key =
          ${item.row.storage_key}
      RETURNING id
    `,
  );
}

const results =
  await sql.transaction(
    queries,
  );

const failed =
  results
    .map(
      (result, index) => ({
        index,
        count:
          result.length,
      }),
    )
    .filter(
      (result) =>
        result.count !== 1,
    );

if (
  failed.length > 0
) {
  throw new Error(
    `Neon migration did not update exactly one row for ${failed.length} record(s). New WebP objects were left in R2, but old database references remain transactionally unchanged.`,
  );
}

console.log(
  `Neon transaction PASS — ${results.length} records updated.`,
);

const remainingHeroes =
  await sql`
    SELECT COUNT(*)::int AS count
    FROM productions
    WHERE deleted_at IS NULL
      AND hero_display_filename
        IS NOT NULL
      AND LOWER(
        hero_display_filename
      ) !~ '\\.webp$'
  `;

const remainingGallery =
  await sql`
    SELECT COUNT(*)::int AS count
    FROM production_images pi
    JOIN productions p
      ON p.id =
        pi.production_id
    WHERE
      pi.deleted_at IS NULL
      AND p.deleted_at IS NULL
      AND LOWER(
        pi.display_filename
      ) !~ '\\.webp$'
  `;

const remainingSelected =
  await sql`
    SELECT COUNT(*)::int AS count
    FROM selected_work_items
    WHERE deleted_at IS NULL
      AND LOWER(
        display_filename
      ) !~ '\\.webp$'
  `;

console.log(
  "\n=== POST-MIGRATION DATABASE AUDIT ===",
);
console.log(
  `Non-WebP heroes: ${remainingHeroes[0].count}`,
);
console.log(
  `Non-WebP gallery: ${remainingGallery[0].count}`,
);
console.log(
  `Non-WebP Selected Work: ${remainingSelected[0].count}`,
);

if (
  remainingHeroes[0].count !== 0 ||
  remainingGallery[0].count !== 0 ||
  remainingSelected[0].count !== 0
) {
  throw new Error(
    "STOP: non-WebP public records remain after migration.",
  );
}

console.log(
  "\nWEBP MIGRATION COMPLETE.",
);
console.log(
  "Old JPEG R2 objects have deliberately NOT been deleted.",
);
