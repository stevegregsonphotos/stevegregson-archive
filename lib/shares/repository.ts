import { neon } from "@neondatabase/serverless";
import { randomBytes, scryptSync } from "node:crypto";
import { verifyTransferPassword } from "@/lib/transfers/repository";

// Folders in Storage that Steve has shared with clients. A share is a private
// link to one folder: the client can browse and download everything inside it
// (including anything added later) and nothing outside it.

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
    await sql.query("CREATE TABLE IF NOT EXISTS storage_shares (id text PRIMARY KEY, environment text NOT NULL, token text NOT NULL UNIQUE, path text NOT NULL, title text NOT NULL, message text NOT NULL DEFAULT '', recipients jsonb NOT NULL DEFAULT '[]'::jsonb, password_hash text, created_at timestamptz NOT NULL DEFAULT now())");
    await sql.query("CREATE INDEX IF NOT EXISTS storage_shares_env_path_idx ON storage_shares(environment, path)");
    await sql.query("CREATE TABLE IF NOT EXISTS storage_share_events (id text PRIMARY KEY, share_id text NOT NULL REFERENCES storage_shares(id) ON DELETE CASCADE, recipient_email text, event_type text NOT NULL, path text NOT NULL DEFAULT '', file_count integer, created_at timestamptz NOT NULL DEFAULT now())");
    await sql.query("CREATE INDEX IF NOT EXISTS storage_share_events_share_idx ON storage_share_events(share_id, created_at DESC)");
  })();
  return schemaPromise;
}

export type StorageShare = {
  id: string;
  token: string;
  /** Folder in Storage, e.g. "Clients/MOUNTVIEW". */
  path: string;
  title: string;
  message: string;
  recipients: string[];
  hasPassword: boolean;
  createdAt: string;
  lastActivityAt?: string;
  downloads: number;
};

export type ShareEvent = {
  id: string;
  recipientEmail?: string;
  eventType: "open" | "file" | "folder";
  path: string;
  fileCount?: number;
  createdAt: string;
};

type Row = {
  id: string; token: string; path: string; title: string; message: string; recipients: unknown;
  password_hash: string | null; created_at: string | Date; last_activity_at?: string | Date | null; downloads?: number | string;
};

const iso = (value: string | Date) => (value instanceof Date ? value : new Date(value)).toISOString();

function emails(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item) => (item && typeof item === "object" && typeof (item as { email?: unknown }).email === "string" ? [(item as { email: string }).email] : []))
    : [];
}

function map(row: Row): StorageShare {
  return {
    id: row.id,
    token: row.token,
    path: row.path,
    title: row.title,
    message: row.message,
    recipients: emails(row.recipients),
    hasPassword: Boolean(row.password_hash),
    createdAt: iso(row.created_at),
    ...(row.last_activity_at ? { lastActivityAt: iso(row.last_activity_at) } : {}),
    downloads: Number(row.downloads) || 0,
  };
}

const COLUMNS =
  "s.id, s.token, s.path, s.title, s.message, s.recipients, s.password_hash, s.created_at, " +
  "(SELECT max(created_at) FROM storage_share_events e WHERE e.share_id = s.id) AS last_activity_at, " +
  "(SELECT count(*)::integer FROM storage_share_events e WHERE e.share_id = s.id AND e.event_type <> 'open') AS downloads";

function hashPassword(password: string) {
  const salt = randomBytes(16);
  return salt.toString("base64") + ":" + scryptSync(password, salt, 32).toString("base64");
}

function cleanEmails(list: string[]) {
  return [...new Set(list.map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

export async function createShare(input: { path: string; title: string; message?: string; recipientEmails: string[]; password?: string }) {
  await ensureSchema();
  const id = crypto.randomUUID();
  const token = randomBytes(18).toString("base64url");
  await getSql().query(
    "INSERT INTO storage_shares (id, environment, token, path, title, message, recipients, password_hash) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)",
    [id, environment(), token, input.path, input.title.trim(), input.message?.trim() ?? "",
      JSON.stringify(cleanEmails(input.recipientEmails).map((email) => ({ email }))),
      input.password?.trim() ? hashPassword(input.password.trim()) : null],
  );
  return (await getShareById(id))!;
}

export async function listShares() {
  await ensureSchema();
  const rows = await getSql().query("SELECT " + COLUMNS + " FROM storage_shares s WHERE s.environment=$1 ORDER BY s.path, s.created_at", [environment()]);
  return (rows as Row[]).map(map);
}

export async function getShareById(id: string) {
  await ensureSchema();
  const rows = await getSql().query("SELECT " + COLUMNS + " FROM storage_shares s WHERE s.id=$1 AND s.environment=$2", [id, environment()]);
  return rows[0] ? map(rows[0] as Row) : undefined;
}

export async function getShareByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return undefined;
  await ensureSchema();
  const rows = await getSql().query("SELECT " + COLUMNS + " FROM storage_shares s WHERE s.token=$1 AND s.environment=$2", [token, environment()]);
  return rows[0] ? { share: map(rows[0] as Row), passwordHash: (rows[0] as Row).password_hash } : undefined;
}

export function checkSharePassword(password: string, hash: string | null) {
  return verifyTransferPassword(password, hash);
}

/** Changes the details; new email addresses are added to those already there. */
export async function updateShare(id: string, input: { title?: string; message?: string; addEmails?: string[]; removeEmail?: string; password?: string | null }) {
  const share = await getShareById(id);
  if (!share) throw new Error("That share no longer exists.");
  let recipients = cleanEmails([...share.recipients, ...(input.addEmails ?? [])]);
  if (input.removeEmail) recipients = recipients.filter((email) => email !== input.removeEmail!.trim().toLowerCase());
  const sql = getSql();
  await sql.query(
    "UPDATE storage_shares SET title=$1, message=$2, recipients=$3::jsonb WHERE id=$4 AND environment=$5",
    [input.title?.trim() || share.title, input.message ?? share.message, JSON.stringify(recipients.map((email) => ({ email }))), id, environment()],
  );
  if (input.password !== undefined) {
    await sql.query("UPDATE storage_shares SET password_hash=$1 WHERE id=$2 AND environment=$3",
      [input.password?.trim() ? hashPassword(input.password.trim()) : null, id, environment()]);
  }
  return (await getShareById(id))!;
}

/** Stops sharing: the link stops working straight away. Nothing in Storage changes. */
export async function deleteShare(id: string) {
  await ensureSchema();
  await getSql().query("DELETE FROM storage_shares WHERE id=$1 AND environment=$2", [id, environment()]);
}

export async function recordShareEvent(input: { shareId: string; recipientEmail?: string; eventType: ShareEvent["eventType"]; path: string; fileCount?: number }) {
  await ensureSchema();
  await getSql().query(
    "INSERT INTO storage_share_events (id, share_id, recipient_email, event_type, path, file_count) VALUES ($1,$2,$3,$4,$5,$6)",
    [crypto.randomUUID(), input.shareId, input.recipientEmail ?? null, input.eventType, input.path, input.fileCount ?? null],
  );
}

export async function listShareEvents(shareId: string, limit = 300) {
  await ensureSchema();
  const rows = await getSql().query(
    "SELECT id, recipient_email, event_type, path, file_count, created_at FROM storage_share_events WHERE share_id=$1 ORDER BY created_at DESC LIMIT $2",
    [shareId, limit],
  );
  return (rows as Array<{ id: string; recipient_email: string | null; event_type: string; path: string; file_count: number | null; created_at: string | Date }>).map((row): ShareEvent => ({
    id: row.id,
    ...(row.recipient_email ? { recipientEmail: row.recipient_email } : {}),
    eventType: row.event_type === "file" ? "file" : row.event_type === "folder" ? "folder" : "open",
    path: row.path,
    ...(row.file_count !== null ? { fileCount: Number(row.file_count) } : {}),
    createdAt: iso(row.created_at),
  }));
}

/** Keeps shares pointing at the right folder when it (or a folder above it) is renamed, moved, deleted or restored. */
export async function moveSharePaths(fromPath: string, toPath: string) {
  if (!fromPath || fromPath === toPath) return;
  await ensureSchema();
  await getSql().query(
    "UPDATE storage_shares SET path = $2 || substr(path, length($1) + 1) WHERE environment=$3 AND (path = $1 OR starts_with(path, $1 || '/'))",
    [fromPath, toPath, environment()],
  );
}
