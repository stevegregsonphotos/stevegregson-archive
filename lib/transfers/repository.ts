import { neon } from "@neondatabase/serverless";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { TransferDownloadEvent, TransferFile, TransferRecord, TransferRecipient } from "./types";
import { isTransferImage } from "./backgrounds";

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
  return neon(databaseUrl);
}

function environment() {
  return process.env.VERCEL_ENV === "production" ? "production" : "preview";
}

let schemaPromise: Promise<void> | null = null;

async function ensureSchema() {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    const sql = getSql();
    await sql.query("CREATE TABLE IF NOT EXISTS transfer_records (id text PRIMARY KEY, environment text NOT NULL, token text NOT NULL, title text NOT NULL, message text NOT NULL DEFAULT '', sender_email text NOT NULL, recipients jsonb NOT NULL DEFAULT '[]'::jsonb, status text NOT NULL DEFAULT 'uploading', created_at timestamptz NOT NULL DEFAULT now(), finalized_at timestamptz, expires_at timestamptz NOT NULL, file_count integer NOT NULL DEFAULT 0, total_size_bytes bigint NOT NULL DEFAULT 0, password_hash text, background_file_ids jsonb NOT NULL DEFAULT '[]'::jsonb)");
    await sql.query("ALTER TABLE transfer_records ADD COLUMN IF NOT EXISTS background_file_ids jsonb NOT NULL DEFAULT '[]'::jsonb");
    await sql.query("CREATE UNIQUE INDEX IF NOT EXISTS transfer_records_env_token_idx ON transfer_records(environment, token)");
    await sql.query("CREATE TABLE IF NOT EXISTS transfer_files (id text PRIMARY KEY, transfer_id text NOT NULL REFERENCES transfer_records(id) ON DELETE CASCADE, original_name text NOT NULL, relative_path text NOT NULL, object_key text NOT NULL, source text NOT NULL DEFAULT 'upload', size_bytes bigint NOT NULL, content_type text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())");
    await sql.query("ALTER TABLE transfer_files ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'upload'");
    await sql.query("CREATE INDEX IF NOT EXISTS transfer_files_transfer_idx ON transfer_files(transfer_id, created_at)");
    await sql.query("CREATE TABLE IF NOT EXISTS transfer_download_events (id text PRIMARY KEY, transfer_id text NOT NULL REFERENCES transfer_records(id) ON DELETE CASCADE, file_id text, recipient_email text, event_type text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())");
    await sql.query("CREATE INDEX IF NOT EXISTS transfer_download_events_transfer_idx ON transfer_download_events(transfer_id, created_at DESC)");
    await sql.query("ALTER TABLE transfer_records ADD COLUMN IF NOT EXISTS files_purged_at timestamptz");
    await sql.query("CREATE INDEX IF NOT EXISTS transfer_files_object_key_idx ON transfer_files(object_key)");
  })();
  return schemaPromise;
}

function iso(value: string | Date | null | undefined) {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRecipients(value: unknown): TransferRecipient[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const email = (item as { email?: unknown }).email;
        return typeof email === "string" && email.trim()
          ? [{ email: email.trim().toLowerCase() }]
          : [];
      })
    : [];
}

function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 32);
  return salt.toString("base64") + ":" + derived.toString("base64");
}

export function verifyTransferPassword(password: string, stored?: string | null) {
  if (!stored) return true;
  const [salt64, hash64] = stored.split(":");
  if (!salt64 || !hash64) return false;
  const expected = Buffer.from(hash64, "base64");
  const actual = scryptSync(password, Buffer.from(salt64, "base64"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

type RecordRow = {
  id: string; token: string; title: string; message: string; sender_email: string;
  recipients: unknown; status: string; created_at: string | Date;
  finalized_at: string | Date | null; expires_at: string | Date; file_count: number;
  total_size_bytes: string | number; password_hash: string | null; background_file_ids?: unknown;
  files_purged_at?: string | Date | null;
};
type FileRow = {
  id: string; transfer_id: string; original_name: string; relative_path: string;
  object_key: string; source: string; size_bytes: string | number; content_type: string; created_at: string | Date;
};
type EventRow = {
  id: string; transfer_id: string; file_id: string | null; recipient_email: string | null;
  event_type: string; created_at: string | Date;
};

function mapFile(row: FileRow): TransferFile {
  return {
    id: row.id, transferId: row.transfer_id, originalName: row.original_name,
    relativePath: row.relative_path, objectKey: row.object_key,
    source: row.source === "archive" ? "archive" : "upload",
    sizeBytes: Number(row.size_bytes) || 0, contentType: row.content_type,
    createdAt: iso(row.created_at)!,
  };
}

function mapEvent(row: EventRow): TransferDownloadEvent {
  return {
    id: row.id, transferId: row.transfer_id,
    ...(row.file_id ? { fileId: row.file_id } : {}),
    ...(row.recipient_email ? { recipientEmail: row.recipient_email } : {}),
    eventType: row.event_type === "all" ? "all" : "file",
    createdAt: iso(row.created_at)!,
  };
}

const FILE_COLUMNS = "id, transfer_id, original_name, relative_path, object_key, source, size_bytes, content_type, created_at";
const EVENT_COLUMNS = "id, transfer_id, file_id, recipient_email, event_type, created_at";

function buildRecord(row: RecordRow, files: FileRow[], events: EventRow[]): TransferRecord {
  const expired = new Date(row.expires_at).getTime() <= Date.now();
  const allowed = ["uploading", "active", "disabled", "expired"];
  return {
    id: row.id, token: row.token, title: row.title, message: row.message,
    senderEmail: row.sender_email, recipients: mapRecipients(row.recipients),
    status: expired && row.status === "active"
      ? "expired"
      : (allowed.includes(row.status) ? row.status as TransferRecord["status"] : "uploading"),
    createdAt: iso(row.created_at)!,
    ...(row.finalized_at ? { finalizedAt: iso(row.finalized_at) } : {}),
    expiresAt: iso(row.expires_at)!, fileCount: Number(row.file_count) || 0,
    totalSizeBytes: Number(row.total_size_bytes) || 0, hasPassword: Boolean(row.password_hash),
    ...(row.files_purged_at ? { filesPurgedAt: iso(row.files_purged_at) } : {}),
    backgroundFileIds: Array.isArray(row.background_file_ids) ? row.background_file_ids.filter((value): value is string => typeof value === "string") : [],
    files: files.map(mapFile),
    downloads: events.map(mapEvent),
  };
}

async function hydrate(row: RecordRow): Promise<TransferRecord> {
  const sql = getSql();
  const [files, events] = await Promise.all([
    sql.query("SELECT " + FILE_COLUMNS + " FROM transfer_files WHERE transfer_id = $1 ORDER BY created_at, id", [row.id]),
    sql.query("SELECT " + EVENT_COLUMNS + " FROM transfer_download_events WHERE transfer_id = $1 ORDER BY created_at DESC", [row.id]),
  ]);
  return buildRecord(row, files as FileRow[], events as EventRow[]);
}

/** Loads many transfers with 2 extra queries in total (not 2 per transfer). */
async function hydrateMany(rows: RecordRow[]): Promise<TransferRecord[]> {
  if (!rows.length) return [];
  const sql = getSql();
  const ids = rows.map((row) => row.id);
  const [files, events] = await Promise.all([
    sql.query("SELECT " + FILE_COLUMNS + " FROM transfer_files WHERE transfer_id = ANY($1::text[]) ORDER BY created_at, id", [ids]),
    sql.query("SELECT " + EVENT_COLUMNS + " FROM transfer_download_events WHERE transfer_id = ANY($1::text[]) ORDER BY created_at DESC", [ids]),
  ]);
  const filesBy = new Map<string, FileRow[]>();
  for (const file of files as FileRow[]) filesBy.set(file.transfer_id, [...(filesBy.get(file.transfer_id) ?? []), file]);
  const eventsBy = new Map<string, EventRow[]>();
  for (const event of events as EventRow[]) eventsBy.set(event.transfer_id, [...(eventsBy.get(event.transfer_id) ?? []), event]);
  return rows.map((row) => buildRecord(row, filesBy.get(row.id) ?? [], eventsBy.get(row.id) ?? []));
}

export async function createTransfer(input: {
  title: string; message?: string; senderEmail: string; recipientEmails: string[];
  expiresAt: string; password?: string;
}) {
  await ensureSchema();
  const sql = getSql();
  const id = crypto.randomUUID();
  const token = randomBytes(18).toString("base64url");
  const cleanRecipients = [...new Set(input.recipientEmails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  const passwordHash = input.password?.trim() ? hashPassword(input.password.trim()) : null;
  const rows = await sql.query(
    "INSERT INTO transfer_records (id, environment, token, title, message, sender_email, recipients, status, created_at, expires_at, password_hash) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'uploading',now(),$8,$9) RETURNING id, token, title, message, sender_email, recipients, status, created_at, finalized_at, expires_at, file_count, total_size_bytes, password_hash, background_file_ids, files_purged_at",
    [id, environment(), token, input.title.trim(), input.message?.trim() ?? "", input.senderEmail.trim().toLowerCase(), JSON.stringify(cleanRecipients.map((email) => ({ email }))), input.expiresAt, passwordHash],
  );
  return hydrate(rows[0] as RecordRow);
}

export async function addTransferFiles(transferId: string, files: Array<{
  id: string; originalName: string; relativePath: string; objectKey: string;
  source?: "upload" | "archive"; sizeBytes: number; contentType: string;
}>) {
  if (!files.length) return;
  await ensureSchema();
  const sql = getSql();
  // One database round trip per batch instead of one per file.
  await sql.query(
    "INSERT INTO transfer_files (id, transfer_id, original_name, relative_path, object_key, source, size_bytes, content_type, created_at) " +
    "SELECT f.id, $1, f.original_name, f.relative_path, f.object_key, f.source, f.size_bytes, f.content_type, now() + (f.ord * interval '1 microsecond') " +
    "FROM jsonb_to_recordset($2::jsonb) AS f(id text, original_name text, relative_path text, object_key text, source text, size_bytes bigint, content_type text, ord integer) " +
    "ON CONFLICT (id) DO NOTHING",
    [transferId, JSON.stringify(files.map((file, ord) => ({
      id: file.id, original_name: file.originalName, relative_path: file.relativePath,
      object_key: file.objectKey, source: file.source ?? "upload", size_bytes: file.sizeBytes,
      content_type: file.contentType, ord,
    })))],
  );
}

export async function removeTransferFile(
  transferId: string,
  fileId: string,
) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    "DELETE FROM transfer_files USING transfer_records WHERE transfer_files.id=$1 AND transfer_files.transfer_id=$2 AND transfer_records.id=transfer_files.transfer_id AND transfer_records.environment=$3 RETURNING transfer_files.object_key, transfer_files.source",
    [fileId, transferId, environment()],
  );
  if (rows[0]) {
    await sql.query("UPDATE transfer_records SET background_file_ids = background_file_ids - $1 WHERE id=$2 AND environment=$3", [fileId, transferId, environment()]);
  }
  return rows[0]
    ? {
        objectKey: (rows[0] as { object_key: string }).object_key,
        source: ((rows[0] as { source: string }).source === "archive" ? "archive" : "upload") as "archive" | "upload",
      }
    : undefined;
}

export async function refreshTransferTotals(
  transferId: string,
) {
  await ensureSchema();
  const sql = getSql();
  await sql.query(
    "UPDATE transfer_records SET file_count=(SELECT count(*)::integer FROM transfer_files WHERE transfer_id=$1), total_size_bytes=(SELECT COALESCE(sum(size_bytes),0) FROM transfer_files WHERE transfer_id=$1) WHERE id=$1 AND environment=$2",
    [transferId, environment()],
  );
  return getTransferById(transferId);
}

/**
 * Marks an uploading transfer as sent. Returns undefined if it was already
 * sent (so emails are never sent twice) or has no files.
 */
export async function finalizeTransfer(transferId: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    "UPDATE transfer_records SET status='active', finalized_at=now(), file_count=(SELECT count(*)::integer FROM transfer_files WHERE transfer_id=$1), total_size_bytes=(SELECT COALESCE(sum(size_bytes),0) FROM transfer_files WHERE transfer_id=$1) WHERE id=$1 AND environment=$2 AND status='uploading' AND EXISTS (SELECT 1 FROM transfer_files WHERE transfer_id=$1) RETURNING id",
    [transferId, environment()],
  );
  return rows[0] ? getTransferById(transferId) : undefined;
}

/** Transfers that started uploading but never finished (e.g. a closed tab). */
export async function listAbandonedTransferIds(olderThanHours = 24) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    "SELECT id FROM transfer_records WHERE environment=$1 AND status='uploading' AND created_at < now() - ($2 * interval '1 hour') LIMIT 50",
    [environment(), olderThanHours],
  );
  return (rows as Array<{ id: string }>).map((row) => row.id);
}

/** Deletes a transfer record only while it is still uploading. */
export async function deleteUploadingTransferRecord(id: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query("DELETE FROM transfer_records WHERE id=$1 AND environment=$2 AND status='uploading' RETURNING id", [id, environment()]);
  return Boolean(rows[0]);
}

export async function getTransferById(id: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    "SELECT id, token, title, message, sender_email, recipients, status, created_at, finalized_at, expires_at, file_count, total_size_bytes, password_hash, background_file_ids, files_purged_at FROM transfer_records WHERE id=$1 AND environment=$2 LIMIT 1",
    [id, environment()],
  );
  return rows[0] ? hydrate(rows[0] as RecordRow) : undefined;
}

export async function getTransferByToken(token: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    "SELECT id, token, title, message, sender_email, recipients, status, created_at, finalized_at, expires_at, file_count, total_size_bytes, password_hash, background_file_ids, files_purged_at FROM transfer_records WHERE token=$1 AND environment=$2 LIMIT 1",
    [token, environment()],
  );
  return rows[0] ? hydrate(rows[0] as RecordRow) : undefined;
}

export async function listTransfers() {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    "SELECT id, token, title, message, sender_email, recipients, status, created_at, finalized_at, expires_at, file_count, total_size_bytes, password_hash, background_file_ids, files_purged_at FROM transfer_records WHERE environment=$1 AND status<>'uploading' ORDER BY created_at DESC LIMIT 500",
    [environment()],
  );
  return hydrateMany(rows as RecordRow[]);
}

export async function getTransferPasswordHash(token: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    "SELECT password_hash FROM transfer_records WHERE token=$1 AND environment=$2 LIMIT 1",
    [token, environment()],
  );
  return rows[0] ? (rows[0] as { password_hash: string | null }).password_hash : undefined;
}

export async function recordTransferDownload(input: {
  transferId: string; fileId?: string; recipientEmail?: string; eventType: "file" | "all";
}) {
  await ensureSchema();
  const sql = getSql();
  await sql.query(
    "INSERT INTO transfer_download_events (id, transfer_id, file_id, recipient_email, event_type, created_at) VALUES ($1,$2,$3,$4,$5,now())",
    [crypto.randomUUID(), input.transferId, input.fileId ?? null, input.recipientEmail?.trim().toLowerCase() || null, input.eventType],
  );
}

export async function disableTransfer(id: string) {
  await ensureSchema();
  const sql = getSql();
  await sql.query("UPDATE transfer_records SET status='disabled' WHERE id=$1 AND environment=$2", [id, environment()]);
}

/** Returns false if the transfer's files have already been cleared away. */
export async function extendTransfer(id: string, expiresAt: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query("UPDATE transfer_records SET expires_at=$1, status=CASE WHEN status='expired' THEN 'active' ELSE status END WHERE id=$2 AND environment=$3 AND files_purged_at IS NULL RETURNING id", [expiresAt, id, environment()]);
  return Boolean(rows[0]);
}

export async function deleteTransferRecord(id: string) {
  await ensureSchema();
  const sql = getSql();
  await sql.query("DELETE FROM transfer_records WHERE id=$1 AND environment=$2", [id, environment()]);
}

export async function setTransferBackgrounds(id: string, fileIds: string[]) {
  await ensureSchema();
  const sql = getSql();
  const transfer = await getTransferById(id);
  if (!transfer) return undefined;
  const unique = Array.from(new Set(fileIds));
  const valid = unique.filter((fileId) => transfer.files.some((file) => file.id === fileId && isTransferImage(file))).slice(0, 12);
  await sql.query("UPDATE transfer_records SET background_file_ids=$1::jsonb WHERE id=$2 AND environment=$3", [JSON.stringify(valid), id, environment()]);
  return getTransferById(id);
}

/** Keeps transfer downloads working when Steve renames or moves a Storage item. */
export async function updateArchiveObjectKeys(pairs: Array<{ from: string; to: string }>) {
  if (!pairs.length) return;
  await ensureSchema();
  const sql = getSql();
  await sql.query(
    "UPDATE transfer_files SET object_key = p.to_key FROM jsonb_to_recordset($1::jsonb) AS p(from_key text, to_key text) WHERE transfer_files.object_key = p.from_key AND transfer_files.source = 'archive'",
    [JSON.stringify(pairs.map((pair) => ({ from_key: pair.from, to_key: pair.to })))],
  );
}

/** Live transfers that include any of these Storage files, or anything inside these folders. */
export async function findLiveTransfersUsingArchive(keys: string[], folderPrefixes: string[]) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    "SELECT DISTINCT r.id, r.title FROM transfer_records r JOIN transfer_files f ON f.transfer_id = r.id " +
    "WHERE r.environment = $1 AND r.status = 'active' AND r.expires_at > now() AND f.source = 'archive' " +
    "AND (f.object_key = ANY($2::text[]) OR EXISTS (SELECT 1 FROM unnest($3::text[]) AS p(prefix) WHERE starts_with(f.object_key, p.prefix))) " +
    "ORDER BY r.title LIMIT 20",
    [environment(), keys, folderPrefixes],
  );
  return rows as Array<{ id: string; title: string }>;
}

/** Transfers whose expiry passed long enough ago that their uploaded files can go. */
export async function listTransfersToPurge(daysAfterExpiry = 30) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    "SELECT id FROM transfer_records WHERE environment=$1 AND status <> 'uploading' AND files_purged_at IS NULL AND expires_at < now() - ($2 * interval '1 day') LIMIT 50",
    [environment(), daysAfterExpiry],
  );
  return (rows as Array<{ id: string }>).map((row) => row.id);
}

export async function markTransferFilesPurged(id: string) {
  await ensureSchema();
  const sql = getSql();
  await sql.query("UPDATE transfer_records SET files_purged_at = now(), status = CASE WHEN status = 'active' THEN 'expired' ELSE status END WHERE id=$1 AND environment=$2", [id, environment()]);
}

/** Records a download and says whether it was the first one for this transfer. */
export async function recordTransferDownloadAndCheckFirst(input: {
  transferId: string; fileId?: string; eventType: "file" | "all";
}) {
  await recordTransferDownload(input);
  const sql = getSql();
  const rows = await sql.query("SELECT count(*)::integer AS n FROM transfer_download_events WHERE transfer_id=$1", [input.transferId]);
  return Number((rows[0] as { n: number }).n) === 1;
}

/** When Storage files are deleted for good, take them out of transfers too. */
export async function removeArchiveFilesFromTransfers(keyPrefix: string) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql.query(
    "DELETE FROM transfer_files WHERE source = 'archive' AND starts_with(object_key, $1) RETURNING transfer_id",
    [keyPrefix],
  );
  const affected = [...new Set((rows as Array<{ transfer_id: string }>).map((row) => row.transfer_id))];
  for (const id of affected) await refreshTransferTotals(id);
}
