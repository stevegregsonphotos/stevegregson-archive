import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

const EXCLUSION_PATH = path.resolve(
  "scripts/archive-curator/excluded-productions.txt",
);

async function readExclusions() {
  try {
    const text =
      await fs.readFile(
        EXCLUSION_PATH,
        "utf8",
      );

    return new Set(
      text
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

const ARCHIVE_ROOT = path.join(
  os.homedir(),
  "Downloads",
  "Archive Download",
);

const MANIFEST_PATH = path.join(
  ARCHIVE_ROOT,
  "steve_manifest.json",
);

const WORK_ROOT = path.join(
  ARCHIVE_ROOT,
  "Automated Curation",
);

const LOG_PATH = path.join(
  WORK_ROOT,
  "bulk-curation-log.json",
);

const CURATOR_PATH = path.resolve(
  "scripts/archive-curator/curator.mjs",
);

function firstString(item, keys) {
  for (const key of keys) {
    const value = item?.[key];

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return null;
}

function getManifestItems(manifest) {
  if (Array.isArray(manifest)) {
    return manifest;
  }

  for (const key of [
    "images",
    "items",
    "files",
    "selections",
    "manifest",
  ]) {
    if (Array.isArray(manifest?.[key])) {
      return manifest[key];
    }
  }

  throw new Error(
    "Could not identify manifest item list.",
  );
}

function getProductionName(item) {
  return firstString(
    item,
    [
      "production",
      "productionFolder",
      "production_folder",
      "archiveFolder",
      "archive_folder",
      "destinationFolder",
      "destination_folder",
      "show",
      "title",
    ],
  );
}

async function readLog() {
  try {
    return JSON.parse(
      await fs.readFile(
        LOG_PATH,
        "utf8",
      ),
    );
  } catch {
    return {
      version: 1,
      startedAt:
        new Date().toISOString(),
      updatedAt:
        new Date().toISOString(),
      productions: {},
    };
  }
}

async function writeLog(log) {
  log.updatedAt =
    new Date().toISOString();

  await fs.writeFile(
    LOG_PATH,
    JSON.stringify(
      log,
      null,
      2,
    ),
    "utf8",
  );
}

async function runProduction(
  production,
  position,
  total,
) {
  console.log();
  console.log(
    "============================================================",
  );
  console.log(
    `[${position}/${total}] ${production}`,
  );
  console.log(
    "============================================================",
  );

  return await new Promise(
    (resolve) => {
      const child = spawn(
        process.execPath,
        [
          CURATOR_PATH,
          `--production=${production}`,
          "--prepare",
          "--curate",
          "--stage",
        ],
        {
          cwd: process.cwd(),
          stdio: [
            "inherit",
            "pipe",
            "pipe",
          ],
        },
      );

      let output = "";

      child.stdout.on(
        "data",
        (chunk) => {
          const value =
            chunk.toString();

          output += value;
          process.stdout.write(value);
        },
      );

      child.stderr.on(
        "data",
        (chunk) => {
          const value =
            chunk.toString();

          output += value;
          process.stderr.write(value);
        },
      );

      child.on(
        "error",
        (error) => {
          resolve({
            ok: false,
            error:
              error.message,
            output,
          });
        },
      );

      child.on(
        "close",
        (code) => {
          const lower =
            output.toLowerCase();

          const spendLimit =
            lower.includes(
              "enforced spend limit",
            ) ||
            lower.includes(
              "spend limit",
            );

          const rateLimit =
            code !== 0 &&
            !spendLimit &&
            (
              lower.includes(
                "rate limit",
              ) ||
              lower.includes("429")
            );

          resolve({
            ok: code === 0,
            code,
            spendLimit,
            rateLimit,
            output,
            error:
              code === 0
                ? null
                : spendLimit
                  ? "OpenAI spend limit reached"
                  : rateLimit
                    ? "OpenAI temporary rate limit"
                    : `Curator exited with code ${code}`,
          });
        },
      );
    },
  );
}

await fs.mkdir(
  WORK_ROOT,
  { recursive: true },
);

const manifest =
  JSON.parse(
    await fs.readFile(
      MANIFEST_PATH,
      "utf8",
    ),
  );

const items =
  getManifestItems(manifest);

const allProductions = [
  ...new Set(
    items
      .map(getProductionName)
      .filter(Boolean),
  ),
];

const exclusions =
  await readExclusions();

const productions =
  allProductions.filter(
    (production) =>
      !exclusions.has(production),
  );

const log =
  await readLog();

const completed =
  new Set(
    Object.entries(
      log.productions,
    )
      .filter(
        ([, value]) =>
          value?.status ===
          "complete",
      )
      .map(
        ([name]) => name,
      ),
  );

console.log();
console.log(
  "ARCHIVE BULK CURATOR",
);
console.log(
  "Productions:",
  productions.length,
);
console.log(
  "Already complete:",
  completed.size,
);
console.log(
  "Remaining:",
  productions.length -
    completed.size,
);
console.log();
console.log(
  "Dropbox: READ ONLY",
);
console.log(
  "Archive Selects: UNTOUCHED",
);
console.log(
  "Output:",
  WORK_ROOT,
);

let successes = 0;
let failures = 0;

for (
  let index = 0;
  index < productions.length;
  index += 1
) {
  const production =
    productions[index];

  if (completed.has(production)) {
    console.log();
    console.log(
      `[${index + 1}/${productions.length}] SKIP complete: ${production}`,
    );
    continue;
  }

  log.productions[production] = {
    status: "running",
    startedAt:
      new Date().toISOString(),
  };

  await writeLog(log);

  let result;
  let rateLimitRetries = 0;
  const maxRateLimitRetries = 5;

  while (true) {
    result =
      await runProduction(
        production,
        index + 1,
        productions.length,
      );

    if (
      result.rateLimit &&
      rateLimitRetries <
        maxRateLimitRetries
    ) {
      rateLimitRetries += 1;

      const waitMs =
        Math.min(
          30000,
          2000 *
            2 **
              (rateLimitRetries - 1),
        );

      console.log();
      console.log(
        `RATE LIMIT: waiting ${waitMs / 1000}s before retry ${rateLimitRetries}/${maxRateLimitRetries}.`,
      );

      await new Promise(
        (resolve) =>
          setTimeout(resolve, waitMs),
      );

      continue;
    }

    break;
  }

  if (result.spendLimit) {
    log.productions[production] = {
      status: "paused_budget",
      pausedAt:
        new Date().toISOString(),
      error:
        result.error,
    };

    await writeLog(log);

    console.error();
    console.error(
      "OPENAI SPEND LIMIT REACHED.",
    );
    console.error(
      "Photo bulk run stopped immediately.",
    );
    console.error(
      "No further productions will be attempted.",
    );

    process.exit(2);
  }

  if (result.ok) {
    successes += 1;

    log.productions[production] = {
      status: "complete",
      completedAt:
        new Date().toISOString(),
    };

    console.log();
    console.log(
      `COMPLETE: ${production}`,
    );
  } else {
    failures += 1;

    log.productions[production] = {
      status: "failed",
      failedAt:
        new Date().toISOString(),
      error:
        result.error,
    };

    console.error();
    console.error(
      `FAILED: ${production}`,
    );
    console.error(
      result.error,
    );
    console.error(
      "Continuing to next production.",
    );
  }

  await writeLog(log);
}

console.log();
console.log(
  "============================================================",
);
console.log(
  "BULK CURATION RUN FINISHED",
);
console.log(
  "============================================================",
);
console.log(
  "Completed this run:",
  successes,
);
console.log(
  "Failed this run:",
  failures,
);
console.log(
  "Log:",
  LOG_PATH,
);
