import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const CATEGORIES = [
  "production",
  "rehearsal",
  "campaign",
];

const root = process.cwd();

const dataFile = path.join(
  root,
  "content",
  "selected-work.json",
);

const imageRoot = path.join(
  root,
  "public",
  "images",
  "selected-work",
);

async function main() {
  const source = await readFile(dataFile, "utf8");
  const data = JSON.parse(source);

  let updatedCount = 0;
  let unchangedCount = 0;
  let failedCount = 0;

  for (const category of CATEGORIES) {
    const images = Array.isArray(data[category])
      ? data[category]
      : [];

    for (const image of images) {
      if (
        Number.isInteger(image.width) &&
        image.width > 0 &&
        Number.isInteger(image.height) &&
        image.height > 0
      ) {
        unchangedCount += 1;
        continue;
      }

      const imagePath = path.join(
        imageRoot,
        category,
        image.filename,
      );

      try {
        const metadata = await sharp(
          imagePath,
        ).metadata();

        if (
          !metadata.width ||
          !metadata.height
        ) {
          throw new Error(
            "Image dimensions were not available.",
          );
        }

        image.width = metadata.width;
        image.height = metadata.height;

        updatedCount += 1;

        console.log(
          `Updated ${category}/${image.filename}: ${metadata.width}x${metadata.height}`,
        );
      } catch (error) {
        failedCount += 1;

        console.error(
          `Failed ${category}/${image.filename}:`,
          error instanceof Error
            ? error.message
            : error,
        );
      }
    }
  }

  await writeFile(
    dataFile,
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8",
  );

  console.log("");
  console.log("Migration complete.");
  console.log(`Updated: ${updatedCount}`);
  console.log(`Already complete: ${unchangedCount}`);
  console.log(`Failed: ${failedCount}`);

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    "Selected Work dimension migration failed:",
    error,
  );

  process.exitCode = 1;
});