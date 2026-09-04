import { neon } from "@neondatabase/serverless";

export type ProofingWatermarkPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type ProofingWatermark = {
  id: string;
  name: string;
  filename: string;
  createdAt: string;
  updatedAt: string;
};

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured.",
    );
  }

  return neon(databaseUrl);
}

function mapWatermark(row: {
  id: string;
  name: string;
  filename: string;
  created_at: Date | string;
  updated_at: Date | string;
}): ProofingWatermark {
  return {
    id: row.id,
    name: row.name,
    filename: row.filename,
    createdAt: new Date(
      row.created_at,
    ).toISOString(),
    updatedAt: new Date(
      row.updated_at,
    ).toISOString(),
  };
}

export async function getProofingWatermarks():
  Promise<ProofingWatermark[]> {
  const sql = getSql();

  const rows = await sql`
    SELECT
      id,
      name,
      filename,
      created_at,
      updated_at
    FROM proofing_watermarks
    ORDER BY created_at ASC
  `;

  return rows.map((row) =>
    mapWatermark(
      row as Parameters<typeof mapWatermark>[0],
    ),
  );
}

export async function saveProofingWatermarks(
  watermarks: ProofingWatermark[],
) {
  const sql = getSql();

  for (const watermark of watermarks) {
    await sql`
      INSERT INTO proofing_watermarks (
        id,
        name,
        filename,
        created_at,
        updated_at
      )
      VALUES (
        ${watermark.id},
        ${watermark.name},
        ${watermark.filename},
        ${watermark.createdAt},
        ${watermark.updatedAt}
      )
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        filename = EXCLUDED.filename,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at
    `;
  }
}

export async function getProofingWatermark(
  id: string,
) {
  const sql = getSql();

  const rows = await sql`
    SELECT
      id,
      name,
      filename,
      created_at,
      updated_at
    FROM proofing_watermarks
    WHERE id = ${id}
    LIMIT 1
  `;

  const row = rows[0];

  return row
    ? mapWatermark(
        row as Parameters<typeof mapWatermark>[0],
      )
    : undefined;
}
