import fs from "node:fs";
import path from "node:path";

const roots = [
  "app",
  "components",
  "lib",
  "content",
];

const extensions =
  new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".css",
  ]);

const violations = [];

function walk(root) {
  if (
    !fs.existsSync(root)
  ) {
    return;
  }

  for (
    const entry of
    fs.readdirSync(
      root,
      {
        withFileTypes: true,
      },
    )
  ) {
    const full =
      path.join(
        root,
        entry.name,
      );

    if (
      entry.isDirectory()
    ) {
      walk(full);
      continue;
    }

    if (
      !extensions.has(
        path.extname(
          entry.name,
        ).toLowerCase(),
      )
    ) {
      continue;
    }

    const source =
      fs.readFileSync(
        full,
        "utf8",
      );

    const matches =
      source.match(
        /\/images\/[^"'`)\s]+?\.(?:jpe?g)/gi,
      );

    if (matches) {
      for (
        const match of matches
      ) {
        violations.push(
          `${full}: ${match}`,
        );
      }
    }
  }
}

for (const root of roots) {
  walk(root);
}

const requiredChecks = [
  [
    "lib/selected-work-storage.ts",
    'contentType = "image/webp"',
  ],
  [
    "app/admin/selected-work/library/pipeline.ts",
    '"image/webp"',
  ],
  [
    "app/admin/new-production/ProductionUpload.tsx",
    '"image/webp"',
  ],
  [
    "app/admin/curated-archive-import/CuratedArchiveImportClient.tsx",
    '"image/webp"',
  ],
  [
    "app/archive/ArchiveExplorer.tsx",
    "getProductionCardImageUrl",
  ],
];

for (
  const [
    file,
    required,
  ] of requiredChecks
) {
  const source =
    fs.readFileSync(
      file,
      "utf8",
    );

  if (
    !source.includes(
      required,
    )
  ) {
    violations.push(
      `${file}: missing required image-policy marker ${required}`,
    );
  }
}

if (
  violations.length > 0
) {
  console.error(
    "\nPublic image policy FAILED:\n",
  );

  console.error(
    violations.join(
      "\n",
    ),
  );

  process.exit(1);
}

console.log(
  "Public image policy passed: public photographic paths are WebP-first.",
);
