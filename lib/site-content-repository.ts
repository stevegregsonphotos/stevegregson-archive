import "server-only";

import { neon } from "@neondatabase/serverless";

/*
 * Small key/value store for page settings edited in Backstage
 * (the Selected Work page and the Commissions page images).
 *
 * The table is created on first save, so no manual migration is needed.
 * Until something has been saved, reads return null and pages fall back to
 * the defaults written in code. Schema for reference:
 * scripts/migrations/2026-10-02-site-content.sql
 */

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return neon(databaseUrl);
}

function isMissingTable(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "42P01"
  );
}

export async function getSiteContent<T>(key: string): Promise<T | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT value
      FROM site_content
      WHERE key = ${key}
      LIMIT 1
    `;

    const row = rows[0] as { value: T } | undefined;
    return row ? row.value : null;
  } catch (error) {
    if (isMissingTable(error)) {
      return null;
    }

    throw error;
  }
}

export async function saveSiteContent(key: string, value: unknown) {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS site_content (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    INSERT INTO site_content (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}
