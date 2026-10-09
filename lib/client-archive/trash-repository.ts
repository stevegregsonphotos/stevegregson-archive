import { neon } from "@neondatabase/serverless";

// Records of items moved to Storage's Deleted Files, so they can be restored
// to where they came from, or cleared for good after 30 days.

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
  return neon(databaseUrl);
}

function environment() {
  return process.env.VERCEL_ENV === "production" ? "production" : "preview";
}

export type TrashEntry = {
  id: string;
  name: string;
  kind: "file" | "folder";
  originalParent: string;
  itemCount: number;
  sizeBytes: number;
  deletedAt: string;
};

let schemaPromise: Promise<void> | null = null;
function ensureSchema() {
  schemaPromise ??= (async () => {
    const sql = getSql();
    await sql.query("CREATE TABLE IF NOT EXISTS storage_trash (id text PRIMARY KEY, environment text NOT NULL, name text NOT NULL, kind text NOT NULL, original_parent text NOT NULL DEFAULT '', item_count integer NOT NULL DEFAULT 0, size_bytes bigint NOT NULL DEFAULT 0, deleted_at timestamptz NOT NULL DEFAULT now())");
    await sql.query("CREATE INDEX IF NOT EXISTS storage_trash_env_idx ON storage_trash(environment, deleted_at DESC)");
  })();
  return schemaPromise;
}

type Row = {
  id: string; name: string; kind: string; original_parent: string;
  item_count: number; size_bytes: string | number; deleted_at: string | Date;
};

function map(row: Row): TrashEntry {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind === "folder" ? "folder" : "file",
    originalParent: row.original_parent,
    itemCount: Number(row.item_count) || 0,
    sizeBytes: Number(row.size_bytes) || 0,
    deletedAt: new Date(row.deleted_at).toISOString(),
  };
}

export async function addTrashEntry(entry: Omit<TrashEntry, "deletedAt">) {
  await ensureSchema();
  await getSql().query(
    "INSERT INTO storage_trash (id, environment, name, kind, original_parent, item_count, size_bytes) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [entry.id, environment(), entry.name, entry.kind, entry.originalParent, entry.itemCount, entry.sizeBytes],
  );
}

export async function listTrashEntries() {
  await ensureSchema();
  const rows = await getSql().query("SELECT id, name, kind, original_parent, item_count, size_bytes, deleted_at FROM storage_trash WHERE environment=$1 ORDER BY deleted_at DESC LIMIT 500", [environment()]);
  return (rows as Row[]).map(map);
}

export async function getTrashEntry(id: string) {
  await ensureSchema();
  const rows = await getSql().query("SELECT id, name, kind, original_parent, item_count, size_bytes, deleted_at FROM storage_trash WHERE id=$1 AND environment=$2", [id, environment()]);
  return rows[0] ? map(rows[0] as Row) : undefined;
}

export async function removeTrashEntry(id: string) {
  await ensureSchema();
  await getSql().query("DELETE FROM storage_trash WHERE id=$1 AND environment=$2", [id, environment()]);
}

export async function listExpiredTrashIds(days = 30) {
  await ensureSchema();
  const rows = await getSql().query("SELECT id FROM storage_trash WHERE environment=$1 AND deleted_at < now() - ($2 * interval '1 day') LIMIT 50", [environment(), days]);
  return (rows as Array<{ id: string }>).map((row) => row.id);
}
