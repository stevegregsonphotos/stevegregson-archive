import { createHash } from "node:crypto";

import { neon } from "@neondatabase/serverless";

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

type AttemptRow = {
  failed_count: number;
  first_failed_at: Date | string;
};

function getSql() {
  const databaseUrl =
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured.",
    );
  }

  return neon(databaseUrl);
}

function clientAddress(request: Request) {
  const forwarded =
    request.headers.get(
      "x-forwarded-for",
    );

  const address =
    forwarded
      ?.split(",")[0]
      ?.trim() ||
    request.headers
      .get("x-real-ip")
      ?.trim() ||
    "unknown";

  return address;
}

function attemptKey(request: Request) {
  return createHash("sha256")
    .update(
      `backstage-login:${clientAddress(request)}`,
      "utf8",
    )
    .digest("hex");
}

export async function isBackstageLoginRateLimited(
  request: Request,
) {
  const sql = getSql();
  const key = attemptKey(request);

  const rows = await sql`
    SELECT
      failed_count,
      first_failed_at
    FROM backstage_login_attempts
    WHERE attempt_key = ${key}
    LIMIT 1
  `;

  const row =
    rows[0] as AttemptRow | undefined;

  if (!row) {
    return false;
  }

  const firstFailedAt =
    new Date(
      row.first_failed_at,
    ).getTime();

  if (
    !Number.isFinite(firstFailedAt) ||
    Date.now() - firstFailedAt >=
      WINDOW_MS
  ) {
    await sql`
      DELETE FROM backstage_login_attempts
      WHERE attempt_key = ${key}
    `;

    return false;
  }

  return (
    Number(row.failed_count) >=
    MAX_FAILED_ATTEMPTS
  );
}

export async function recordBackstageLoginFailure(
  request: Request,
) {
  const sql = getSql();
  const key = attemptKey(request);

  await sql`
    INSERT INTO backstage_login_attempts (
      attempt_key,
      failed_count,
      first_failed_at,
      last_failed_at
    )
    VALUES (
      ${key},
      1,
      NOW(),
      NOW()
    )
    ON CONFLICT (attempt_key)
    DO UPDATE SET
      failed_count =
        CASE
          WHEN backstage_login_attempts.first_failed_at
            <= NOW() - INTERVAL '15 minutes'
          THEN 1
          ELSE backstage_login_attempts.failed_count + 1
        END,
      first_failed_at =
        CASE
          WHEN backstage_login_attempts.first_failed_at
            <= NOW() - INTERVAL '15 minutes'
          THEN NOW()
          ELSE backstage_login_attempts.first_failed_at
        END,
      last_failed_at = NOW()
  `;
}

export async function clearBackstageLoginFailures(
  request: Request,
) {
  const sql = getSql();
  const key = attemptKey(request);

  await sql`
    DELETE FROM backstage_login_attempts
    WHERE attempt_key = ${key}
  `;
}
