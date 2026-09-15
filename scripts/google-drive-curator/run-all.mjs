import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

const STATUS_ONLY =
  process.argv.includes("--status");


const WORK_ROOT = path.join(
  os.homedir(),
  "Downloads",
  "Archive Download",
  "Automated Curation - Google Drive",
);

const LOG_PATH = path.join(
  WORK_ROOT,
  "bulk-curation-log.json",
);

const NORMALISED_GALLERIES_PATH = path.join(
  WORK_ROOT,
  "normalised-galleries.json",
);

const CURATOR_PATH = path.resolve(
  "scripts/google-drive-curator/curator.mjs",
);

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
      source: "google-drive",
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
    ) + "\n",
    "utf8",
  );
}

async function validateCompletedProduction(production) {
  let entries = [];
  try { entries = await fs.readdir(WORK_ROOT, { withFileTypes: true }); } catch { return { ok: false, reason: "work root unavailable" }; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folder = path.join(WORK_ROOT, entry.name);
    try {
      const final = JSON.parse(await fs.readFile(path.join(folder, "final-selection.json"), "utf8"));
      if (String(final.production ?? "").trim() !== production) continue;
      const images = Array.isArray(final.images) ? final.images : [];
      if (!images.length) return { ok: false, reason: "final selection has no images" };
      const missingAlt = images.filter((image) => typeof image?.alt !== "string" || !image.alt.trim());
      if (missingAlt.length) return { ok: false, reason: `${missingAlt.length} selected image(s) missing alt text` };
      const staging = path.join(folder, "selected-web-staging");
      const staged = (await fs.readdir(staging, { withFileTypes: true })).filter((item) => item.isFile() && !item.name.startsWith("."));
      if (staged.length !== images.length) return { ok: false, reason: `staging count ${staged.length} does not match ${images.length}` };
      for (const image of images) {
        if (typeof image.stagedFile !== "string" || !image.stagedFile) return { ok: false, reason: "selected image missing stagedFile" };
        const stat = await fs.stat(path.join(staging, image.stagedFile));
        if (!stat.size) return { ok: false, reason: `empty staged file ${image.stagedFile}` };
      }
      return { ok: true, completedAt: final.generatedAt ?? new Date().toISOString() };
    } catch {}
  }
  return { ok: false, reason: "valid final-selection.json not found" };
}

async function readExistingFinalSelections(validProductions) {
  const complete = new Map();
  const stale = [];

  let entries = [];

  try {
    entries =
      await fs.readdir(
        WORK_ROOT,
        {
          withFileTypes: true,
        },
      );
  } catch {
    return { complete, stale };
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const finalPath =
      path.join(
        WORK_ROOT,
        entry.name,
        "final-selection.json",
      );

    try {
      const data =
        JSON.parse(
          await fs.readFile(
            finalPath,
            "utf8",
          ),
        );

      const production =
        typeof data.production === "string"
          ? data.production.trim()
          : "";

      if (!production) {
        continue;
      }

      if (!validProductions.has(production)) {
        stale.push({
          folder: entry.name,
          production,
        });
        continue;
      }

      complete.set(
        production,
        data.generatedAt ??
          new Date().toISOString(),
      );
    } catch {
      // No completed final selection here.
    }
  }

  return { complete, stale };
}

function runProduction(
  production,
  position,
  total,
) {
  return new Promise((resolve) => {
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
    console.log();

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
        env: process.env,
        stdio: [
          "inherit",
          "pipe",
          "pipe",
        ],
      },
    );

    let combined = "";

    child.stdout.on(
      "data",
      (chunk) => {
        const text =
          chunk.toString();

        combined += text;
        process.stdout.write(text);
      },
    );

    child.stderr.on(
      "data",
      (chunk) => {
        const text =
          chunk.toString();

        combined += text;
        process.stderr.write(text);
      },
    );

    child.on(
      "close",
      (code) => {
        const lower =
          combined.toLowerCase();

        const budgetFailure =
          lower.includes(
            "no credits remaining",
          ) ||
          lower.includes(
            "spend limit",
          ) ||
          lower.includes(
            "insufficient_quota",
          ) ||
          lower.includes(
            "openai_phase_a_budget_stop",
          ) ||
          lower.includes(
            "budget stop",
          ) ||
          lower.includes(
            "invalid or missing phase a budget",
          );

        resolve({
          ok: code === 0,
          code,
          budgetFailure,
          error:
            code === 0
              ? null
              : `Curator exited with code ${code}`,
        });
      },
    );
  });
}

await fs.mkdir(
  WORK_ROOT,
  {
    recursive: true,
  },
);

const galleryManifest =
  JSON.parse(
    await fs.readFile(
      NORMALISED_GALLERIES_PATH,
      "utf8",
    ),
  );

const productions =
  (Array.isArray(
    galleryManifest.galleries,
  )
    ? galleryManifest.galleries
    : []
  )
    .map(
      (gallery) =>
        String(
          gallery.path ?? "",
        ).trim(),
    )
    .filter(Boolean)
    .sort(
      (a, b) =>
        a.localeCompare(
          b,
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          },
        ),
    );

const log =
  await readLog();

const validProductions = new Set(productions);

const {
  complete: existingFinals,
  stale: staleFinalSelections,
} = await readExistingFinalSelections(
  validProductions,
);

/*
 * Reconcile genuine completed output into the
 * runner log before starting.
 */
for (
  const [production, completedAt]
  of existingFinals
) {
  log.productions[production] = {
    status: "complete",
    completedAt,
  };
}

if (!STATUS_ONLY) {
  await writeLog(log);
}

const completed =
  new Set(
    productions.filter(
      (production) =>
        existingFinals.has(
          production,
        ),
    ),
  );

for (const production of productions) {
  if (
    log.productions[
      production
    ]?.status === "complete" &&
    !completed.has(production)
  ) {
    delete log.productions[
      production
    ];
  }
}

if (!STATUS_ONLY) {
  await writeLog(log);
}

console.log();
console.log(
  "GOOGLE DRIVE BULK CURATOR",
);
console.log(
  "Productions:",
  productions.length,
);
console.log(
  "Already complete:",
  productions.filter(
    (name) =>
      completed.has(name),
  ).length,
);
console.log(
  "Remaining:",
  productions.filter(
    (name) =>
      !completed.has(name),
  ).length,
);
console.log();
console.log(
  "Google Drive: READ ONLY",
);
console.log(
  "Dropbox curator: UNTOUCHED",
);
console.log(
  "Output:",
  WORK_ROOT,
);
console.log();
if (staleFinalSelections.length) {
  console.log(
    "STALE FINAL SELECTIONS IGNORED:",
    staleFinalSelections.length,
  );

  for (const item of staleFinalSelections) {
    console.log(
      `- ${item.production} [${item.folder}]`,
    );
  }

  console.log();
}

if (STATUS_ONLY) {
  let validComplete = 0;
  const invalidComplete = [];
  const notComplete = [];

  for (const production of productions) {
    if (!completed.has(production)) {
      notComplete.push(production);
      continue;
    }

    const validation =
      await validateCompletedProduction(
        production,
      );

    if (validation.ok) {
      validComplete += 1;
    } else {
      invalidComplete.push({
        production,
        reason: validation.reason,
      });
    }
  }

  console.log("STATUS ONLY - NO CURATION STARTED");
  console.log("Validated complete:", validComplete);
  console.log("Invalid completion:", invalidComplete.length);
  console.log("Not complete:", notComplete.length);

  if (invalidComplete.length) {
    console.log();
    console.log("INVALID COMPLETIONS:");
    for (const item of invalidComplete) {
      console.log(`- ${item.production} - ${item.reason}`);
    }
  }

  if (notComplete.length) {
    console.log();
    console.log("NOT COMPLETE:");
    for (const production of notComplete) {
      console.log(`- ${production}`);
    }
  }

  process.exit(0);
}

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
    const validation = await validateCompletedProduction(production);
    if (validation.ok) {
      console.log(`[${index + 1}/${productions.length}] SKIP validated complete: ${production}`);
      continue;
    }
    completed.delete(production);
    console.warn(`REOPENING INVALID COMPLETION: ${production} — ${validation.reason}`);
  }

  log.productions[production] = {
    status: "running",
    startedAt:
      new Date().toISOString(),
  };

  await writeLog(log);

  const result =
    await runProduction(
      production,
      index + 1,
      productions.length,
    );

  if (result.budgetFailure) {
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
      "OPENAI CREDIT / SPEND STOP.",
    );
    console.error(
      "Google Drive bulk curator stopped immediately.",
    );

    process.exit(2);
  }

  const completionValidation = result.ok
    ? await validateCompletedProduction(production)
    : { ok: false, reason: result.error };

  if (result.ok && completionValidation.ok) {
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
  "GOOGLE DRIVE BULK CURATION FINISHED",
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
