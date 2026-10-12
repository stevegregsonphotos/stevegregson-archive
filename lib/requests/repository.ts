import { neon } from "@neondatabase/serverless";
import { randomBytes } from "node:crypto";

// "Request files": a private link Steve sends to a client so they can upload
// files to him. Everything they send lands in a Storage folder.

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
    await sql.query("CREATE TABLE IF NOT EXISTS file_requests (id text PRIMARY KEY, environment text NOT NULL, token text NOT NULL UNIQUE, title text NOT NULL, message text NOT NULL DEFAULT '', recipient_email text, folder_path text NOT NULL, status text NOT NULL DEFAULT 'open', expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())");
    await sql.query("CREATE TABLE IF NOT EXISTS file_request_uploads (id text PRIMARY KEY, request_id text NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE, uploader_name text NOT NULL, uploader_email text, folder_path text NOT NULL, file_count integer NOT NULL, total_bytes bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now())");
    await sql.query("CREATE INDEX IF NOT EXISTS file_request_uploads_request_idx ON file_request_uploads(request_id, created_at DESC)");
  })();
  return schemaPromise;
}

export type FileRequestUpload = {
  id: string; uploaderName: string; uploaderEmail?: string; folderPath: string; fileCount: number; totalBytes: number; createdAt: string;
};

export type FileRequest = {
  id: string; token: string; title: string; message: string; recipientEmail?: string; folderPath: string;
  status: "open" | "closed"; expiresAt: string; createdAt: string; uploads: FileRequestUpload[];
};

type Row = { id: string; token: string; title: string; message: string; recipient_email: string | null; folder_path: string; status: string; expires_at: string | Date; created_at: string | Date };
type UploadRow = { id: string; request_id: string; uploader_name: string; uploader_email: string | null; folder_path: string; file_count: number; total_bytes: string | number; created_at: string | Date };

const iso = (value: string | Date) => (value instanceof Date ? value : new Date(value)).toISOString();

function mapUpload(row: UploadRow): FileRequestUpload {
  return {
    id: row.id, uploaderName: row.uploader_name, ...(row.uploader_email ? { uploaderEmail: row.uploader_email } : {}),
    folderPath: row.folder_path, fileCount: Number(row.file_count) || 0, totalBytes: Number(row.total_bytes) || 0, createdAt: iso(row.created_at),
  };
}

function map(row: Row, uploads: UploadRow[]): FileRequest {
  const expired = new Date(row.expires_at).getTime() <= Date.now();
  return {
    id: row.id, token: row.token, title: row.title, message: row.message,
    ...(row.recipient_email ? { recipientEmail: row.recipient_email } : {}),
    folderPath: row.folder_path, status: row.status === "open" && !expired ? "open" : "closed",
    expiresAt: iso(row.expires_at), createdAt: iso(row.created_at), uploads: uploads.map(mapUpload),
  };
}

const COLUMNS = "id, token, title, message, recipient_email, folder_path, status, expires_at, created_at";

async function hydrate(rows: Row[]) {
  if (!rows.length) return [];
  const uploads = await getSql().query(
    "SELECT id, request_id, uploader_name, uploader_email, folder_path, file_count, total_bytes, created_at FROM file_request_uploads WHERE request_id = ANY($1::text[]) ORDER BY created_at DESC",
    [rows.map((row) => row.id)],
  ) as UploadRow[];
  return rows.map((row) => map(row, uploads.filter((upload) => upload.request_id === row.id)));
}

export async function createFileRequest(input: { title: string; message?: string; recipientEmail?: string; folderPath: string; expiryDays: number }) {
  await ensureSchema();
  const id = crypto.randomUUID();
  await getSql().query(
    "INSERT INTO file_requests (id, environment, token, title, message, recipient_email, folder_path, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7, now() + ($8 * interval '1 day'))",
    [id, environment(), randomBytes(18).toString("base64url"), input.title.trim(), input.message?.trim() ?? "",
      input.recipientEmail?.trim().toLowerCase() || null, input.folderPath, input.expiryDays],
  );
  return (await getFileRequestById(id))!;
}

export async function listFileRequests() {
  await ensureSchema();
  return hydrate(await getSql().query("SELECT " + COLUMNS + " FROM file_requests WHERE environment=$1 ORDER BY created_at DESC LIMIT 300", [environment()]) as Row[]);
}

export async function getFileRequestById(id: string) {
  await ensureSchema();
  const rows = await getSql().query("SELECT " + COLUMNS + " FROM file_requests WHERE id=$1 AND environment=$2", [id, environment()]) as Row[];
  return (await hydrate(rows))[0];
}

export async function getFileRequestByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return undefined;
  await ensureSchema();
  const rows = await getSql().query("SELECT " + COLUMNS + " FROM file_requests WHERE token=$1 AND environment=$2", [token, environment()]) as Row[];
  return (await hydrate(rows))[0];
}

export async function setFileRequestStatus(id: string, status: "open" | "closed", extendDays?: number) {
  await ensureSchema();
  await getSql().query(
    "UPDATE file_requests SET status=$1, expires_at = CASE WHEN $2::integer IS NULL THEN expires_at ELSE GREATEST(expires_at, now()) + ($2::integer * interval '1 day') END WHERE id=$3 AND environment=$4",
    [status, extendDays ?? null, id, environment()],
  );
}

export async function deleteFileRequest(id: string) {
  await ensureSchema();
  await getSql().query("DELETE FROM file_requests WHERE id=$1 AND environment=$2", [id, environment()]);
}

export async function recordFileRequestUpload(input: { requestId: string; uploaderName: string; uploaderEmail?: string; folderPath: string; fileCount: number; totalBytes: number }) {
  await ensureSchema();
  await getSql().query(
    "INSERT INTO file_request_uploads (id, request_id, uploader_name, uploader_email, folder_path, file_count, total_bytes) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [crypto.randomUUID(), input.requestId, input.uploaderName, input.uploaderEmail || null, input.folderPath, input.fileCount, input.totalBytes],
  );
}

/** Keeps requests pointing at their folder when it's renamed or moved in Storage. */
export async function moveFileRequestPaths(fromPath: string, toPath: string) {
  if (!fromPath || fromPath === toPath) return;
  await ensureSchema();
  await getSql().query(
    "UPDATE file_requests SET folder_path = $2 || substr(folder_path, length($1) + 1) WHERE environment=$3 AND (folder_path = $1 OR starts_with(folder_path, $1 || '/'))",
    [fromPath, toPath, environment()],
  );
}
