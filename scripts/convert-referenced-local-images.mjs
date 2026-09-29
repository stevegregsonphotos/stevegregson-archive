import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

const roots = [
  "app",
  "components",
  "lib",
  "content",
];

const textExtensions =
  new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".css",
    ".md",
    ".txt",
  ]);

const files = [];

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
      textExtensions.has(
        path.extname(
          entry.name,
        ).toLowerCase(),
      )
    ) {
      files.push(
        full,
      );
    }
  }
}

for (const root of roots) {
  walk(root);
}

const references =
  new Map();

const pattern =
  /\/images\/[^"'`)\s]+?\.(?:jpe?g)/gi;

for (const file of files) {
  const source =
    fs.readFileSync(
      file,
      "utf8",
    );

  for (
    const match of
    source.matchAll(
      pattern,
    )
  ) {
    const publicPath =
      match[0];

    if (
      !references.has(
        publicPath,
      )
    ) {
      references.set(
        publicPath,
        new Set(),
      );
    }

    references
      .get(publicPath)
      .add(file);
  }
}

console.log(
  `\n=== REFERENCED LOCAL JPEG PHOTOGRAPHS: ${references.size} ===\n`,
);

for (
  const [
    publicPath,
    sourceFiles,
  ] of references
) {
  const input =
    path.join(
      "public",
      publicPath,
    );

  if (
    !fs.existsSync(
      input,
    )
  ) {
    throw new Error(
      `Referenced local photograph does not exist: ${input}`,
    );
  }

  const outputPublic =
    publicPath.replace(
      /\.(?:jpe?g)$/i,
      ".webp",
    );

  const output =
    path.join(
      "public",
      outputPublic,
    );

  if (
    !fs.existsSync(
      output,
    )
  ) {
    await sharp(
      input,
      {
        failOn: "none",
      },
    )
      .rotate()
      .resize({
        width: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: 82,
        effort: 6,
        smartSubsample: true,
      })
      .toFile(
        output,
      );
  }

  const before =
    fs.statSync(
      input,
    ).size;

  const after =
    fs.statSync(
      output,
    ).size;

  console.log(
    `${publicPath}: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`,
  );

  for (
    const sourceFile of
    sourceFiles
  ) {
    const source =
      fs.readFileSync(
        sourceFile,
        "utf8",
      );

    const updated =
      source
        .split(
          publicPath,
        )
        .join(
          outputPublic,
        );

    fs.writeFileSync(
      sourceFile,
      updated,
    );
  }
}

const remaining = [];

for (const file of files) {
  const source =
    fs.readFileSync(
      file,
      "utf8",
    );

  const matches =
    source.match(
      pattern,
    );

  if (matches) {
    for (
      const match of matches
    ) {
      remaining.push(
        `${file}: ${match}`,
      );
    }
  }
}

console.log(
  `\nRemaining referenced local JPEG photographs: ${remaining.length}`,
);

if (
  remaining.length > 0
) {
  console.log(
    remaining.join(
      "\n",
    ),
  );

  process.exit(1);
}

console.log(
  "\nLOCAL PUBLIC IMAGE CONVERSION PASS.",
);
