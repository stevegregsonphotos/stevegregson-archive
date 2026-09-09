import {
  prepareCuratedProduction,
} from "@/lib/curated-archive/prepare-production";
import {
  publishCuratedProduction,
} from "@/lib/curated-archive/publish-production";

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const CURATION_ROOT = path.join(
  os.homedir(),
  "Downloads",
  "Archive Download",
  "Automated Curation",
);

type ImportFailure = {
  folder: string;
  production: string;
  message: string;
};

async function main() {
  const entries =
    await fs.readdir(
      CURATION_ROOT,
      {
        withFileTypes: true,
      },
    );

  const folders =
    entries
      .filter(
        (entry) =>
          entry.isDirectory(),
      )
      .map(
        (entry) =>
          entry.name,
      )
      .sort((a, b) =>
        a.localeCompare(b),
      );

  const ready:
    Array<{
      folder: string;
      production: string;
    }> = [];

  let existing = 0;
  let excluded = 0;
  let attention = 0;
  let withoutFinalSelection = 0;

  console.log(
    "\n=== CURATED ARCHIVE BATCH PREFLIGHT ===\n",
  );

  for (const folder of folders) {
    const finalSelectionPath =
      path.join(
        CURATION_ROOT,
        folder,
        "final-selection.json",
      );

    try {
      await fs.access(
        finalSelectionPath,
      );
    } catch {
      withoutFinalSelection += 1;
      continue;
    }

    const prepared =
      await prepareCuratedProduction(
        folder,
      );

    if (!prepared) {
      attention += 1;
      console.log(
        `ATTENTION  ${folder} — could not prepare production`,
      );
      continue;
    }

    switch (prepared.status) {
      case "ready":
        ready.push({
          folder,
          production:
            prepared.payload?.title ??
            prepared.production,
        });
        break;

      case "existing":
        existing += 1;
        break;

      case "excluded":
        excluded += 1;
        break;

      case "attention":
        attention += 1;
        console.log(
          `ATTENTION  ${prepared.production} — ${prepared.issues.join(" ")}`,
        );
        break;
    }
  }

  console.log(
    `Ready:                 ${ready.length}`,
  );
  console.log(
    `Existing:              ${existing}`,
  );
  console.log(
    `Excluded:              ${excluded}`,
  );
  console.log(
    `Attention:             ${attention}`,
  );
  console.log(
    `Without final selection: ${withoutFinalSelection}`,
  );

  if (ready.length === 0) {
    console.log(
      "\nNothing is ready to import.",
    );
    return;
  }

  console.log(
    `\nImporting ${ready.length} Ready productions sequentially...\n`,
  );

  let imported = 0;
  const failures:
    ImportFailure[] = [];

  for (
    let index = 0;
    index < ready.length;
    index += 1
  ) {
    const item =
      ready[index];

    console.log(
      `[${index + 1}/${ready.length}] ${item.production}`,
    );

    try {
      const {
        prepared,
      } =
        await publishCuratedProduction(
          item.folder,
        );

      imported += 1;

      console.log(
        `  OK  ${prepared.payload?.slug ?? item.folder}`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      failures.push({
        folder: item.folder,
        production:
          item.production,
        message,
      });

      console.error(
        `  FAILED  ${message}`,
      );
    }
  }

  console.log(
    "\n=== CURATED ARCHIVE BATCH COMPLETE ===\n",
  );

  console.log(
    `Imported: ${imported}`,
  );

  console.log(
    `Failed:   ${failures.length}`,
  );

  if (failures.length > 0) {
    console.log(
      "\nFailures:",
    );

    for (const failure of failures) {
      console.log(
        `- ${failure.production}`,
      );
      console.log(
        `  Folder: ${failure.folder}`,
      );
      console.log(
        `  ${failure.message}`,
      );
    }

    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    "\nBatch importer stopped unexpectedly:",
    error,
  );

  process.exitCode = 1;
});
