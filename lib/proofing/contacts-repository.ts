import { randomUUID } from "node:crypto";

import { neon } from "@neondatabase/serverless";

import type {
  ProofingCompany,
  ProofingContact,
} from "./types";

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured.",
    );
  }

  return neon(databaseUrl);
}

function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

function mapCompany(row: {
  id: string;
  name: string;
  created_at: Date | string;
  updated_at: Date | string;
}): ProofingCompany {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(
      row.created_at,
    ).toISOString(),
    updatedAt: new Date(
      row.updated_at,
    ).toISOString(),
  };
}

function mapContact(row: {
  id: string;
  name: string;
  email: string;
  company_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}): ProofingContact {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    companyId: row.company_id ?? undefined,
    createdAt: new Date(
      row.created_at,
    ).toISOString(),
    updatedAt: new Date(
      row.updated_at,
    ).toISOString(),
  };
}

export async function getProofingCompanies() {
  const sql = getSql();

  const rows = await sql`
    SELECT
      id,
      name,
      created_at,
      updated_at
    FROM proofing_companies
    ORDER BY name ASC
  `;

  return rows.map((row) =>
    mapCompany(
      row as Parameters<typeof mapCompany>[0],
    ),
  );
}

export async function getProofingContacts() {
  const sql = getSql();

  const rows = await sql`
    SELECT
      id,
      name,
      email,
      company_id,
      created_at,
      updated_at
    FROM proofing_contacts
    ORDER BY name ASC
  `;

  return rows.map((row) =>
    mapContact(
      row as Parameters<typeof mapContact>[0],
    ),
  );
}

export async function getProofingContact(
  id: string,
) {
  const sql = getSql();

  const rows = await sql`
    SELECT
      id,
      name,
      email,
      company_id,
      created_at,
      updated_at
    FROM proofing_contacts
    WHERE id = ${id}
    LIMIT 1
  `;

  const row = rows[0];

  return row
    ? mapContact(
        row as Parameters<typeof mapContact>[0],
      )
    : undefined;
}

export async function createProofingCompany(
  name: string,
): Promise<ProofingCompany> {
  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error("Company name is required.");
  }

  const sql = getSql();
  const now = new Date().toISOString();
  const id = randomUUID();

  const rows = await sql`
    INSERT INTO proofing_companies (
      id,
      name,
      created_at,
      updated_at
    )
    VALUES (
      ${id},
      ${cleanName},
      ${now},
      ${now}
    )
    ON CONFLICT (
      LOWER(name)
    )
    DO UPDATE SET
      name = proofing_companies.name
    RETURNING
      id,
      name,
      created_at,
      updated_at
  `;

  return mapCompany(
    rows[0] as Parameters<typeof mapCompany>[0],
  );
}

export async function updateProofingContact(
  id: string,
  input: {
    name: string;
    email: string;
    companyId?: string;
  },
): Promise<ProofingContact> {
  const name = input.name.trim();
  const email = normaliseEmail(input.email);
  const companyId =
    input.companyId?.trim() || undefined;

  if (!name) {
    throw new Error("Contact name is required.");
  }

  if (!email) {
    throw new Error("Contact email is required.");
  }

  const sql = getSql();

  if (companyId) {
    const companies = await sql`
      SELECT id
      FROM proofing_companies
      WHERE id = ${companyId}
      LIMIT 1
    `;

    if (!companies[0]) {
      throw new Error(
        "Selected company could not be found.",
      );
    }
  }

  const duplicate = await sql`
    SELECT id
    FROM proofing_contacts
    WHERE email = ${email}
      AND id <> ${id}
    LIMIT 1
  `;

  if (duplicate[0]) {
    throw new Error(
      "A contact with this email already exists.",
    );
  }

  const rows = await sql`
    UPDATE proofing_contacts
    SET
      name = ${name},
      email = ${email},
      company_id = ${companyId ?? null},
      updated_at = ${new Date().toISOString()}
    WHERE id = ${id}
    RETURNING
      id,
      name,
      email,
      company_id,
      created_at,
      updated_at
  `;

  if (!rows[0]) {
    throw new Error(
      "Contact could not be found.",
    );
  }

  return mapContact(
    rows[0] as Parameters<typeof mapContact>[0],
  );
}

export async function deleteProofingContact(
  id: string,
) {
  const sql = getSql();

  const rows = await sql`
    DELETE FROM proofing_contacts
    WHERE id = ${id}
    RETURNING id
  `;

  if (!rows[0]) {
    throw new Error(
      "Contact could not be found.",
    );
  }
}

export async function createProofingContact(input: {
  name: string;
  email: string;
  companyId?: string;
}): Promise<ProofingContact> {
  const name = input.name.trim();
  const email = normaliseEmail(input.email);
  const companyId =
    input.companyId?.trim() || undefined;

  if (!name) {
    throw new Error("Contact name is required.");
  }

  if (!email) {
    throw new Error("Contact email is required.");
  }

  const sql = getSql();

  if (companyId) {
    const companies = await sql`
      SELECT id
      FROM proofing_companies
      WHERE id = ${companyId}
      LIMIT 1
    `;

    if (!companies[0]) {
      throw new Error(
        "Selected company could not be found.",
      );
    }
  }

  const existing = await sql`
    SELECT id
    FROM proofing_contacts
    WHERE email = ${email}
    LIMIT 1
  `;

  if (existing[0]) {
    throw new Error(
      "A contact with this email already exists.",
    );
  }

  const now = new Date().toISOString();

  const rows = await sql`
    INSERT INTO proofing_contacts (
      id,
      name,
      email,
      company_id,
      created_at,
      updated_at
    )
    VALUES (
      ${randomUUID()},
      ${name},
      ${email},
      ${companyId ?? null},
      ${now},
      ${now}
    )
    RETURNING
      id,
      name,
      email,
      company_id,
      created_at,
      updated_at
  `;

  return mapContact(
    rows[0] as Parameters<typeof mapContact>[0],
  );
}
