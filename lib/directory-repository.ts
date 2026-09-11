import "server-only";

import { neon } from "@neondatabase/serverless";

import {
  getDirectoryUrlFromData,
  type DirectoryData,
} from "./directory-data";

export {
  getDirectoryUrlFromData,
} from "./directory-data";

export type {
  DirectoryData,
} from "./directory-data";

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

export async function getDirectory():
  Promise<DirectoryData> {
  const sql = getSql();

  const [
    venues,
    companies,
    people,
  ] = await Promise.all([
    sql`
      SELECT display_name, url
      FROM directory_venues
      WHERE deleted_at IS NULL
      ORDER BY display_name
    `,
    sql`
      SELECT display_name, url
      FROM directory_companies
      WHERE deleted_at IS NULL
      ORDER BY display_name
    `,
    sql`
      SELECT display_name, url
      FROM directory_people
      WHERE deleted_at IS NULL
      ORDER BY display_name
    `,
  ]);

  return {
    venues: Object.fromEntries(
      venues.map((row) => [
        row.display_name,
        {
          url: row.url,
        },
      ])
    ),
    companies: Object.fromEntries(
      companies.map((row) => [
        row.display_name,
        {
          url: row.url,
        },
      ])
    ),
    people: Object.fromEntries(
      people.map((row) => [
        row.display_name,
        {
          url: row.url,
        },
      ])
    ),
  };
}

export async function getDirectoryUrl(
  name: string,
) {
  const directory =
    await getDirectory();

  return getDirectoryUrlFromData(
    directory,
    name,
  );
}
