import fs from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  requiredEnv("DATABASE_URL_UNPOOLED");
const sql = neon(databaseUrl);

const access = JSON.parse(
  await fs.readFile(
    new URL("./archive-curator/archive-access-overrides.json", import.meta.url),
    "utf8",
  ),
);
const curated = JSON.parse(
  await fs.readFile(
    new URL("./archive-curator/archive-curated-overrides.json", import.meta.url),
    "utf8",
  ),
);

const productions = new Set([
  ...Object.keys(access),
  ...Object.keys(curated),
]);

for (const production of productions) {
  const accessValue = access[production] ?? null;
  const curatedValue = curated[production] ?? null;
  const curatedJson = curatedValue ? JSON.stringify(curatedValue) : null;

  await sql`
    INSERT INTO curated_archive_overrides (
      production,
      access,
      curated_override,
      created_at,
      updated_at
    ) VALUES (
      ${production},
      ${accessValue},
      ${curatedJson}::jsonb,
      now(),
      now()
    )
    ON CONFLICT (production)
    DO UPDATE SET
      access = excluded.access,
      curated_override = excluded.curated_override,
      updated_at = now()
  `;
}

console.log(`Imported ${productions.size} curated archive override row(s).`);
