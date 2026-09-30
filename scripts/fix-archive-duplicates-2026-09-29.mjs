import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
const sql = neon(databaseUrl);

const APPLY = process.argv.includes("--apply");

const repairs = [
  {
    label: "Dance Show 2024 duplicate",
    keepId: "99b8d3e9-f087-482a-88c3-22f1ee8f2254",
    keepSlug: "dance-show",
    removeId: "26b6b5a2-0749-44e1-a858-8770b4dfe7b1",
    removeSlug: "dance-show-2024",
    expectedTitle: "Dance Show 2024",
    expectedVenue: "Andrew Lloyd Webber Foundation Theatre",
    expectedMonth: 3,
    expectedKeepYear: 2024,
    expectedRemoveYear: 2024,
  },
  {
    label: "Antonia false 2024 duplicate",
    keepId: "a4dcfe50-d454-4f52-b94b-6d61d531ed15",
    keepSlug: "antonia-behind-the-myth-of-marie-antoinette-chalke-confidential-forum-chalke-history-festival-site-broad-chalke-june-2026",
    removeId: "2435046f-5500-5732-845a-8ab1fddd37e2",
    removeSlug: "antonia-behind-the-myth-of-marie-antoinette",
    expectedTitle: "Antonia: Behind the Myth of Marie Antoinette",
    expectedVenue: "Chalke Confidential Forum, Chalke History Festival Site, Broad Chalke",
    expectedMonth: 6,
    expectedKeepYear: 2026,
    expectedRemoveYear: 2024,
  },
  {
    label: "The Choir of Man wrong-year duplicate",
    keepId: "1ceee4b4-5625-4c79-b77e-6b01b821be3e",
    keepSlug: "the-choir-of-man",
    removeId: "0eba52dd-f572-41c5-94e8-1f9417958c58",
    removeSlug: "the-choir-of-man-the-arts-at-marble-arch-london-december-2026",
    expectedTitle: "The Choir of Man",
    expectedVenue: "The Arts at Marble Arch, London",
    expectedMonth: 12,
    expectedKeepYear: 2024,
    expectedRemoveYear: 2022,
    setKeepYear: 2026,
  },
];

function fail(message) {
  throw new Error(`SAFETY CHECK FAILED: ${message}`);
}

async function getProduction(id) {
  const rows = await sql`
    SELECT id, slug, title, venue, month, year, description,
           hero_display_filename, hero_alt, deleted_at
    FROM productions
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function getChildren(id) {
  const [images, credits] = await Promise.all([
    sql`
      SELECT id, display_filename, alt, position, deleted_at
      FROM production_images
      WHERE production_id = ${id}
      ORDER BY position, id
    `,
    sql`
      SELECT id, role, name, website, position, deleted_at
      FROM production_credits
      WHERE production_id = ${id}
      ORDER BY position, id
    `,
  ]);
  return { images, credits };
}

function active(rows) {
  return rows.filter((row) => row.deleted_at === null);
}

function sameText(a, b) {
  return String(a ?? "").trim() === String(b ?? "").trim();
}

function explicitYearFromSlug(slug) {
  const matches = [...slug.matchAll(/(?:^|-)(20\d{2})(?=-|$)/g)];
  return matches.length === 1 ? Number(matches[0][1]) : null;
}

async function preflight(repair) {
  const [keep, remove] = await Promise.all([
    getProduction(repair.keepId),
    getProduction(repair.removeId),
  ]);
  if (!keep || !remove) fail(`${repair.label}: production row missing.`);
  if (keep.deleted_at !== null || remove.deleted_at !== null) {
    fail(`${repair.label}: expected both rows to be active.`);
  }
  const expected = [
    [keep.slug, repair.keepSlug, "keeper slug"],
    [remove.slug, repair.removeSlug, "duplicate slug"],
    [keep.title, repair.expectedTitle, "keeper title"],
    [remove.title, repair.expectedTitle, "duplicate title"],
    [keep.venue, repair.expectedVenue, "keeper venue"],
    [remove.venue, repair.expectedVenue, "duplicate venue"],
    [keep.month, repair.expectedMonth, "keeper month"],
    [remove.month, repair.expectedMonth, "duplicate month"],
    [keep.year, repair.expectedKeepYear, "keeper year"],
    [remove.year, repair.expectedRemoveYear, "duplicate year"],
  ];
  for (const [actual, wanted, name] of expected) {
    if (actual !== wanted) fail(`${repair.label}: ${name} changed (${actual} != ${wanted}).`);
  }

  const redirect = await sql`
    SELECT r.id, r.production_id, p.slug AS target_slug
    FROM production_slug_redirects r
    LEFT JOIN productions p ON p.id = r.production_id
    WHERE lower(r.old_slug) = lower(${repair.removeSlug})
    LIMIT 1
  `;
  if (redirect[0] && redirect[0].production_id !== repair.keepId) {
    fail(`${repair.label}: ${repair.removeSlug} already redirects elsewhere.`);
  }

  const [keepChildren, removeChildren] = await Promise.all([
    getChildren(repair.keepId),
    getChildren(repair.removeId),
  ]);

  const keepImages = active(keepChildren.images);
  const removeImages = active(removeChildren.images);
  const keepCredits = active(keepChildren.credits);
  const removeCredits = active(removeChildren.credits);

  // We deliberately do not merge child rows automatically. These records were
  // created as duplicate archive entries. Before soft-deleting the duplicate,
  // require strong evidence that the visible content is the same shoot.
  if (!sameText(keep.hero_alt, remove.hero_alt)) {
    // Antonia is the one expected exception: the old record has generic alt text.
    if (repair.label !== "Antonia false 2024 duplicate") {
      fail(`${repair.label}: hero alt text differs unexpectedly.`);
    }
  }

  console.log(`\n${repair.label}`);
  console.log(`  KEEP   ${keep.slug} (${keep.year}) — ${keepImages.length} images, ${keepCredits.length} credits`);
  console.log(`  REMOVE ${remove.slug} (${remove.year}) — ${removeImages.length} images, ${removeCredits.length} credits`);
  console.log(`  REDIRECT /productions/${remove.slug} -> /productions/${keep.slug}`);
  if (repair.setKeepYear) console.log(`  CORRECT keeper year ${keep.year} -> ${repair.setKeepYear}`);

  return { keep, remove, redirectExists: Boolean(redirect[0]) };
}

async function applyRepair(repair, state) {
  const queries = [];

  if (repair.setKeepYear) {
    queries.push(sql`
      UPDATE productions
      SET year = ${repair.setKeepYear}, version = version + 1, updated_at = now()
      WHERE id = ${repair.keepId}
        AND slug = ${repair.keepSlug}
        AND year = ${repair.expectedKeepYear}
        AND deleted_at IS NULL
      RETURNING id
    `);
  }

  queries.push(sql`
    UPDATE production_images
    SET deleted_at = now(), updated_at = now()
    WHERE production_id = ${repair.removeId}
      AND deleted_at IS NULL
    RETURNING id
  `);
  queries.push(sql`
    UPDATE production_credits
    SET deleted_at = now(), updated_at = now()
    WHERE production_id = ${repair.removeId}
      AND deleted_at IS NULL
    RETURNING id
  `);
  queries.push(sql`
    UPDATE productions
    SET deleted_at = now(), version = version + 1, updated_at = now()
    WHERE id = ${repair.removeId}
      AND slug = ${repair.removeSlug}
      AND deleted_at IS NULL
    RETURNING id
  `);

  if (!state.redirectExists) {
    queries.push(sql`
      INSERT INTO production_slug_redirects (id, production_id, old_slug, created_at)
      VALUES (${randomUUID()}, ${repair.keepId}, ${repair.removeSlug}, now())
      RETURNING id
    `);
  }

  const result = await sql.transaction(queries);
  const productionUpdate = result[repair.setKeepYear ? 3 : 2];
  if (productionUpdate.length !== 1) {
    fail(`${repair.label}: duplicate production was not soft-deleted exactly once.`);
  }
}

console.log(APPLY ? "MODE: APPLY" : "MODE: DRY RUN");
const states = [];
for (const repair of repairs) states.push(await preflight(repair));

if (!APPLY) {
  console.log("\nDRY RUN PASSED. Re-run with --apply to commit all three repairs in one pass.");
  process.exit(0);
}

for (let i = 0; i < repairs.length; i += 1) {
  await applyRepair(repairs[i], states[i]);
}

console.log("\nAPPLY COMPLETE. Verifying...");
for (const repair of repairs) {
  const [keep, remove, redirect] = await Promise.all([
    getProduction(repair.keepId),
    getProduction(repair.removeId),
    sql`
      SELECT p.slug AS target_slug
      FROM production_slug_redirects r
      INNER JOIN productions p ON p.id = r.production_id
      WHERE lower(r.old_slug) = lower(${repair.removeSlug})
      LIMIT 1
    `,
  ]);
  if (!keep || keep.deleted_at !== null) fail(`${repair.label}: keeper is not active after apply.`);
  if (!remove || remove.deleted_at === null) fail(`${repair.label}: duplicate is still active after apply.`);
  if (repair.setKeepYear && keep.year !== repair.setKeepYear) fail(`${repair.label}: corrected year did not persist.`);
  if (redirect[0]?.target_slug !== repair.keepSlug) fail(`${repair.label}: redirect verification failed.`);
  console.log(`  PASS ${repair.label}`);
}

const [remainingDuplicates, missingImageAlts, activeRows] = await Promise.all([
  sql`
    SELECT lower(trim(title)) AS title_key, lower(trim(venue)) AS venue_key, month, year, count(*)::int AS count
    FROM productions
    WHERE deleted_at IS NULL
    GROUP BY lower(trim(title)), lower(trim(venue)), month, year
    HAVING count(*) > 1
  `,
  sql`
    SELECT p.slug, i.display_filename
    FROM production_images i
    INNER JOIN productions p ON p.id = i.production_id
    WHERE p.deleted_at IS NULL
      AND i.deleted_at IS NULL
      AND (i.alt IS NULL OR trim(i.alt) = '')
    ORDER BY p.slug, i.position
  `,
  sql`
    SELECT slug, year
    FROM productions
    WHERE deleted_at IS NULL
  `,
]);

if (remainingDuplicates.length) {
  fail(`Exact active production duplicates remain: ${JSON.stringify(remainingDuplicates)}`);
}

if (missingImageAlts.length) {
  fail(`Active gallery images still missing alt text: ${JSON.stringify(missingImageAlts)}`);
}

const yearMismatches = activeRows.filter((row) => {
  const slugYear = explicitYearFromSlug(row.slug);
  return slugYear !== null && slugYear !== row.year;
});

if (yearMismatches.length) {
  fail(`Active slug/year mismatches remain: ${JSON.stringify(yearMismatches)}`);
}

console.log("\nALL ARCHIVE DATA REPAIRS AND INTEGRITY CHECKS PASSED.");
