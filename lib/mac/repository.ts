import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes } from "node:crypto";

// Connected Macs (each with its own secret code) and the files they upload,
// so the Mac app can be told for certain that a file is safely in Storage
// before it frees up space on the Mac.

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
  return neon(databaseUrl);
}

function environment() {
  return process.env.VERCEL_ENV === "production" ? "production" : "preview";
}

let schemaPromise: Promise<void> | null = null;
function ensureSchema() {
  schemaPromise ??= (async () => {
    const sql = getSql();
    await sql.query("CREATE TABLE IF NOT EXISTS mac_devices (id text PRIMARY KEY, environment text NOT NULL, name text NOT NULL DEFAULT 'Mac', token_hash text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz, revoked_at timestamptz)");
    await sql.query("CREATE TABLE IF NOT EXISTS mac_uploads (environment text NOT NULL, remote_path text NOT NULL, device_id text NOT NULL, size_bytes bigint NOT NULL, md5_hex text NOT NULL, uploaded_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (environment, remote_path))");
    await sql.query("CREATE INDEX IF NOT EXISTS mac_uploads_recent_idx ON mac_uploads(environment, uploaded_at DESC)");
  })();
  return schemaPromise;
}

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export type MacDevice = {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt?: string;
  connected: boolean;
  uploads: number;
};

/** Creates a new connection code. The code itself is only ever shown once. */
export async function createMacDevice() {
  await ensureSchema();
  const id = crypto.randomUUID();
  const token = "sgm_" + randomBytes(24).toString("base64url");
  await getSql().query(
    "INSERT INTO mac_devices (id, environment, token_hash) VALUES ($1,$2,$3)",
    [id, environment(), hashToken(token)],
  );
  return { id, token };
}

/** Checks the code a Mac sends with every request. */
export async function authenticateMac(request: Request, deviceName?: string) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token.startsWith("sgm_") || token.length < 20) return undefined;
  await ensureSchema();
  const name = deviceName?.trim().slice(0, 80);
  const rows = await getSql().query(
    "UPDATE mac_devices SET last_seen_at = now(), name = COALESCE(NULLIF($3, ''), name) WHERE token_hash=$1 AND environment=$2 AND revoked_at IS NULL RETURNING id, name",
    [hashToken(token), environment(), name || ""],
  );
  return rows[0] as { id: string; name: string } | undefined;
}

export async function listMacDevices(): Promise<MacDevice[]> {
  await ensureSchema();
  const rows = await getSql().query(
    "SELECT d.id, d.name, d.created_at, d.last_seen_at, d.revoked_at, (SELECT count(*)::integer FROM mac_uploads u WHERE u.device_id = d.id AND u.environment = d.environment) AS uploads FROM mac_devices d WHERE d.environment=$1 AND d.revoked_at IS NULL ORDER BY d.created_at DESC",
    [environment()],
  );
  return (rows as Array<{ id: string; name: string; created_at: string | Date; last_seen_at: string | Date | null; uploads: number }>).map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at).toISOString(),
    ...(row.last_seen_at ? { lastSeenAt: new Date(row.last_seen_at).toISOString() } : {}),
    connected: Boolean(row.last_seen_at),
    uploads: Number(row.uploads) || 0,
  }));
}

export async function revokeMacDevice(id: string) {
  await ensureSchema();
  await getSql().query("UPDATE mac_devices SET revoked_at = now() WHERE id=$1 AND environment=$2", [id, environment()]);
}

export type MacUpload = { remotePath: string; deviceId: string; sizeBytes: number; md5Hex: string; uploadedAt: string };

export async function getMacUpload(remotePath: string): Promise<MacUpload | undefined> {
  await ensureSchema();
  const rows = await getSql().query(
    "SELECT remote_path, device_id, size_bytes, md5_hex, uploaded_at FROM mac_uploads WHERE environment=$1 AND remote_path=$2",
    [environment(), remotePath],
  );
  const row = rows[0] as { remote_path: string; device_id: string; size_bytes: string | number; md5_hex: string; uploaded_at: string | Date } | undefined;
  return row
    ? { remotePath: row.remote_path, deviceId: row.device_id, sizeBytes: Number(row.size_bytes), md5Hex: row.md5_hex, uploadedAt: new Date(row.uploaded_at).toISOString() }
    : undefined;
}

export async function recordMacUpload(input: { remotePath: string; deviceId: string; sizeBytes: number; md5Hex: string }) {
  await ensureSchema();
  await getSql().query(
    "INSERT INTO mac_uploads (environment, remote_path, device_id, size_bytes, md5_hex, uploaded_at) VALUES ($1,$2,$3,$4,$5,now()) ON CONFLICT (environment, remote_path) DO UPDATE SET device_id=EXCLUDED.device_id, size_bytes=EXCLUDED.size_bytes, md5_hex=EXCLUDED.md5_hex, uploaded_at=now()",
    [environment(), input.remotePath, input.deviceId, input.sizeBytes, input.md5Hex],
  );
}

export async function listRecentMacUploads(limit = 25) {
  await ensureSchema();
  const rows = await getSql().query(
    "SELECT u.remote_path, u.size_bytes, u.uploaded_at, d.name FROM mac_uploads u LEFT JOIN mac_devices d ON d.id = u.device_id WHERE u.environment=$1 ORDER BY u.uploaded_at DESC LIMIT $2",
    [environment(), limit],
  );
  return (rows as Array<{ remote_path: string; size_bytes: string | number; uploaded_at: string | Date; name: string | null }>).map((row) => ({
    path: row.remote_path,
    sizeBytes: Number(row.size_bytes) || 0,
    uploadedAt: new Date(row.uploaded_at).toISOString(),
    device: row.name || "Mac",
  }));
}

/** Keeps the Mac's records right when Steve renames or moves things in Storage. */
export async function updateMacUploadPaths(pairs: Array<{ from: string; to: string }>) {
  if (!pairs.length) return;
  await ensureSchema();
  await getSql().query(
    "UPDATE mac_uploads SET remote_path = p.to_path FROM jsonb_to_recordset($1::jsonb) AS p(from_path text, to_path text) WHERE mac_uploads.environment = $2 AND mac_uploads.remote_path = p.from_path",
    [JSON.stringify(pairs.map((pair) => ({ from_path: pair.from, to_path: pair.to }))), environment()],
  );
}

/** Where a Mac upload lives now (it may have been moved or renamed in Storage). */
export async function findMacUploadByOriginal(deviceId: string, md5Hex: string, sizeBytes: number) {
  await ensureSchema();
  const rows = await getSql().query(
    "SELECT remote_path FROM mac_uploads WHERE environment=$1 AND device_id=$2 AND md5_hex=$3 AND size_bytes=$4 ORDER BY uploaded_at DESC LIMIT 1",
    [environment(), deviceId, md5Hex, sizeBytes],
  );
  return rows[0] ? (rows[0] as { remote_path: string }).remote_path : undefined;
}
