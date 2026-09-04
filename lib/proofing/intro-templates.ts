import { neon } from "@neondatabase/serverless";

export type ProofingIntroTemplate = {
  id: string;
  name: string;
  message: string;
  isDefault: boolean;
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

function mapTemplate(row: {
  id: string;
  name: string;
  message: string;
  is_default: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}): ProofingIntroTemplate {
  return {
    id: row.id,
    name: row.name,
    message: row.message,
    isDefault: row.is_default,
    createdAt: new Date(
      row.created_at,
    ).toISOString(),
    updatedAt: new Date(
      row.updated_at,
    ).toISOString(),
  };
}

export async function getProofingIntroTemplates():
  Promise<ProofingIntroTemplate[]> {
  const sql = getSql();

  const rows = await sql`
    SELECT
      id,
      name,
      message,
      is_default,
      created_at,
      updated_at
    FROM proofing_intro_templates
    ORDER BY created_at ASC
  `;

  return rows.map((row) =>
    mapTemplate(
      row as Parameters<typeof mapTemplate>[0],
    ),
  );
}

export async function saveProofingIntroTemplates(
  templates: ProofingIntroTemplate[],
) {
  const sql = getSql();

  const existing = await sql`
    SELECT id
    FROM proofing_intro_templates
  `;

  const wantedIds = new Set(
    templates.map((template) => template.id),
  );

  for (const row of existing) {
    const id = String(row.id);

    if (!wantedIds.has(id)) {
      await sql`
        DELETE FROM proofing_intro_templates
        WHERE id = ${id}
      `;
    }
  }

  for (const template of templates) {
    await sql`
      INSERT INTO proofing_intro_templates (
        id,
        name,
        message,
        is_default,
        created_at,
        updated_at
      )
      VALUES (
        ${template.id},
        ${template.name},
        ${template.message},
        ${template.isDefault},
        ${template.createdAt},
        ${template.updatedAt}
      )
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        message = EXCLUDED.message,
        is_default = EXCLUDED.is_default,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at
    `;
  }
}

export async function getDefaultProofingIntroTemplate() {
  const sql = getSql();

  const rows = await sql`
    SELECT
      id,
      name,
      message,
      is_default,
      created_at,
      updated_at
    FROM proofing_intro_templates
    WHERE is_default = true
    ORDER BY created_at ASC
    LIMIT 1
  `;

  const row = rows[0];

  return row
    ? mapTemplate(
        row as Parameters<typeof mapTemplate>[0],
      )
    : undefined;
}
