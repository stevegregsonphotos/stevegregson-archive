import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

const EXCLUSION_PATH = path.resolve(
  "scripts/archive-curator/excluded-productions.txt",
);

function normaliseProductionName(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[—–−]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

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
        .map((value) =>
          normaliseProductionName(
            value.trim(),
          ),
        )
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

const SELECTS_ROOT = path.join(
  ARCHIVE_ROOT,
  "Archive Selects",
);

const WORK_ROOT = path.join(
  ARCHIVE_ROOT,
  "Automated Curation",
);

const RESEARCHER = path.resolve(
  "scripts/archive-curator/research-metadata.mjs",
);

const LOG_PATH = path.join(
  WORK_ROOT,
  "bulk-metadata-log.json",
);

async function readLog() {
  try {
    return JSON.parse(
      await fs.readFile(LOG_PATH, "utf8"),
    );
  } catch {
    return {
      version: 1,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      productions: {},
    };
  }
}

async function writeLog(log) {
  log.updatedAt =
    new Date().toISOString();

  await fs.writeFile(
    LOG_PATH,
    JSON.stringify(log, null, 2),
    "utf8",
  );
}

async function runResearch(
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
          RESEARCHER,
          `--production=${production}`,
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

      child.on("error", (error) => {
        resolve({
          ok: false,
          error: error.message,
          output,
        });
      });

      child.on("close", (code) => {
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
                  : `Researcher exited with code ${code}`,
        });
      });
    },
  );
}

await fs.mkdir(
  WORK_ROOT,
  { recursive: true },
);

const entries =
  await fs.readdir(
    SELECTS_ROOT,
    {
      withFileTypes: true,
    },
  );

const allProductions =
  entries
    .filter((entry) =>
      entry.isDirectory(),
    )
    .map((entry) =>
      entry.name,
    )
    .sort((a, b) =>
      a.localeCompare(b),
    );

const exclusions =
  await readExclusions();

const productions =
  allProductions.filter(
    (production) =>
      !exclusions.has(
        normaliseProductionName(
          production,
        ),
      ),
  );

const log =
  await readLog();

console.log();
console.log(
  "ARCHIVE METADATA RESEARCHER",
);
console.log(
  "Productions:",
  productions.length,
);
console.log(
  "Archive Selects: READ ONLY",
);
console.log(
  "Research output:",
  WORK_ROOT,
);

let completed = 0;
let failed = 0;

for (
  let index = 0;
  index < productions.length;
  index += 1
) {
  const production =
    productions[index];

  const previous =
    log.productions[
      production
    ];

  if (
    previous?.status ===
    "complete"
  ) {
    console.log();
    console.log(
      `[${index + 1}/${productions.length}] SKIP complete: ${production}`,
    );
    continue;
  }

  log.productions[
    production
  ] = {
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
      await runResearch(
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
    log.productions[
      production
    ] = {
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
      "Metadata bulk run stopped immediately.",
    );
    console.error(
      "No further productions will be attempted.",
    );

    process.exit(2);
  }

  if (result.ok) {
    completed += 1;

    log.productions[
      production
    ] = {
      status: "complete",
      completedAt:
        new Date().toISOString(),
    };

    console.log();
    console.log(
      `COMPLETE: ${production}`,
    );
  } else {
    failed += 1;

    log.productions[
      production
    ] = {
      status: "failed",
      failedAt:
        new Date().toISOString(),
      error: result.error,
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
  "BULK METADATA RESEARCH FINISHED",
);
console.log(
  "============================================================",
);
console.log(
  "Completed this run:",
  completed,
);
console.log(
  "Failed this run:",
  failed,
);
console.log(
  "Log:",
  LOG_PATH,
);
