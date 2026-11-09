import { neon } from "@neondatabase/serverless";

import type {
  ProofingGallery,
  ProofingImage,
  ProofingVisitor,
} from "./types";

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured.",
    );
  }

  return neon(databaseUrl);
}

type GalleryRow = {
  data: unknown;
};

type ProofingImageRow = {
  id: string;
  gallery_id: string;
  original_filename: string;
  web_filename: string;
  width: number;
  height: number;
  alt: string;
  sort_order: number;
  created_at: string | Date;
  blur_data_url: string | null;
};

function mapGallery(
  row: GalleryRow,
): ProofingGallery {
  return row.data as ProofingGallery;
}

function mapProofingImage(
  row: ProofingImageRow,
): ProofingImage {
  return {
    id: row.id,
    originalFilename: row.original_filename,
    webFilename: row.web_filename,
    width: Number(row.width),
    height: Number(row.height),
    alt: row.alt,
    sortOrder: Number(row.sort_order),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
    ...(row.blur_data_url
      ? {
          blurDataURL:
            row.blur_data_url,
        }
      : {}),
  };
}

function galleryForStorage(
  gallery: ProofingGallery,
): ProofingGallery {
  return {
    ...gallery,
    images: [],
    // Visitors live in their own table (proofing_visitors), so a busy
    // gallery's record stays small however many people visit it.
    visitors: [],
  };
}

function attachImages(
  gallery: ProofingGallery,
  imageRows: ProofingImageRow[],
) {
  return {
    ...gallery,
    images:
      imageRows
        .map(mapProofingImage)
        .sort(
          (first, second) =>
            first.sortOrder -
            second.sortOrder,
        ),
  };
}


/* ---------------------------------------------------------------------
 * Visitors
 *
 * Each person who signs in to a gallery (and their favourites) is one row
 * in proofing_visitors, instead of all of them living inside the gallery's
 * own record. Signing in or favouriting then reads and saves just that one
 * small row, so a graduation gallery shared with thousands of people stays
 * quick and doesn't use up the free database's data allowance.
 *
 * Public pages only ever load the signed-in visitor (from their cookie);
 * Backstage loads everyone. Older galleries' visitors are moved across
 * automatically, and any not yet moved are still counted.
 * ------------------------------------------------------------------- */

type VisitorRow = {
  gallery_id: string;
  id: string;
  data: ProofingVisitor;
  version: number;
};

let visitorStorePromise: Promise<void> | null = null;

function ensureVisitorStore() {
  visitorStorePromise ??= (async () => {
    const sql = getSql();
    await sql.query(
      "CREATE TABLE IF NOT EXISTS proofing_visitors (gallery_id text NOT NULL, id text NOT NULL, email text NOT NULL, data jsonb NOT NULL, version integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (gallery_id, id))",
    );
    await sql.query(
      "CREATE INDEX IF NOT EXISTS proofing_visitors_email_idx ON proofing_visitors (gallery_id, email)",
    );
    await moveVisitorsOutOfGalleries();
  })().catch((error) => {
    visitorStorePromise = null; // try again next time
    throw error;
  });
  return visitorStorePromise;
}

const VISITORS_IN_JSON = `CASE WHEN jsonb_typeof(g.data->'visitors') = 'array' THEN g.data->'visitors' ELSE '[]'::jsonb END`;

/**
 * Copies visitors still stored inside gallery records into the visitors
 * table, then removes from each record only the ones now safely copied.
 * Safe to run any number of times. `galleryId` limits it to one gallery.
 */
async function moveVisitorsOutOfGalleries(galleryId?: string) {
  const sql = getSql();
  const where = galleryId ? "AND g.id::text = $1" : "";
  const params = galleryId ? [galleryId] : [];
  await sql.query(
    `INSERT INTO proofing_visitors (gallery_id, id, email, data)
     SELECT g.id::text, v->>'id', lower(coalesce(v->>'email', '')), v
     FROM proofing_galleries g, jsonb_array_elements(${VISITORS_IN_JSON}) AS v
     WHERE coalesce(v->>'id', '') <> '' ${where}
     ON CONFLICT (gallery_id, id) DO NOTHING`,
    params,
  );
  await sql.query(
    `UPDATE proofing_galleries g
     SET data = jsonb_set(g.data, '{visitors}', coalesce((
       SELECT jsonb_agg(v)
       FROM jsonb_array_elements(${VISITORS_IN_JSON}) AS v
       WHERE NOT EXISTS (
         SELECT 1 FROM proofing_visitors pv
         WHERE pv.gallery_id = g.id::text AND pv.id = v->>'id'
       )
     ), '[]'::jsonb))
     WHERE jsonb_typeof(g.data->'visitors') = 'array'
       AND jsonb_array_length(g.data->'visitors') > 0 ${where}`,
    params,
  );
}

/** Visitors not yet moved out of the gallery record (normally none). */
function leftoverVisitors(gallery: ProofingGallery, known: Set<string>) {
  return (Array.isArray(gallery.visitors) ? gallery.visitors : []).filter(
    (visitor) => visitor && !known.has(visitor.id),
  );
}

function sortVisitors(visitors: ProofingVisitor[]) {
  return visitors.sort((a, b) =>
    String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")),
  );
}

/** Every visitor of one gallery (Backstage). */
export async function listProofingVisitors(
  galleryId: string,
): Promise<ProofingVisitor[]> {
  await ensureVisitorStore();
  const rows = await getSql().query(
    "SELECT data FROM proofing_visitors WHERE gallery_id = $1",
    [galleryId],
  );
  return (rows as Array<{ data: ProofingVisitor }>).map((row) => row.data);
}

async function withAllVisitors(
  gallery: ProofingGallery,
): Promise<ProofingGallery> {
  const visitors = await listProofingVisitors(gallery.id);
  const known = new Set(visitors.map((visitor) => visitor.id));
  return {
    ...gallery,
    visitors: sortVisitors([...visitors, ...leftoverVisitors(gallery, known)]),
  };
}

/** One visitor of one gallery, or undefined. */
export async function getProofingVisitor(
  galleryId: string,
  visitorId: string,
): Promise<ProofingVisitor | undefined> {
  if (!visitorId) return undefined;
  await ensureVisitorStore();
  const rows = await getSql().query(
    "SELECT data FROM proofing_visitors WHERE gallery_id = $1 AND id = $2",
    [galleryId, visitorId],
  );
  return (rows[0] as { data: ProofingVisitor } | undefined)?.data;
}

/** The visitor signed in to this gallery in the current request (cookie). */
async function currentVisitorId(galleryId: string) {
  try {
    const { cookies } = await import("next/headers");
    return (await cookies()).get(`proofing_${galleryId}`)?.value;
  } catch {
    return undefined; // not inside a request (e.g. a build)
  }
}

/**
 * For public pages: the gallery with only the signed-in visitor attached
 * (or none), so pages never load everyone else's details.
 */
async function withCurrentVisitor(
  gallery: ProofingGallery,
): Promise<ProofingGallery> {
  const visitorId = await currentVisitorId(gallery.id);
  const leftovers = Array.isArray(gallery.visitors) ? gallery.visitors : [];
  let visitor = visitorId
    ? await getProofingVisitor(gallery.id, visitorId)
    : undefined;
  if (!visitor && visitorId) {
    visitor = leftovers.find((candidate) => candidate?.id === visitorId);
  }
  return { ...gallery, visitors: visitor ? [visitor] : [] };
}

/**
 * Changes one visitor safely: only saves if nobody else changed that
 * visitor since it was read (e.g. two quick favourite clicks), otherwise
 * re-reads and tries again. `updater` may run more than once.
 */
export async function updateProofingVisitor(
  galleryId: string,
  visitorId: string,
  updater: (visitor: ProofingVisitor) => ProofingVisitor,
): Promise<ProofingVisitor | undefined> {
  await ensureVisitorStore();
  const sql = getSql();

  for (let attempt = 0; attempt < 12; attempt += 1) {
    let rows = (await sql.query(
      "SELECT gallery_id, id, data, version FROM proofing_visitors WHERE gallery_id = $1 AND id = $2",
      [galleryId, visitorId],
    )) as VisitorRow[];

    if (!rows[0] && attempt === 0) {
      // Perhaps an older visitor not yet moved out of the gallery record.
      await moveVisitorsOutOfGalleries(galleryId);
      rows = (await sql.query(
        "SELECT gallery_id, id, data, version FROM proofing_visitors WHERE gallery_id = $1 AND id = $2",
        [galleryId, visitorId],
      )) as VisitorRow[];
    }

    const row = rows[0];
    if (!row) return undefined;

    const updated = updater(row.data);
    const saved = await sql.query(
      "UPDATE proofing_visitors SET data = $1::jsonb, email = $2, version = version + 1, updated_at = now() WHERE gallery_id = $3 AND id = $4 AND version = $5 RETURNING id",
      [JSON.stringify(updated), String(updated.email ?? "").toLowerCase(), galleryId, visitorId, row.version],
    );
    if (saved[0]) return updated;

    await new Promise((resolve) =>
      setTimeout(resolve, 10 + Math.random() * 30 * (attempt + 1)),
    );
  }

  throw new Error("Your selection couldn't be saved just now. Please try again.");
}

/**
 * Signs someone in to a gallery by email: returns their visitor code,
 * creating a visitor the first time. If the same email somehow has more
 * than one visitor (older galleries), they are merged into one.
 */
export async function signInProofingVisitor(
  galleryId: string,
  email: string,
): Promise<string> {
  await ensureVisitorStore();
  const sql = getSql();
  const normalisedEmail = email.trim().toLowerCase();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const rows = (await sql.query(
      "SELECT gallery_id, id, data, version FROM proofing_visitors WHERE gallery_id = $1 AND email = $2 ORDER BY data->>'createdAt', id",
      [galleryId, normalisedEmail],
    )) as VisitorRow[];

    const now = new Date().toISOString();

    if (rows.length === 0) {
      const id = crypto.randomUUID();
      const visitor: ProofingVisitor = {
        id,
        email: normalisedEmail,
        createdAt: now,
        lastSeenAt: now,
        selection: { status: "not-started", favourites: [] },
      };
      // Only if nobody with this email appeared meanwhile.
      const inserted = await sql.query(
        `INSERT INTO proofing_visitors (gallery_id, id, email, data)
         SELECT $1, $2, $3, $4::jsonb
         WHERE NOT EXISTS (SELECT 1 FROM proofing_visitors WHERE gallery_id = $1 AND email = $3)
         RETURNING id`,
        [galleryId, id, normalisedEmail, JSON.stringify(visitor)],
      );
      if (inserted[0]) return id;
      continue; // someone else just signed in with this email: use theirs
    }

    const keep = rows[0];

    if (rows.length === 1) {
      await sql.query(
        "UPDATE proofing_visitors SET data = jsonb_set(data, '{lastSeenAt}', to_jsonb($1::text)), updated_at = now() WHERE gallery_id = $2 AND id = $3",
        [now, galleryId, keep.id],
      );
      return keep.id;
    }

    // Merge duplicates (same rules as before): all favourites, the latest
    // submission, and "in progress" if any of them was.
    const visitors = rows.map((row) => row.data);
    const favouriteByImageId = new Map(
      visitors.flatMap((visitor) =>
        (visitor.selection?.favourites ?? []).map((favourite) => [favourite.imageId, favourite] as const),
      ),
    );
    const latestSubmitted = visitors
      .filter((visitor) => Boolean(visitor.selection?.submittedAt))
      .sort((a, b) => new Date(b.selection.submittedAt as string).getTime() - new Date(a.selection.submittedAt as string).getTime())[0];
    const favourites = [...favouriteByImageId.values()];
    const status = visitors.some((visitor) => visitor.selection?.status === "in-progress")
      ? "in-progress"
      : latestSubmitted
        ? "submitted"
        : favourites.length > 0
          ? "in-progress"
          : "not-started";
    const merged: ProofingVisitor = {
      ...keep.data,
      email: normalisedEmail,
      lastSeenAt: now,
      selection: {
        ...keep.data.selection,
        favourites,
        status,
        submittedFavourites: latestSubmitted?.selection.submittedFavourites ?? keep.data.selection?.submittedFavourites,
        submittedAt: latestSubmitted?.selection.submittedAt ?? keep.data.selection?.submittedAt,
      },
    };
    const saved = await sql.query(
      "UPDATE proofing_visitors SET data = $1::jsonb, version = version + 1, updated_at = now() WHERE gallery_id = $2 AND id = $3 AND version = $4 RETURNING id",
      [JSON.stringify(merged), galleryId, keep.id, keep.version],
    );
    if (!saved[0]) continue;
    await sql.query(
      "DELETE FROM proofing_visitors WHERE gallery_id = $1 AND id = ANY($2::text[])",
      [galleryId, rows.slice(1).map((row) => row.id)],
    );
    return keep.id;
  }

  throw new Error("Gallery access could not be created. Please try again.");
}

/** Saves Backstage's changes to visitors (only the ones that changed). */
async function saveChangedVisitors(
  galleryId: string,
  before: ProofingVisitor[],
  after: ProofingVisitor[],
) {
  const sql = getSql();
  const beforeById = new Map(before.map((visitor) => [visitor.id, JSON.stringify(visitor)]));
  const afterIds = new Set(after.map((visitor) => visitor.id));

  for (const visitor of after) {
    const json = JSON.stringify(visitor);
    if (beforeById.get(visitor.id) === json) continue;
    await sql.query(
      `INSERT INTO proofing_visitors (gallery_id, id, email, data) VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (gallery_id, id) DO UPDATE SET data = EXCLUDED.data, email = EXCLUDED.email, version = proofing_visitors.version + 1, updated_at = now()`,
      [galleryId, visitor.id, String(visitor.email ?? "").toLowerCase(), json],
    );
  }

  const removed = before.map((visitor) => visitor.id).filter((id) => !afterIds.has(id));
  if (removed.length > 0) {
    await sql.query(
      "DELETE FROM proofing_visitors WHERE gallery_id = $1 AND id = ANY($2::text[])",
      [galleryId, removed],
    );
  }
}

export async function getProofingGalleries():
  Promise<ProofingGallery[]> {
  const sql = getSql();

  const [galleryRows, imageRows] =
    await sql.transaction([
      sql`
        SELECT data
        FROM proofing_galleries
        ORDER BY created_at DESC
      `,
      sql`
        SELECT
          id,
          gallery_id,
          original_filename,
          web_filename,
          width,
          height,
          alt,
          sort_order,
          created_at,
          blur_data_url
        FROM proofing_images
        ORDER BY gallery_id, sort_order
      `,
    ]);

  const imagesByGallery =
    new Map<string, ProofingImageRow[]>();

  for (const rawRow of imageRows) {
    const row = rawRow as ProofingImageRow;
    const current =
      imagesByGallery.get(
        row.gallery_id,
      ) ?? [];
    current.push(row);
    imagesByGallery.set(
      row.gallery_id,
      current,
    );
  }

  await ensureVisitorStore();
  const visitorRows = (await sql.query(
    "SELECT gallery_id, data FROM proofing_visitors",
  )) as Array<{ gallery_id: string; data: ProofingVisitor }>;
  const visitorsByGallery = new Map<string, ProofingVisitor[]>();
  for (const row of visitorRows) {
    const list = visitorsByGallery.get(row.gallery_id) ?? [];
    list.push(row.data);
    visitorsByGallery.set(row.gallery_id, list);
  }

  return galleryRows.map((row) => {
    const gallery =
      mapGallery(row as GalleryRow);
    const visitors = visitorsByGallery.get(String(gallery.id)) ?? [];
    const known = new Set(visitors.map((visitor) => visitor.id));

    return attachImages(
      {
        ...gallery,
        visitors: sortVisitors([...visitors, ...leftoverVisitors(gallery, known)]),
      },
      imagesByGallery.get(
        gallery.id,
      ) ?? [],
    );
  });
}

export async function getProofingGalleryBaseBySlug(
  slug: string,
): Promise<ProofingGallery | undefined> {
  const normalisedSlug =
    decodeURIComponent(slug)
      .trim()
      .toLowerCase();

  if (!normalisedSlug) {
    return undefined;
  }

  const sql = getSql();

  const rows = await sql`
    SELECT data
    FROM proofing_galleries
    WHERE LOWER(slug) = ${normalisedSlug}
    LIMIT 1
  `;

  const row = rows[0];

  if (!row) {
    return undefined;
  }

  return withCurrentVisitor({
    ...mapGallery(
      row as GalleryRow,
    ),
    images: [],
  });
}

export async function getProofingGalleryImageBySlug(
  slug: string,
  imageId: string,
): Promise<
  | {
      gallery: ProofingGallery;
      image: ProofingImage;
    }
  | undefined
> {
  const normalisedSlug =
    decodeURIComponent(slug)
      .trim()
      .toLowerCase();

  const cleanImageId =
    imageId.trim();

  if (
    !normalisedSlug ||
    !cleanImageId
  ) {
    return undefined;
  }

  const sql = getSql();

  const rows = await sql`
    SELECT
      pg.data,
      pi.id,
      pi.gallery_id,
      pi.original_filename,
      pi.web_filename,
      pi.width,
      pi.height,
      pi.alt,
      pi.sort_order,
      pi.created_at,
      pi.blur_data_url
    FROM proofing_galleries pg
    JOIN proofing_images pi
      ON pi.gallery_id = pg.id::text
    WHERE LOWER(pg.slug) = ${normalisedSlug}
      AND pi.id = ${cleanImageId}
    LIMIT 1
  `;

  const row = rows[0];

  if (!row) {
    return undefined;
  }

  return {
    gallery: await withCurrentVisitor({
      ...mapGallery(
        row as GalleryRow,
      ),
      images: [],
    }),
    image:
      mapProofingImage(
        row as unknown as ProofingImageRow,
      ),
  };
}

export async function getProofingGallery(
  id: string,
): Promise<ProofingGallery | undefined> {
  const sql = getSql();

  const [galleryRows, imageRows] =
    await sql.transaction([
      sql`
        SELECT data
        FROM proofing_galleries
        WHERE id = ${id}
        LIMIT 1
      `,
      sql`
        SELECT
          id,
          gallery_id,
          original_filename,
          web_filename,
          width,
          height,
          alt,
          sort_order,
          created_at,
          blur_data_url
        FROM proofing_images
        WHERE gallery_id = ${id}
        ORDER BY sort_order
      `,
    ]);

  if (!galleryRows[0]) {
    return undefined;
  }

  return attachImages(
    await withAllVisitors(
      mapGallery(
        galleryRows[0] as GalleryRow,
      ),
    ),
    imageRows as ProofingImageRow[],
  );
}

export async function getProofingGalleryBySlug(
  slug: string,
): Promise<ProofingGallery | undefined> {
  const normalisedSlug = decodeURIComponent(slug)
    .trim()
    .toLowerCase();

  const sql = getSql();

  const [galleryRows, imageRows] =
    await sql.transaction([
      sql`
        SELECT data
        FROM proofing_galleries
        WHERE LOWER(slug) = ${normalisedSlug}
        LIMIT 1
      `,
      sql`
        SELECT
          pi.id,
          pi.gallery_id,
          pi.original_filename,
          pi.web_filename,
          pi.width,
          pi.height,
          pi.alt,
          pi.sort_order,
          pi.created_at,
          pi.blur_data_url
        FROM proofing_images pi
        WHERE pi.gallery_id = (
          SELECT id::text
          FROM proofing_galleries
          WHERE LOWER(slug) = ${normalisedSlug}
          LIMIT 1
        )
        ORDER BY pi.sort_order
      `,
    ]);

  if (!galleryRows[0]) {
    return undefined;
  }

  return attachImages(
    await withCurrentVisitor(
      mapGallery(
        galleryRows[0] as GalleryRow,
      ),
    ),
    imageRows as ProofingImageRow[],
  );
}

async function getProofingGalleryBase(
  id: string,
): Promise<ProofingGallery | undefined> {
  const sql = getSql();

  const rows = await sql`
    SELECT data
    FROM proofing_galleries
    WHERE id = ${id}
    LIMIT 1
  `;

  if (!rows[0]) {
    return undefined;
  }

  return {
    ...mapGallery(
      rows[0] as GalleryRow,
    ),
    images: [],
  };
}

export async function proofingGalleryExists(
  id: string,
) {
  const sql = getSql();
  const rows = await sql`
    SELECT 1
    FROM proofing_galleries
    WHERE id = ${id}
    LIMIT 1
  `;
  return Boolean(rows[0]);
}

export async function saveProofingGallery(
  gallery: ProofingGallery,
): Promise<void> {
  const sql = getSql();
  const storedGallery =
    galleryForStorage(gallery);

  await sql`
    INSERT INTO proofing_galleries (
      id,
      slug,
      title,
      created_at,
      updated_at,
      data
    )
    VALUES (
      ${gallery.id},
      ${gallery.slug},
      ${gallery.title},
      ${gallery.createdAt},
      ${gallery.updatedAt},
      ${JSON.stringify(storedGallery)}::jsonb
    )
    ON CONFLICT (id)
    DO UPDATE SET
      slug = EXCLUDED.slug,
      title = EXCLUDED.title,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at,
      data = EXCLUDED.data
  `;
}

export async function insertProofingImages(
  galleryId: string,
  images: ProofingImage[],
) {
  if (images.length === 0) {
    return {
      inserted: 0,
      imageCount: 0,
    };
  }

  const sql = getSql();

  const maxRows = await sql`
    SELECT COALESCE(MAX(sort_order), -1) AS max_sort_order
    FROM proofing_images
    WHERE gallery_id = ${galleryId}
  `;

  const firstSortOrder =
    Number(
      maxRows[0]?.max_sort_order ?? -1,
    ) + 1;

  const queries = images.map(
    (image, index) => sql`
      INSERT INTO proofing_images (
        id,
        gallery_id,
        original_filename,
        web_filename,
        width,
        height,
        alt,
        sort_order,
        created_at,
        blur_data_url
      )
      VALUES (
        ${image.id},
        ${galleryId},
        ${image.originalFilename},
        ${image.webFilename},
        ${image.width},
        ${image.height},
        ${image.alt},
        ${firstSortOrder + index},
        ${image.createdAt ?? new Date().toISOString()},
        ${image.blurDataURL ?? null}
      )
      ON CONFLICT (id) DO NOTHING
    `,
  );

  queries.push(sql`
    UPDATE proofing_galleries
    SET updated_at = now()
    WHERE id = ${galleryId}
  `);

  await sql.transaction(queries);

  const countRows = await sql`
    SELECT COUNT(*)::integer AS image_count
    FROM proofing_images
    WHERE gallery_id = ${galleryId}
  `;

  return {
    inserted: images.length,
    imageCount:
      Number(
        countRows[0]?.image_count ?? 0,
      ),
  };
}

/**
 * Save photos that have just been uploaded. Photos whose file name is
 * already in the gallery are skipped (so retrying an upload can never list
 * a photo twice), unless they are marked to replace that photo, in which
 * case the existing photo keeps its place, favourites and notes and just
 * gets the new picture.
 */
export async function commitProofingImages(
  galleryId: string,
  images: Array<ProofingImage & { replaceImageId?: string }>,
) {
  const sql = getSql();

  const existingRows = (await sql`
    SELECT id, original_filename, web_filename
    FROM proofing_images
    WHERE gallery_id = ${galleryId}
  `) as Array<{
    id: string;
    original_filename: string;
    web_filename: string;
  }>;

  const byId = new Map(
    existingRows.map((row) => [row.id, row]),
  );
  const takenNames = new Set(
    existingRows.map((row) =>
      row.original_filename.trim().toLowerCase(),
    ),
  );

  const inserted: ProofingImage[] = [];
  const replaced: Array<{ imageId: string; oldWebFilename: string }> = [];
  const skipped: ProofingImage[] = [];
  const queries = [];

  const maxRows = await sql`
    SELECT COALESCE(MAX(sort_order), -1) AS max_sort_order
    FROM proofing_images
    WHERE gallery_id = ${galleryId}
  `;
  let nextSortOrder =
    Number(maxRows[0]?.max_sort_order ?? -1) + 1;

  for (const image of images) {
    const name = image.originalFilename.trim().toLowerCase();
    const target = image.replaceImageId
      ? byId.get(image.replaceImageId)
      : undefined;

    if (target) {
      queries.push(sql`
        UPDATE proofing_images
        SET
          web_filename = ${image.webFilename},
          width = ${image.width},
          height = ${image.height},
          created_at = ${image.createdAt ?? new Date().toISOString()},
          blur_data_url = NULL
        WHERE gallery_id = ${galleryId}
          AND id = ${target.id}
      `);
      replaced.push({
        imageId: target.id,
        oldWebFilename: target.web_filename,
      });
      byId.delete(target.id);
      takenNames.add(name);
      continue;
    }

    if (takenNames.has(name)) {
      skipped.push(image);
      continue;
    }

    takenNames.add(name);
    inserted.push(image);
    queries.push(sql`
      INSERT INTO proofing_images (
        id,
        gallery_id,
        original_filename,
        web_filename,
        width,
        height,
        alt,
        sort_order,
        created_at,
        blur_data_url
      )
      VALUES (
        ${image.id},
        ${galleryId},
        ${image.originalFilename},
        ${image.webFilename},
        ${image.width},
        ${image.height},
        ${image.alt},
        ${nextSortOrder},
        ${image.createdAt ?? new Date().toISOString()},
        ${image.blurDataURL ?? null}
      )
      ON CONFLICT (id) DO NOTHING
    `);
    nextSortOrder += 1;
  }

  if (queries.length > 0) {
    queries.push(sql`
      UPDATE proofing_galleries
      SET updated_at = now()
      WHERE id = ${galleryId}
    `);
    await sql.transaction(queries);
  }

  const countRows = await sql`
    SELECT COUNT(*)::integer AS image_count
    FROM proofing_images
    WHERE gallery_id = ${galleryId}
  `;

  return {
    inserted,
    replaced,
    skipped,
    imageCount: Number(countRows[0]?.image_count ?? 0),
  };
}

export async function deleteProofingImageRecord(
  galleryId: string,
  imageId: string,
) {
  const sql = getSql();

  await sql.transaction([
    sql`
      DELETE FROM proofing_images
      WHERE gallery_id = ${galleryId}
        AND id = ${imageId}
    `,
    sql`
      WITH ordered AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            ORDER BY sort_order, id
          ) - 1 AS next_sort_order
        FROM proofing_images
        WHERE gallery_id = ${galleryId}
      )
      UPDATE proofing_images AS image
      SET sort_order = ordered.next_sort_order
      FROM ordered
      WHERE image.id = ordered.id
    `,
  ]);
}

/**
 * Remove many photos in one go (Backstage › Delete selected), then
 * renumber the rest once. Doing this a photo at a time renumbered the
 * whole gallery for every photo (500 photos took ~20 minutes).
 */
export async function deleteProofingImageRecords(
  galleryId: string,
  imageIds: string[],
) {
  if (imageIds.length === 0) {
    return;
  }

  const sql = getSql();

  await sql.transaction([
    sql`
      DELETE FROM proofing_images
      WHERE gallery_id = ${galleryId}
        AND id = ANY(${imageIds}::text[])
    `,
    sql`
      WITH ordered AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            ORDER BY sort_order, id
          ) - 1 AS next_sort_order
        FROM proofing_images
        WHERE gallery_id = ${galleryId}
      )
      UPDATE proofing_images AS image
      SET sort_order = ordered.next_sort_order
      FROM ordered
      WHERE image.id = ordered.id
    `,
  ]);
}

export async function deleteProofingGallery(
  galleryId: string,
) {
  await ensureVisitorStore();
  const sql = getSql();

  const results =
    await sql.transaction([
      sql`
        DELETE FROM proofing_images
        WHERE gallery_id = ${galleryId}
      `,
      sql`
        DELETE FROM proofing_visitors
        WHERE gallery_id = ${galleryId}
      `,
      sql`
        DELETE FROM proofing_galleries
        WHERE id = ${galleryId}
        RETURNING id
      `,
    ]);

  return results[2].length === 1;
}

export async function reorderProofingImages(
  galleryId: string,
  imageIds: string[],
) {
  const sql = getSql();

  await sql.transaction(
    imageIds.map(
      (imageId, index) => sql`
        UPDATE proofing_images
        SET sort_order = ${index}
        WHERE gallery_id = ${galleryId}
          AND id = ${imageId}
      `,
    ),
  );
}

export async function updateProofingGallery(
  id: string,
  updater: (
    gallery: ProofingGallery,
  ) => ProofingGallery,
): Promise<ProofingGallery | undefined> {
  /*
   * Visitors, favourites and settings all live in one record per gallery.
   * When lots of people sign in at once (e.g. a graduation gallery emailed
   * to hundreds of students), two saves could overlap and one would wipe
   * out the other. So each save only goes through if nobody else has saved
   * since we read the gallery; otherwise we read it again and re-apply the
   * change. `updater` must therefore be safe to run more than once.
   */
  const sql = getSql();
  await ensureVisitorStore();

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const base =
      await getProofingGalleryBase(id);

    if (!base) {
      return undefined;
    }

    // Backstage changes may touch visitors (e.g. removing a deleted
    // photograph from everyone's favourites), so give the updater everyone.
    const visitorsInTable = await listProofingVisitors(id);
    const gallery = await withAllVisitors(base);

    const previousUpdatedAt =
      gallery.updatedAt ?? null;

    const updatedGallery = updater(gallery);

    let nextUpdatedAt = new Date();
    if (
      previousUpdatedAt &&
      nextUpdatedAt.getTime() <=
        new Date(previousUpdatedAt).getTime()
    ) {
      nextUpdatedAt = new Date(
        new Date(previousUpdatedAt).getTime() + 1,
      );
    }
    updatedGallery.updatedAt =
      nextUpdatedAt.toISOString();

    const storedGallery =
      galleryForStorage(updatedGallery);

    const rows = await sql`
      UPDATE proofing_galleries
      SET
        slug = ${updatedGallery.slug},
        title = ${updatedGallery.title},
        updated_at = ${updatedGallery.updatedAt},
        data = ${JSON.stringify(storedGallery)}::jsonb
      WHERE id = ${id}
        AND (data->>'updatedAt') IS NOT DISTINCT FROM ${previousUpdatedAt}
      RETURNING id
    `;

    if (rows[0]) {
      await saveChangedVisitors(
        id,
        visitorsInTable,
        Array.isArray(updatedGallery.visitors) ? updatedGallery.visitors : [],
      );
      return updatedGallery;
    }

    // Someone else saved first: wait a moment (randomly, so the retries
    // don't collide again) and try again with the latest version.
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        20 + Math.random() * 60 * (attempt + 1),
      ),
    );
  }

  throw new Error(
    "This gallery is very busy right now. Please try again in a moment.",
  );
}

/*
 * The light check behind every photograph shown in a proofing gallery.
 * It returns only what's needed (not the gallery's whole visitor list),
 * so thousands of thumbnails don't each download that list from the
 * database. `visitorIds` are the visitor codes from the browser's cookies.
 */
/** Just each photo's id and stored file name (for thumbnail upkeep). */
export async function listProofingImageFiles(
  galleryId: string,
) {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, web_filename, original_filename
    FROM proofing_images
    WHERE gallery_id = ${galleryId}
    ORDER BY sort_order
  `) as Array<{ id: string; web_filename: string; original_filename: string }>;
  return rows.map((row) => ({
    id: row.id,
    webFilename: row.web_filename,
    originalFilename: row.original_filename,
  }));
}

export async function getProofingImageAccess(
  slug: string,
  imageId: string,
  visitorIds: string[],
): Promise<
  | {
      galleryId: string;
      status: string;
      expiresAt?: string;
      coverImageId?: string;
      webFilename: string;
      isVisitor: boolean;
    }
  | undefined
> {
  const normalisedSlug =
    decodeURIComponent(slug)
      .trim()
      .toLowerCase();
  const cleanImageId = imageId.trim();

  if (!normalisedSlug || !cleanImageId) {
    return undefined;
  }

  const ids = visitorIds
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 50);

  await ensureVisitorStore();
  const sql = getSql();

  const rows = await sql`
    SELECT
      pg.id::text AS gallery_id,
      pg.data->>'status' AS status,
      pg.data->>'expiresAt' AS expires_at,
      pg.data->>'coverImageId' AS cover_image_id,
      COALESCE(
        pi.web_filename,
        CASE
          WHEN pg.data->'coverUpload'->>'id' = ${cleanImageId}
            THEN pg.data->'coverUpload'->>'webFilename'
        END
      ) AS web_filename,
      (
        EXISTS (
          SELECT 1
          FROM proofing_visitors pv
          WHERE pv.gallery_id = pg.id::text
            AND pv.id = ANY(${ids}::text[])
        )
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(pg.data->'visitors') = 'array'
                THEN pg.data->'visitors'
              ELSE '[]'::jsonb
            END
          ) AS v
          WHERE v->>'id' = ANY(${ids}::text[])
        )
      ) AS is_visitor
    FROM proofing_galleries pg
    LEFT JOIN proofing_images pi
      ON pi.gallery_id = pg.id::text
     AND pi.id = ${cleanImageId}
    WHERE LOWER(pg.slug) = ${normalisedSlug}
    LIMIT 1
  `;

  const row = rows[0] as
    | {
        gallery_id: string;
        status: string | null;
        expires_at: string | null;
        cover_image_id: string | null;
        web_filename: string | null;
        is_visitor: boolean;
      }
    | undefined;

  // No such photo (and not the gallery's uploaded cover).
  if (!row || !row.web_filename) {
    return undefined;
  }

  return {
    galleryId: row.gallery_id,
    status: row.status ?? "",
    ...(row.expires_at ? { expiresAt: row.expires_at } : {}),
    ...(row.cover_image_id ? { coverImageId: row.cover_image_id } : {}),
    webFilename: row.web_filename,
    isVisitor: Boolean(row.is_visitor),
  };
}
