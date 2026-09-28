import { neon } from "@neondatabase/serverless";

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

function createExpectedSlug(value) {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/*
 * This deliberately reproduces the old slug behaviour.
 * It lets the health check recognise historical URLs where
 * accented letters were lost instead of transliterated.
 */
function createLegacyBrokenSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  requiredEnv("DATABASE_URL_UNPOOLED");

const sql = neon(databaseUrl);

const productions = await sql`
  SELECT
    id,
    slug,
    title,
    venue,
    month,
    year,
    access,
    deleted_at
  FROM productions
  WHERE deleted_at IS NULL
  ORDER BY lower(title), year, month, lower(venue)
`;

const errors = [];
const warnings = [];

const bySlug = new Map();
const byIdentity = new Map();

for (const production of productions) {
  const slug = String(production.slug ?? "").trim();
  const title = String(production.title ?? "").trim();
  const venue = String(production.venue ?? "").trim();
  const month = production.month ?? null;
  const year = production.year ?? null;

  const expectedTitleSlug =
    createExpectedSlug(title);

  const legacyBrokenTitleSlug =
    createLegacyBrokenSlug(title);

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errors.push({
      type: "invalid-slug-format",
      slug,
      title,
      message:
        "Slug contains unexpected characters or structure.",
    });
  }

  /*
   * A title whose corrected and legacy forms differ
   * contains characters the old generator mishandled.
   * If the stored slug begins with that legacy form,
   * this is a confirmed historical Unicode-slug defect.
   */
  if (
    expectedTitleSlug !== legacyBrokenTitleSlug &&
    (
      slug === legacyBrokenTitleSlug ||
      slug.startsWith(`${legacyBrokenTitleSlug}-`)
    ) &&
    !(
      slug === expectedTitleSlug ||
      slug.startsWith(`${expectedTitleSlug}-`)
    )
  ) {
    const suggestedSlug =
      `${expectedTitleSlug}${slug.slice(
        legacyBrokenTitleSlug.length,
      )}`;

    errors.push({
      type: "legacy-unicode-slug",
      slug,
      title,
      expectedTitleSlug:
        suggestedSlug,
      message:
        "Slug matches the historical generator that dropped accented characters.",
    });
  } else if (
    expectedTitleSlug &&
    !slug.includes(expectedTitleSlug) &&
    !expectedTitleSlug.includes(slug)
  ) {
    warnings.push({
      type: "title-slug-mismatch",
      slug,
      title,
      expectedTitleSlug,
      message:
        "Stored slug does not closely match the current title. This may be intentional.",
    });
  }

  const lowerSlug = slug.toLowerCase();

  if (bySlug.has(lowerSlug)) {
    errors.push({
      type: "duplicate-slug",
      slug,
      title,
      other: bySlug.get(lowerSlug),
      message: "Duplicate active slug.",
    });
  } else {
    bySlug.set(lowerSlug, {
      title,
      venue,
      month,
      year,
    });
  }

  const identityKey = [
    title.toLowerCase(),
    venue.toLowerCase(),
    month ?? "",
    year ?? "",
  ].join("|");

  if (byIdentity.has(identityKey)) {
    warnings.push({
      type: "possible-duplicate-production",
      slug,
      title,
      venue,
      month,
      year,
      other: byIdentity.get(identityKey),
      message:
        "Another active production has the same title, venue and date. This may be intentional.",
    });
  } else {
    byIdentity.set(identityKey, {
      slug,
      title,
      venue,
      month,
      year,
    });
  }
}

console.log("\n=== PRODUCTION URL HEALTH ===");
console.log(
  `Active productions checked: ${productions.length}`,
);
console.log(`Errors: ${errors.length}`);
console.log(`Warnings: ${warnings.length}`);

if (errors.length) {
  console.log("\n=== ERRORS ===");

  for (const issue of errors) {
    console.log(
      `[${issue.type}] ${issue.slug} — ${issue.title}`,
    );

    if (issue.expectedTitleSlug) {
      console.log(
        `  suggested: ${issue.expectedTitleSlug}`,
      );
    }

    console.log(`  ${issue.message}`);
  }
}

if (warnings.length) {
  console.log("\n=== WARNINGS ===");

  for (const issue of warnings) {
    console.log(
      `[${issue.type}] ${issue.slug} — ${issue.title}`,
    );

    if (issue.expectedTitleSlug) {
      console.log(
        `  title-derived-slug: ${issue.expectedTitleSlug}`,
      );
    }

    console.log(`  ${issue.message}`);
  }
}

console.log("");

if (errors.length) {
  console.error(
    "PRODUCTION URL HEALTH FAILED: definite URL problems require attention.",
  );
  process.exit(1);
}

console.log(
  "PRODUCTION URL HEALTH PASSED: no definite production URL faults found.",
);
