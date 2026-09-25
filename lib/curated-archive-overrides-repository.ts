import "server-only";

import { neon } from "@neondatabase/serverless";

export type CuratedArchiveAccess =
  | "public"
  | "password";

export type CuratedArchiveCredit = {
  role: string;
  name: string;
  website?: string;
};

export type CuratedArchiveImageEditSettings = {
  aspect: "original" | "3:2" | "4:5" | "1:1" | "16:9";
  zoom: number;
  panX: number;
  panY: number;
  brightness: number;
  autoStrength: number;
};

export type CuratedArchiveImageOverride = {
  heroIndex: number;
  selectedIndexes: number[];
  edits?: Record<string, CuratedArchiveImageEditSettings>;
};

export type CuratedArchiveOverride = {
  title?: string;
  venue?: string;
  month?: number;
  year?: number;
  description?: string;
  credits?: CuratedArchiveCredit[];
  images?: CuratedArchiveImageOverride;
  excluded?: boolean;
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

export async function getCuratedArchiveAccessOverrides() {
  const sql = getSql();

  const rows = await sql`
    SELECT production, access
    FROM curated_archive_overrides
    WHERE access IS NOT NULL
  `;

  return Object.fromEntries(
    rows.map((row) => [
      row.production as string,
      row.access as CuratedArchiveAccess,
    ]),
  ) as Record<string, CuratedArchiveAccess>;
}

export async function getCuratedArchiveOverrides() {
  const sql = getSql();

  const rows = await sql`
    SELECT production, curated_override
    FROM curated_archive_overrides
    WHERE curated_override IS NOT NULL
  `;

  return Object.fromEntries(
    rows.map((row) => [
      row.production as string,
      row.curated_override as CuratedArchiveOverride,
    ]),
  ) as Record<string, CuratedArchiveOverride>;
}

export async function setCuratedArchiveAccessOverride(
  production: string,
  access: CuratedArchiveAccess | null,
) {
  const sql = getSql();

  await sql`
    INSERT INTO curated_archive_overrides (
      production,
      access,
      curated_override,
      created_at,
      updated_at
    )
    VALUES (
      ${production},
      ${access},
      null,
      now(),
      now()
    )
    ON CONFLICT (production)
    DO UPDATE SET
      access = excluded.access,
      updated_at = now()
  `;

  await sql`
    DELETE FROM curated_archive_overrides
    WHERE production = ${production}
      AND access IS NULL
      AND curated_override IS NULL
  `;
}

export async function setCuratedArchiveExclusionOverride(
  production: string,
  excluded: boolean | null,
) {
  const overrides =
    await getCuratedArchiveOverrides();

  const existing =
    overrides[production] ?? {};

  const next =
    excluded === null
      ? (() => {
          const {
            excluded: _excluded,
            ...remaining
          } = existing;

          return remaining;
        })()
      : {
          ...existing,
          excluded,
        };

  await setCuratedArchiveOverride(
    production,
    Object.keys(next).length > 0
      ? next
      : null,
  );
}

export async function setCuratedArchiveOverride(
  production: string,
  override: CuratedArchiveOverride | null,
) {
  const sql = getSql();
  const json = override
    ? JSON.stringify(override)
    : null;

  await sql`
    INSERT INTO curated_archive_overrides (
      production,
      access,
      curated_override,
      created_at,
      updated_at
    )
    VALUES (
      ${production},
      null,
      ${json}::jsonb,
      now(),
      now()
    )
    ON CONFLICT (production)
    DO UPDATE SET
      curated_override = excluded.curated_override,
      updated_at = now()
  `;

  await sql`
    DELETE FROM curated_archive_overrides
    WHERE production = ${production}
      AND access IS NULL
      AND curated_override IS NULL
  `;
}
