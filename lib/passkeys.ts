import { neon } from "@neondatabase/serverless";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";

// Touch ID / Face ID ("passkeys") for Backstage. A passkey saved on Steve's
// Mac is shared with his iPhone through iCloud Keychain, so one set-up
// covers both.

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
    await sql.query("CREATE TABLE IF NOT EXISTS backstage_passkeys (id text PRIMARY KEY, environment text NOT NULL, credential_id text NOT NULL UNIQUE, public_key text NOT NULL, counter bigint NOT NULL DEFAULT 0, transports jsonb NOT NULL DEFAULT '[]'::jsonb, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), last_used_at timestamptz)");
    await sql.query("CREATE TABLE IF NOT EXISTS backstage_settings (environment text NOT NULL, key text NOT NULL, value text NOT NULL, PRIMARY KEY (environment, key))");
  })();
  return schemaPromise;
}

export const CHALLENGE_COOKIE = "stevegregson_passkey_challenge";

/** Passkeys work across www. and transfers. on the live site. */
export function relyingParty(request: Request) {
  const url = new URL(request.url);
  const host = url.hostname;
  const rpID = host === "stevegregson.com" || host.endsWith(".stevegregson.com") ? "stevegregson.com" : host;
  return { rpID, origin: url.origin };
}

function secret() {
  const value = process.env.BACKSTAGE_SESSION_SECRET?.trim();
  if (!value) throw new Error("BACKSTAGE_SESSION_SECRET is not configured.");
  return value;
}

/** The one-time challenge travels in a short-lived signed cookie. */
export function sealChallenge(challenge: string, purpose: "login" | "register") {
  const payload = Buffer.from(JSON.stringify({ challenge, purpose, exp: Date.now() + 5 * 60 * 1000 })).toString("base64url");
  return payload + "." + createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function openChallenge(sealed: string | undefined, purpose: "login" | "register") {
  if (!sealed) return undefined;
  const [payload, signature] = sealed.split(".");
  if (!payload || !signature) return undefined;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return undefined;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { challenge: string; purpose: string; exp: number };
    return data.purpose === purpose && data.exp > Date.now() ? data.challenge : undefined;
  } catch {
    return undefined;
  }
}

export function readCookie(request: Request, name: string) {
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

type Row = { id: string; credential_id: string; public_key: string; counter: string | number; transports: unknown; name: string; created_at: string | Date; last_used_at: string | Date | null };

export type Passkey = { id: string; name: string; createdAt: string; lastUsedAt?: string };

const iso = (value: string | Date) => (value instanceof Date ? value : new Date(value)).toISOString();

async function rows() {
  await ensureSchema();
  return (await getSql().query("SELECT id, credential_id, public_key, counter, transports, name, created_at, last_used_at FROM backstage_passkeys WHERE environment=$1 ORDER BY created_at", [environment()])) as Row[];
}

export async function listPasskeys(): Promise<Passkey[]> {
  return (await rows()).map((row) => ({ id: row.id, name: row.name, createdAt: iso(row.created_at), ...(row.last_used_at ? { lastUsedAt: iso(row.last_used_at) } : {}) }));
}

export async function deletePasskey(id: string) {
  await ensureSchema();
  await getSql().query("DELETE FROM backstage_passkeys WHERE id=$1 AND environment=$2", [id, environment()]);
  if (!(await rows()).length) await setPasskeyOnly(false);
}

export async function passkeyOnly() {
  await ensureSchema();
  const result = await getSql().query("SELECT value FROM backstage_settings WHERE environment=$1 AND key='passkey_only'", [environment()]);
  return (result[0] as { value?: string } | undefined)?.value === "1";
}

export async function setPasskeyOnly(on: boolean) {
  await ensureSchema();
  if (on && !(await rows()).length) throw new Error("Add Touch ID / Face ID first.");
  await getSql().query(
    "INSERT INTO backstage_settings (environment, key, value) VALUES ($1,'passkey_only',$2) ON CONFLICT (environment, key) DO UPDATE SET value = EXCLUDED.value",
    [environment(), on ? "1" : "0"],
  );
}

/** Password sign-in is allowed unless Steve switched it off (Vercel setting BACKSTAGE_ALLOW_PASSWORD=1 always re-allows it). */
export async function passwordSignInAllowed() {
  if (process.env.BACKSTAGE_ALLOW_PASSWORD?.trim() === "1") return true;
  try {
    return !(await passkeyOnly());
  } catch {
    return true;
  }
}

export async function registrationOptions(request: Request, username: string) {
  const { rpID } = relyingParty(request);
  const existing = await rows();
  return generateRegistrationOptions({
    rpName: "Steve Gregson Backstage",
    rpID,
    userName: username,
    userDisplayName: "Steve Gregson",
    attestationType: "none",
    excludeCredentials: existing.map((row) => ({ id: row.credential_id })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
}

export async function finishRegistration(request: Request, challenge: string, response: RegistrationResponseJSON, name: string) {
  const { rpID, origin } = relyingParty(request);
  const result = await verifyRegistrationResponse({
    response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
  });
  if (!result.verified || !result.registrationInfo) throw new Error("Touch ID / Face ID couldn't be set up. Please try again.");
  const { credential } = result.registrationInfo;
  await ensureSchema();
  await getSql().query(
    "INSERT INTO backstage_passkeys (id, environment, credential_id, public_key, counter, transports, name) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)",
    [crypto.randomUUID(), environment(), credential.id, Buffer.from(credential.publicKey).toString("base64url"), credential.counter,
      JSON.stringify(credential.transports ?? []), name.trim().slice(0, 60) || "Touch ID / Face ID"],
  );
}

export async function authenticationOptions(request: Request) {
  const { rpID } = relyingParty(request);
  return generateAuthenticationOptions({ rpID, userVerification: "required" });
}

export async function finishAuthentication(request: Request, challenge: string, response: AuthenticationResponseJSON) {
  const { rpID, origin } = relyingParty(request);
  const row = (await rows()).find((item) => item.credential_id === response.id);
  if (!row) throw new Error("This Touch ID / Face ID isn't set up for Backstage.");
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
    credential: {
      id: row.credential_id,
      publicKey: new Uint8Array(Buffer.from(row.public_key, "base64url")),
      counter: Number(row.counter) || 0,
      transports: Array.isArray(row.transports) ? row.transports as never : undefined,
    },
  });
  if (!result.verified) throw new Error("Touch ID / Face ID wasn't recognised.");
  await getSql().query("UPDATE backstage_passkeys SET counter=$1, last_used_at=now() WHERE id=$2", [result.authenticationInfo.newCounter, row.id]);
}
