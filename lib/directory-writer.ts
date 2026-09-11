import { randomUUID } from "node:crypto";

import { neon } from "@neondatabase/serverless";

import {
  getDirectory,
} from "./directory-repository";

type DirectoryCategory =
  | "venues"
  | "companies"
  | "people";

type DirectoryEntry = {
  url: string;
};

type DirectoryData = {
  venues: Record<string, DirectoryEntry>;
  companies: Record<string, DirectoryEntry>;
  people: Record<string, DirectoryEntry>;
};

export type DirectoryCredit = {
  role: string;
  name: string;
  website?: string;
};

export type DirectoryConflict = {
  category: DirectoryCategory;
  name: string;
  existingUrl: string;
  submittedUrl: string;
};

export type DirectorySyncResult = {
  added: Array<{
    category: DirectoryCategory;
    name: string;
    url: string;
  }>;
  unchanged: Array<{
    category: DirectoryCategory;
    name: string;
    url: string;
  }>;
  conflicts: DirectoryConflict[];
};

export type PreparedDirectorySync = {
  result: DirectorySyncResult;
  source: string;
  changed: boolean;
};

function normaliseName(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-GB");
}

function normaliseUrl(value: string) {
  const trimmed = value.trim();

  try {
    const parsed = new URL(trimmed);

    parsed.hash = "";

    const pathname =
      parsed.pathname === "/"
        ? ""
        : parsed.pathname.replace(/\/+$/, "");

    return `${parsed.protocol}//${parsed.host.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

function categoryForRole(
  role: string,
): DirectoryCategory {
  const normalised = role
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-GB");

  const companyRoles = new Set([
    "commissioned by",
    "produced by",
    "production company",
    "company",
    "presented by",
  ]);

  return companyRoles.has(normalised)
    ? "companies"
    : "people";
}

function findExistingName(
  section: Record<string, DirectoryEntry>,
  name: string,
) {
  const wanted = normaliseName(name);

  return Object.keys(section).find(
    (existingName) =>
      normaliseName(existingName) === wanted,
  );
}

function findExistingNameByUrl(
  section: Record<string, DirectoryEntry>,
  url: string,
) {
  const wanted = normaliseUrl(url);

  return Object.keys(section).find(
    (existingName) =>
      normaliseUrl(
        section[existingName].url,
      ) === wanted,
  );
}

function parseDirectorySource(
  source: string,
): DirectoryData {
  const parsed =
    JSON.parse(source) as DirectoryData;

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !parsed.venues ||
    !parsed.companies ||
    !parsed.people
  ) {
    throw new Error(
      "The website directory is invalid.",
    );
  }

  return parsed;
}

export function prepareDirectoryCredits(
  source: string,
  credits: DirectoryCredit[],
): PreparedDirectorySync {
  const directory =
    parseDirectorySource(source);

  const result: DirectorySyncResult = {
    added: [],
    unchanged: [],
    conflicts: [],
  };

  let changed = false;

  for (const credit of credits) {
    const role = credit.role.trim();
    const name = credit.name
      .trim()
      .replace(/\s+/g, " ");
    const website = credit.website?.trim();

    if (!role || !name || !website) {
      continue;
    }

    const category = categoryForRole(role);
    const section = directory[category];

    const existingName =
      findExistingName(section, name);

    const existingNameByUrl =
      findExistingNameByUrl(
        section,
        website,
      );

    if (
      !existingName &&
      existingNameByUrl
    ) {
      result.unchanged.push({
        category,
        name: existingNameByUrl,
        url:
          section[
            existingNameByUrl
          ].url,
      });

      continue;
    }

    if (!existingName) {
      section[name] = {
        url: website,
      };

      result.added.push({
        category,
        name,
        url: website,
      });

      changed = true;
      continue;
    }

    const existingUrl =
      section[existingName].url;

    if (
      normaliseUrl(existingUrl) ===
      normaliseUrl(website)
    ) {
      result.unchanged.push({
        category,
        name: existingName,
        url: existingUrl,
      });

      continue;
    }

    result.conflicts.push({
      category,
      name: existingName,
      existingUrl,
      submittedUrl: website,
    });
  }

  return {
    result,
    source:
      `${JSON.stringify(directory, null, 2)}\n`,
    changed,
  };
}

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

function tableForCategory(
  category: DirectoryCategory,
) {
  switch (category) {
    case "venues":
      return "directory_venues";
    case "companies":
      return "directory_companies";
    case "people":
      return "directory_people";
  }
}

export async function rememberDirectoryCredits(
  credits: DirectoryCredit[],
): Promise<DirectorySyncResult> {
  const directory =
    await getDirectory();

  const prepared =
    prepareDirectoryCredits(
      `${JSON.stringify(
        directory,
        null,
        2,
      )}\n`,
      credits,
    );

  if (!prepared.changed) {
    return prepared.result;
  }

  const sql = getSql();

  for (const item of prepared.result.added) {
    const tableName =
      tableForCategory(
        item.category,
      );

    await sql`
      INSERT INTO ${sql.unsafe(tableName)} (
        id,
        display_name,
        url,
        created_at,
        updated_at,
        deleted_at
      )
      VALUES (
        ${randomUUID()},
        ${item.name},
        ${item.url},
        now(),
        now(),
        null
      )
    `;
  }

  return prepared.result;
}
