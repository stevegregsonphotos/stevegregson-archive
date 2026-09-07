import { createHash } from "node:crypto";

import { neon } from "@neondatabase/serverless";

const MAX_SUBMISSIONS = 5;
const WINDOW_MS = 60 * 60 * 1000;

type RateLimitRow = {
  submission_count: number;
  first_submission_at: Date | string;
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
    request.headers.get("x-forwarded-for");

  return (
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function rateLimitKey(request: Request) {
  return createHash("sha256")
    .update(
      `contact:${clientAddress(request)}`,
      "utf8",
    )
    .digest("hex");
}

export async function isContactRateLimited(
  request: Request,
) {
  const sql = getSql();
  const key = rateLimitKey(request);

  const rows = await sql`
    SELECT
      submission_count,
      first_submission_at
    FROM contact_rate_limits
    WHERE attempt_key = ${key}
    LIMIT 1
  `;

  const row =
    rows[0] as RateLimitRow | undefined;

  if (!row) {
    return false;
  }

  const firstSubmission =
    new Date(row.first_submission_at).getTime();

  if (
    !Number.isFinite(firstSubmission) ||
    Date.now() - firstSubmission >= WINDOW_MS
  ) {
    await sql`
      DELETE FROM contact_rate_limits
      WHERE attempt_key = ${key}
    `;

    return false;
  }

  return (
    Number(row.submission_count) >=
    MAX_SUBMISSIONS
  );
}

export async function recordContactSubmission(
  request: Request,
) {
  const sql = getSql();
  const key = rateLimitKey(request);

  await sql`
    INSERT INTO contact_rate_limits (
      attempt_key,
      submission_count,
      first_submission_at,
      last_submission_at
    )
    VALUES (
      ${key},
      1,
      NOW(),
      NOW()
    )
    ON CONFLICT (attempt_key)
    DO UPDATE SET
      submission_count =
        CASE
          WHEN contact_rate_limits.first_submission_at
            <= NOW() - INTERVAL '1 hour'
          THEN 1
          ELSE contact_rate_limits.submission_count + 1
        END,
      first_submission_at =
        CASE
          WHEN contact_rate_limits.first_submission_at
            <= NOW() - INTERVAL '1 hour'
          THEN NOW()
          ELSE contact_rate_limits.first_submission_at
        END,
      last_submission_at = NOW()
  `;
}
