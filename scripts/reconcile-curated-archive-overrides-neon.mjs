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

const expectedAccess = JSON.parse(
  await fs.readFile(
    new URL("./archive-curator/archive-access-overrides.json", import.meta.url),
    "utf8",
  ),
);
const expectedCurated = JSON.parse(
  await fs.readFile(
    new URL("./archive-curator/archive-curated-overrides.json", import.meta.url),
    "utf8",
  ),
);

const rows = await sql`
  SELECT production, access, curated_override
  FROM curated_archive_overrides
  ORDER BY production
`;

const actual = Object.fromEntries(
  rows.map((row) => [
    row.production,
    {
      access: row.access ?? null,
      curatedOverride: row.curated_override ?? null,
    },
  ]),
);

const keys = new Set([
  ...Object.keys(expectedAccess),
  ...Object.keys(expectedCurated),
]);
const errors = [];

function canonicalise(value) {
  if (Array.isArray(value)) {
    return value.map(
      canonicalise,
    );
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          canonicalise(
            value[key],
          ),
        ]),
    );
  }

  return value;
}

function structurallyEqual(
  first,
  second,
) {
  return (
    JSON.stringify(
      canonicalise(first),
    ) ===
    JSON.stringify(
      canonicalise(second),
    )
  );
}

for (const production of keys) {
  const expected = {
    access: expectedAccess[production] ?? null,
    curatedOverride: expectedCurated[production] ?? null,
  };
  const found = actual[production];
  if (!found) {
    errors.push(`Missing row: ${production}`);
    continue;
  }
  if (!structurallyEqual(
      found,
      expected,
    )) {
    errors.push(
      `${production}\nexpected: ${JSON.stringify(expected)}\nactual:   ${JSON.stringify(found)}`,
    );
  }
}

console.log(`Curated archive override rows checked: ${rows.length}`);
if (errors.length) {
  console.error(`\nRECONCILIATION FAILED: ${errors.length} mismatch(es)`);
  for (const error of errors) console.error(`\n${error}`);
  process.exit(1);
}
console.log("\nCURATED ARCHIVE OVERRIDE RECONCILIATION PASSED");
