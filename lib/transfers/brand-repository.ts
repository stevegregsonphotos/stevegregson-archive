import { neon } from "@neondatabase/serverless";

// Steve's own default background photographs for client download pages.

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
  return neon(databaseUrl);
}

function environment() {
  return process.env.VERCEL_ENV === "production" ? "production" : "preview";
}

export type BrandBackground = { id: string; objectKey: string; width: number; height: number; createdAt: string };

let schemaPromise: Promise<void> | null = null;
function ensureSchema() {
  schemaPromise ??= (async () => {
    await getSql().query("CREATE TABLE IF NOT EXISTS transfer_brand_backgrounds (id text PRIMARY KEY, environment text NOT NULL, object_key text NOT NULL, width integer NOT NULL DEFAULT 0, height integer NOT NULL DEFAULT 0, sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now())");
  })();
  return schemaPromise;
}

type Row = { id: string; object_key: string; width: number; height: number; created_at: string | Date };

export async function listBrandBackgrounds(): Promise<BrandBackground[]> {
  await ensureSchema();
  const rows = await getSql().query("SELECT id, object_key, width, height, created_at FROM transfer_brand_backgrounds WHERE environment=$1 ORDER BY sort_order, created_at LIMIT 40", [environment()]);
  return (rows as Row[]).map((row) => ({
    id: row.id, objectKey: row.object_key, width: Number(row.width) || 0, height: Number(row.height) || 0,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function addBrandBackground(input: { id: string; objectKey: string; width: number; height: number }) {
  await ensureSchema();
  await getSql().query(
    "INSERT INTO transfer_brand_backgrounds (id, environment, object_key, width, height, sort_order) VALUES ($1,$2,$3,$4,$5,(SELECT COALESCE(max(sort_order),0)+1 FROM transfer_brand_backgrounds WHERE environment=$2)) ON CONFLICT (id) DO NOTHING",
    [input.id, environment(), input.objectKey, input.width, input.height],
  );
}

export async function removeBrandBackground(id: string) {
  await ensureSchema();
  const rows = await getSql().query("DELETE FROM transfer_brand_backgrounds WHERE id=$1 AND environment=$2 RETURNING object_key", [id, environment()]);
  return rows[0] ? (rows[0] as { object_key: string }).object_key : undefined;
}

/** Saves a new order (ids first to last). */
export async function reorderBrandBackgrounds(ids: string[]) {
  await ensureSchema();
  await getSql().query(
    "UPDATE transfer_brand_backgrounds b SET sort_order = o.ord FROM jsonb_array_elements_text($1::jsonb) WITH ORDINALITY AS o(id, ord) WHERE b.id = o.id AND b.environment = $2",
    [JSON.stringify(ids), environment()],
  );
}
