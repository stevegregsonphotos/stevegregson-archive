import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import readline from "node:readline/promises";
import process from "node:process";
import sharp from "sharp";

const PROJECT_ROOT = process.cwd();
const ENV_PATH = path.join(PROJECT_ROOT, ".env.local");
const DEFAULT_OUTPUT_ROOT = path.join(
  os.homedir(),
  "Downloads",
  "Archive Download",
  "Curated Imports",
);

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

const PER_SHEET = 32;
const CONTACT_COLUMNS = 4;
const CONTACT_ROWS = 8;
const CELL_W = 400;
const CELL_H = 330;
const IMAGE_W = 380;
const IMAGE_H = 285;

const MODEL =
  process.env.OPENAI_ARCHIVE_CURATOR_MODEL ||
  "gpt-5.5";

const RESEARCH_MODEL =
  process.env.OPENAI_ARCHIVE_RESEARCH_MODEL ||
  "gpt-5.5";

const PRICE = {
  model: "gpt-5.5",
  inputPerMillion: 5,
  cachedInputPerMillion: 0.5,
  outputPerMillion: 30,
};

const cli = process.argv.slice(2);

const GENERATED_DIR_NAMES = new Set([
  "thumbnails",
  "contact-sheets",
  "pass-1",
  "pass-2-contact-sheets",
  "selected-web-staging",
  ".editor-thumbnails",
]);

const MIN_FREE_BYTES = 20 * 1024 * 1024 * 1024;

function sourceLooksCloudBacked(value) {
  const normalised = path.resolve(value).replace(/\\/g, "/");
  return (
    normalised.includes("/Library/CloudStorage/Dropbox/") ||
    normalised.includes("/Library/CloudStorage/GoogleDrive-") ||
    normalised.includes("/Library/CloudStorage/OneDrive-") ||
    normalised.includes("/Library/CloudStorage/Box-Box/")
  );
}

function pathIsInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

async function assertDiskSafety(outputRoot, candidates) {
  const stats = await fs.statfs(outputRoot);
  const freeBytes = Number(stats.bavail) * Number(stats.bsize);
  const sourceBytes = candidates.reduce(
    (sum, candidate) => sum + Number(candidate.size || 0),
    0,
  );

  // The curator normally writes small JPEG thumbnails/contact sheets plus
  // only the final selected originals. Keep a hard 20 GiB safety reserve
  // and also require room for a conservative fraction of the source set.
  const estimatedWorkingBytes = Math.max(
    2 * 1024 * 1024 * 1024,
    Math.min(
      10 * 1024 * 1024 * 1024,
      Math.ceil(sourceBytes * 0.35),
    ),
  );

  const requiredBytes = MIN_FREE_BYTES + estimatedWorkingBytes;

  if (freeBytes < requiredBytes) {
    throw new Error(
      `DISK SAFETY STOP: only ${(freeBytes / 1024 ** 3).toFixed(1)} GiB free. ` +
      `This run requires at least ${(requiredBytes / 1024 ** 3).toFixed(1)} GiB free, including a 20 GiB safety reserve. No images were processed.`,
    );
  }
}

function argValue(name) {
  const prefix = `--${name}=`;
  const item = cli.find((value) =>
    value.startsWith(prefix),
  );
  return item
    ? item.slice(prefix.length).trim()
    : "";
}

function hasFlag(name) {
  return cli.includes(`--${name}`);
}

function safeName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[—–−]/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function cleanDisplayName(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readEnvValue(text, key) {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (
      !line ||
      line.startsWith("#") ||
      !line.startsWith(`${key}=`)
    ) {
      continue;
    }
    return line
      .slice(key.length + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return "";
}

async function loadEnvText() {
  try {
    return await fs.readFile(ENV_PATH, "utf8");
  } catch {
    return "";
  }
}

async function chooseFolderWithFinder() {
  if (process.platform !== "darwin") {
    return "";
  }

  return await new Promise((resolve, reject) => {
    const child = spawn(
      "osascript",
      [
        "-e",
        'POSIX path of (choose folder with prompt "Choose the production image folder")',
      ],
      {
        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
      },
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim().replace(/\/+$/, ""));
        return;
      }

      if (
        stderr.includes("-128") ||
        stderr.toLowerCase().includes("user canceled")
      ) {
        resolve("");
        return;
      }

      reject(
        new Error(
          `Folder picker failed: ${stderr.trim()}`,
        ),
      );
    });
  });
}

async function ask(rl, question, fallback = "") {
  const suffix = fallback
    ? ` [${fallback}]`
    : "";
  const answer =
    (await rl.question(`${question}${suffix}: `))
      .trim();
  return answer || fallback;
}

async function yesNo(
  rl,
  question,
  fallback = false,
) {
  const marker = fallback
    ? "Y/n"
    : "y/N";
  const answer =
    (await rl.question(
      `${question} [${marker}]: `,
    ))
      .trim()
      .toLowerCase();

  if (!answer) {
    return fallback;
  }

  return ["y", "yes"].includes(answer);
}

async function listImages(root) {
  const entries = [];

  async function walk(folder) {
    const items =
      await fs.readdir(
        folder,
        {
          withFileTypes: true,
        },
      );

    for (const item of items) {
      if (item.name.startsWith(".")) {
        continue;
      }

      const fullPath =
        path.join(folder, item.name);

      if (item.isDirectory()) {
        if (
          GENERATED_DIR_NAMES.has(item.name) ||
          item.name.startsWith("pass-")
        ) {
          continue;
        }

        await walk(fullPath);
        continue;
      }

      if (!item.isFile()) {
        continue;
      }

      const extension =
        path.extname(item.name).toLowerCase();

      if (!IMAGE_EXTENSIONS.has(extension)) {
        continue;
      }

      const stats =
        await fs.stat(fullPath);

      if (!stats.size) {
        continue;
      }

      entries.push({
        name: item.name,
        absolutePath: fullPath,
        relativePath:
          path.relative(root, fullPath)
            .split(path.sep)
            .join("/"),
        modified:
          stats.mtime.toISOString(),
        size: stats.size,
      });
    }
  }

  await walk(root);

  entries.sort((a, b) =>
    a.relativePath.localeCompare(
      b.relativePath,
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    ),
  );

  return entries;
}

async function writeJson(filePath, value) {
  await fs.mkdir(
    path.dirname(filePath),
    { recursive: true },
  );

  const temp =
    `${filePath}.tmp`;

  await fs.writeFile(
    temp,
    JSON.stringify(
      value,
      null,
      2,
    ) + "\n",
    "utf8",
  );

  await fs.rename(
    temp,
    filePath,
  );
}

async function readJson(filePath) {
  return JSON.parse(
    await fs.readFile(
      filePath,
      "utf8",
    ),
  );
}

function imageIdentity(candidate) {
  return [
    candidate.relativePath,
    candidate.modified,
    candidate.size,
  ].join("|");
}

async function prepareThumbnails(
  candidates,
  outputDir,
) {
  const thumbnailDir =
    path.join(
      outputDir,
      "thumbnails",
    );

  await fs.mkdir(
    thumbnailDir,
    { recursive: true },
  );

  const cataloguePath =
    path.join(
      outputDir,
      "thumbnail-catalogue.json",
    );

  let previous = [];

  try {
    previous =
      await readJson(cataloguePath);

    if (!Array.isArray(previous)) {
      previous = [];
    }
  } catch {}

  const catalogue =
    new Array(candidates.length);

  let next = 0;
  let completed = 0;
  let cacheChanged = false;

  console.log();
  console.log(
    `PREPARING ${candidates.length} THUMBNAILS`,
  );

  async function worker() {
    while (true) {
      const index = next;
      next += 1;

      if (index >= candidates.length) {
        return;
      }

      const candidate =
        candidates[index];

      const filename =
        `${String(index + 1).padStart(4, "0")}.jpg`;

      const destination =
        path.join(
          thumbnailDir,
          filename,
        );

      const identity =
        imageIdentity(candidate);

      const prior =
        previous[index];

      let usableCache = false;

      try {
        const stats =
          await fs.stat(destination);

        usableCache =
          stats.size > 0 &&
          prior?.identity === identity;
      } catch {}

      if (!usableCache) {
        if (prior) {
          cacheChanged = true;
        }

        await sharp(
          candidate.absolutePath,
          {
            failOn: "none",
          },
        )
          .rotate()
          .resize({
            width: 640,
            height: 480,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({
            quality: 82,
          })
          .toFile(destination);
      }

      catalogue[index] = {
        index: index + 1,
        thumbnail: filename,
        sourceName: candidate.name,
        sourcePath:
          candidate.relativePath,
        modified:
          candidate.modified,
        size:
          candidate.size,
        identity,
      };

      completed += 1;

      if (
        completed % 25 === 0 ||
        completed === candidates.length
      ) {
        console.log(
          `${completed}/${candidates.length}`,
        );
      }
    }
  }

  const workers =
    Math.min(
      8,
      Math.max(
        1,
        candidates.length,
      ),
    );

  await Promise.all(
    Array.from(
      { length: workers },
      () => worker(),
    ),
  );

  await writeJson(
    cataloguePath,
    catalogue,
  );

  if (cacheChanged) {
    for (const name of [
      "contact-sheets",
      "contact-sheets.json",
      "pass-1",
      "pass-1.json",
      "pass-2-contact-sheets",
      "pass-2-contact-sheets.json",
      "pass-2.json",
      "final-selection.json",
      "selected-web-staging",
    ]) {
      await fs.rm(
        path.join(outputDir, name),
        {
          recursive: true,
          force: true,
        },
      );
    }

    console.log(
      "Source folder changed: downstream visual caches were invalidated.",
    );
  }

  return thumbnailDir;
}

function contactSheetSvgLabel(index) {
  const label =
    `#${String(index).padStart(4, "0")}`;

  return Buffer.from(
    `<svg width="${CELL_W}" height="35" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <text x="50%" y="24" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="black">${label}</text>
    </svg>`,
  );
}

async function buildContactSheet(
  thumbnailDir,
  indices,
  destination,
) {
  const canvas =
    sharp({
      create: {
        width:
          CONTACT_COLUMNS *
          CELL_W,
        height:
          CONTACT_ROWS *
          CELL_H,
        channels: 3,
        background: "white",
      },
    });

  const composites = [];

  for (
    let position = 0;
    position < indices.length;
    position += 1
  ) {
    const imageIndex =
      indices[position];

    const row =
      Math.floor(
        position /
          CONTACT_COLUMNS,
      );

    const column =
      position %
      CONTACT_COLUMNS;

    const input =
      path.join(
        thumbnailDir,
        `${String(imageIndex).padStart(4, "0")}.jpg`,
      );

    const image =
      await sharp(input)
        .resize({
          width: IMAGE_W,
          height: IMAGE_H,
          fit: "inside",
          background: "white",
        })
        .flatten({
          background: "white",
        })
        .jpeg({
          quality: 88,
        })
        .toBuffer();

    const metadata =
      await sharp(image)
        .metadata();

    const width =
      metadata.width ??
      IMAGE_W;

    const height =
      metadata.height ??
      IMAGE_H;

    const x =
      column * CELL_W +
      Math.floor(
        (CELL_W - width) / 2,
      );

    const y =
      row * CELL_H +
      10 +
      Math.floor(
        (IMAGE_H - height) / 2,
      );

    composites.push({
      input: image,
      left: x,
      top: y,
    });

    composites.push({
      input:
        contactSheetSvgLabel(
          imageIndex,
        ),
      left:
        column *
        CELL_W,
      top:
        row *
          CELL_H +
        IMAGE_H +
        10,
    });
  }

  await canvas
    .composite(composites)
    .jpeg({
      quality: 88,
    })
    .toFile(destination);
}

async function generateContactSheets(
  thumbnailDir,
  indices,
  outputDir,
  directoryName,
  catalogueName,
) {
  const directory =
    path.join(
      outputDir,
      directoryName,
    );

  await fs.mkdir(
    directory,
    { recursive: true },
  );

  const sheets = [];

  for (
    let start = 0;
    start < indices.length;
    start += PER_SHEET
  ) {
    const subset =
      indices.slice(
        start,
        start + PER_SHEET,
      );

    const sheetNumber =
      sheets.length + 1;

    const filename =
      `sheet-${String(sheetNumber).padStart(2, "0")}.jpg`;

    const destination =
      path.join(
        directory,
        filename,
      );

    await buildContactSheet(
      thumbnailDir,
      subset,
      destination,
    );

    sheets.push({
      sheet: sheetNumber,
      filename,
      first: subset[0],
      last:
        subset[
          subset.length - 1
        ],
      indices: subset,
    });

    console.log(
      `Contact sheet ${sheetNumber}: ${subset.length} photographs`,
    );
  }

  await writeJson(
    path.join(
      outputDir,
      catalogueName,
    ),
    sheets,
  );

  return {
    directory,
    sheets,
  };
}

function imageToDataUrl(buffer) {
  return (
    "data:image/jpeg;base64," +
    buffer.toString("base64")
  );
}

function extractJson(text) {
  const trimmed =
    String(text ?? "").trim();

  try {
    return JSON.parse(trimmed);
  } catch {}

  const first =
    trimmed.indexOf("{");
  const last =
    trimmed.lastIndexOf("}");

  if (
    first === -1 ||
    last === -1 ||
    last <= first
  ) {
    throw new Error(
      "Model response did not contain JSON.",
    );
  }

  return JSON.parse(
    trimmed.slice(
      first,
      last + 1,
    ),
  );
}

function normaliseIndices(
  values,
  allowed,
) {
  if (!Array.isArray(values)) {
    return [];
  }

  const allowedSet =
    new Set(allowed);

  return [
    ...new Set(
      values
        .map(Number)
        .filter(
          (value) =>
            Number.isInteger(value) &&
            allowedSet.has(value),
        ),
    ),
  ];
}

function usageCost(usage) {
  const input =
    Number(
      usage?.input_tokens ??
      0,
    );

  const cached =
    Number(
      usage
        ?.input_tokens_details
        ?.cached_tokens ??
      0,
    );

  const output =
    Number(
      usage?.output_tokens ??
      0,
    );

  return (
    (
      Math.max(
        0,
        input - cached,
      ) /
      1_000_000
    ) *
      PRICE.inputPerMillion +
    (
      cached /
      1_000_000
    ) *
      PRICE.cachedInputPerMillion +
    (
      output /
      1_000_000
    ) *
      PRICE.outputPerMillion
  );
}

async function loadLedger(
  outputDir,
  budgetUsd,
) {
  const file =
    path.join(
      outputDir,
      "paid-run-ledger.json",
    );

  try {
    const current =
      await readJson(file);

    return {
      file,
      ledger: {
        ...current,
        budgetUsd,
      },
    };
  } catch {
    return {
      file,
      ledger: {
        version: 1,
        budgetUsd,
        actualSpendUsd: 0,
        calls: [],
      },
    };
  }
}

async function paidResponse(
  client,
  params,
  paidState,
) {
  if (
    params.model !==
    PRICE.model
  ) {
    throw new Error(
      `Paid-run guard only authorises model ${PRICE.model}; requested ${params.model}.`,
    );
  }

  if (
    !client.responses
      ?.inputTokens?.count
  ) {
    throw new Error(
      "OpenAI SDK does not expose input token preflight counting; refusing an unguarded paid request.",
    );
  }

  const counted =
    await client.responses
      .inputTokens
      .count({
        model:
          params.model,
        input:
          params.input,
        ...(params.instructions
          ? {
              instructions:
                params.instructions,
            }
          : {}),
      });

  const inputTokens =
    Number(
      counted?.input_tokens ??
      0,
    );

  if (
    !Number.isFinite(
      inputTokens,
    ) ||
    inputTokens <= 0
  ) {
    throw new Error(
      "Paid-run preflight returned an invalid input-token count.",
    );
  }

  const maxOutputTokens =
    Math.min(
      Number(
        params
          .max_output_tokens ??
        8000,
      ),
      8000,
    );

  const conservative =
    (
      inputTokens /
      1_000_000
    ) *
      PRICE.inputPerMillion +
    (
      maxOutputTokens /
      1_000_000
    ) *
      PRICE.outputPerMillion;

  const spent =
    Number(
      paidState
        .ledger
        .actualSpendUsd ??
      0,
    );

  if (
    spent + conservative >
    paidState.ledger.budgetUsd
  ) {
    throw new Error(
      `PAID RUN STOPPED: next request could exceed the approved £/\$ budget ceiling. Recorded \$${spent.toFixed(4)}; conservative next-call max \$${conservative.toFixed(4)}; ceiling \$${paidState.ledger.budgetUsd.toFixed(2)}.`,
    );
  }

  const response =
    await client.responses.create({
      ...params,
      max_output_tokens:
        maxOutputTokens,
    });

  if (!response?.usage) {
    throw new Error(
      "Paid response returned no usage data.",
    );
  }

  const cost =
    usageCost(
      response.usage,
    );

  const cumulative =
    spent + cost;

  paidState
    .ledger
    .actualSpendUsd =
    cumulative;

  paidState
    .ledger
    .updatedAt =
    new Date()
      .toISOString();

  paidState
    .ledger
    .calls.push({
      at:
        new Date()
          .toISOString(),
      model:
        params.model,
      inputTokens:
        response
          .usage
          .input_tokens ??
        0,
      cachedInputTokens:
        response
          .usage
          ?.input_tokens_details
          ?.cached_tokens ??
        0,
      outputTokens:
        response
          .usage
          .output_tokens ??
        0,
      actualCostUsd:
        cost,
      cumulativeSpendUsd:
        cumulative,
    });

  await writeJson(
    paidState.file,
    paidState.ledger,
  );

  console.log(
    `API spend: \$${cost.toFixed(4)} this call | \$${cumulative.toFixed(4)} / \$${paidState.ledger.budgetUsd.toFixed(2)} approved ceiling`,
  );

  return response;
}

async function runPassOne(
  client,
  production,
  contactSheets,
  outputDir,
  paidState,
) {
  const directory =
    path.join(
      outputDir,
      "pass-1",
    );

  await fs.mkdir(
    directory,
    { recursive: true },
  );

  const results = [];

  console.log();
  console.log(
    "PASS 1 — VISUAL SHORTLIST",
  );

  for (
    const sheet
    of contactSheets.sheets
  ) {
    const cachedPath =
      path.join(
        directory,
        `sheet-${String(sheet.sheet).padStart(2, "0")}.json`,
      );

    try {
      const cached =
        await readJson(cachedPath);

      if (
        Array.isArray(
          cached.shortlist,
        )
      ) {
        results.push(cached);

        console.log(
          `Sheet ${sheet.sheet}/${contactSheets.sheets.length}: cached`,
        );

        continue;
      }
    } catch {}

    const buffer =
      await fs.readFile(
        path.join(
          contactSheets.directory,
          sheet.filename,
        ),
      );

    const prompt = `
You are making a FIRST-PASS visual edit for Steve Gregson's professional theatre-photography archive.

Production:
${production}

This sheet contains photographs #${String(sheet.first).padStart(4, "0")} through #${String(sheet.last).padStart(4, "0")}.

Retain every photograph worthy of serious consideration in the final production gallery. This is not the final cut.

Judge photographs on:
- visual impact
- composition
- timing
- theatrical light
- atmosphere
- expression and human connection
- control of scale and space
- photographic intention
- ability to stand alone
- ability to advertise Steve's skill to a prospective theatre client

Also preserve genuinely different strong photographs: wides, mediums, close frames, ensembles, individuals, movement, stillness, lighting states, colour, architecture, atmosphere and human moments.

Do not retain mediocre work merely for variety.
Do not over-prune excellent near-duplicates at this stage.

Return JSON only:
{
  "shortlist": [],
  "strongest": [],
  "heroCandidates": [],
  "notes": ""
}

Every number must be visible on this sheet.
`.trim();

    console.log(
      `Sheet ${sheet.sheet}/${contactSheets.sheets.length}: reviewing...`,
    );

    const response =
      await paidResponse(
        client,
        {
          model: MODEL,
          input: [
            {
              role: "user",
              content: [
                {
                  type:
                    "input_text",
                  text:
                    prompt,
                },
                {
                  type:
                    "input_image",
                  detail:
                    "high",
                  image_url:
                    imageToDataUrl(
                      buffer,
                    ),
                },
              ],
            },
          ],
        },
        paidState,
      );

    const parsed =
      extractJson(
        response.output_text,
      );

    const result = {
      sheet:
        sheet.sheet,
      first:
        sheet.first,
      last:
        sheet.last,
      shortlist:
        normaliseIndices(
          parsed.shortlist,
          sheet.indices,
        ),
      strongest:
        normaliseIndices(
          parsed.strongest,
          sheet.indices,
        ),
      heroCandidates:
        normaliseIndices(
          parsed
            .heroCandidates,
          sheet.indices,
        ),
      notes:
        typeof parsed.notes ===
          "string"
          ? parsed.notes.trim()
          : "",
      model:
        MODEL,
    };

    await writeJson(
      cachedPath,
      result,
    );

    results.push(result);
  }

  const shortlist =
    [
      ...new Set(
        results.flatMap(
          (item) =>
            item.shortlist,
        ),
      ),
    ].sort((a, b) => a - b);

  const strongest =
    [
      ...new Set(
        results.flatMap(
          (item) =>
            item.strongest,
        ),
      ),
    ].sort((a, b) => a - b);

  const heroCandidates =
    [
      ...new Set(
        results.flatMap(
          (item) =>
            item
              .heroCandidates,
        ),
      ),
    ].sort((a, b) => a - b);

  const summary = {
    version: 1,
    production,
    candidateCount:
      contactSheets
        .sheets
        .reduce(
          (sum, sheet) =>
            sum +
            sheet.indices.length,
          0,
        ),
    shortlist,
    strongest,
    heroCandidates,
    results,
  };

  await writeJson(
    path.join(
      outputDir,
      "pass-1.json",
    ),
    summary,
  );

  return summary;
}

async function runPassTwo(
  client,
  production,
  passOne,
  thumbnailDir,
  outputDir,
  paidState,
) {
  const outputPath =
    path.join(
      outputDir,
      "pass-2.json",
    );

  try {
    const cached =
      await readJson(outputPath);

    if (
      cached.version === 2 &&
      Array.isArray(
        cached.sequence,
      ) &&
      cached.sequence.length > 0 &&
      cached.altText &&
      cached.sequence.every(
        (index) =>
          typeof cached
            .altText[
              String(index)
            ] === "string" &&
          cached
            .altText[
              String(index)
            ]
            .trim(),
      )
    ) {
      console.log();
      console.log(
        `PASS 2 — using cached final edit (${cached.sequence.length} images)`,
      );
      return cached;
    }
  } catch {}

  const finalists =
    [
      ...new Set([
        ...passOne.shortlist,
        ...passOne.strongest,
        ...passOne.heroCandidates,
      ]),
    ].sort((a, b) => a - b);

  if (!finalists.length) {
    throw new Error(
      "Pass 1 produced no finalists.",
    );
  }

  const contactSheets =
    await generateContactSheets(
      thumbnailDir,
      finalists,
      outputDir,
      "pass-2-contact-sheets",
      "pass-2-contact-sheets.json",
    );

  const content = [
    {
      type: "input_text",
      text: `
You are making the FINAL whole-production edit for Steve Gregson's professional theatre-photography archive.

Production:
${production}

Select only photographs that deserve to be on a professional archive website.

Priorities:
1. photographic excellence;
2. a meaningful visual record of the production;
3. breadth without repetition.

Normal production galleries are commonly 20-40 images when the source supports that quality. Smaller shoots may deserve fewer; exceptional shoots may deserve more. Never fill a quota with weaker images.

Be ruthless about true repetition, but preserve meaningfully different scale, composition, expression, gesture, lighting, atmosphere and perspective.

Choose the HERO as the single strongest advertisement for Steve Gregson as a photographer, not merely the photograph that most literally explains the production.

Sequence the final edit as a photographic portfolio, creating rhythm through changes in scale, intimacy, colour, intensity, people and space.

Write one concise, factual alt-text sentence for every selected image. Describe only what is visibly present. Do not invent performer identities or character names.

Return JSON only:
{
  "classification": "small|normal|large|exceptional",
  "hero": 0,
  "selected": [],
  "sequence": [],
  "heroReason": "",
  "editorialSummary": "",
  "altText": {
    "123": "..."
  }
}

Rules:
- selected and sequence may only contain numbers shown in the supplied finalist sheets.
- hero must be selected.
- sequence must contain each selected image exactly once.
- altText must contain one non-empty sentence for every selected image.
`.trim(),
    },
  ];

  for (
    const sheet
    of contactSheets.sheets
  ) {
    const buffer =
      await fs.readFile(
        path.join(
          contactSheets.directory,
          sheet.filename,
        ),
      );

    content.push({
      type:
        "input_text",
      text:
        `Finalist sheet ${sheet.sheet}: ` +
        sheet.indices
          .map(
            (index) =>
              `#${String(index).padStart(4, "0")}`,
          )
          .join(", "),
    });

    content.push({
      type:
        "input_image",
      detail:
        "high",
      image_url:
        imageToDataUrl(
          buffer,
        ),
    });
  }

  console.log();
  console.log(
    `PASS 2 — FINAL EDIT (${finalists.length} finalists)`,
  );

  const response =
    await paidResponse(
      client,
      {
        model:
          MODEL,
        input: [
          {
            role:
              "user",
            content,
          },
        ],
      },
      paidState,
    );

  const parsed =
    extractJson(
      response.output_text,
    );

  const finalistSet =
    new Set(finalists);

  const selected =
    normaliseIndices(
      parsed.selected,
      finalists,
    );

  const sequence =
    normaliseIndices(
      parsed.sequence,
      selected,
    );

  if (
    !selected.length ||
    sequence.length !==
      selected.length
  ) {
    throw new Error(
      "Final edit returned an invalid selected/sequence set.",
    );
  }

  const hero =
    Number(parsed.hero);

  if (
    !finalistSet.has(hero) ||
    !selected.includes(hero)
  ) {
    throw new Error(
      "Final edit returned an invalid hero.",
    );
  }

  const altText = {};

  for (const index of selected) {
    const value =
      parsed
        .altText?.[
          String(index)
        ];

    if (
      typeof value !==
        "string" ||
      !value.trim()
    ) {
      throw new Error(
        `Final edit omitted alt text for image #${index}.`,
      );
    }

    altText[
      String(index)
    ] =
      value.trim();
  }

  const result = {
    version: 2,
    production,
    classification:
      String(
        parsed.classification ??
        "normal",
      ),
    hero,
    selected,
    sequence,
    heroReason:
      String(
        parsed.heroReason ??
        "",
      ).trim(),
    editorialSummary:
      String(
        parsed.editorialSummary ??
        "",
      ).trim(),
    altText,
    model:
      MODEL,
  };

  await writeJson(
    outputPath,
    result,
  );

  return result;
}

async function stageFinalSelection(
  sourceFolder,
  candidates,
  finalEdit,
  outputDir,
  production,
) {
  const stagingDir =
    path.join(
      outputDir,
      "selected-web-staging",
    );

  await fs.rm(
    stagingDir,
    {
      recursive: true,
      force: true,
    },
  );

  await fs.mkdir(
    stagingDir,
    { recursive: true },
  );

  const byIndex =
    new Map(
      candidates.map(
        (candidate, index) => [
          index + 1,
          candidate,
        ],
      ),
    );

  const selected = [];

  for (
    let position = 0;
    position <
      finalEdit.sequence.length;
    position += 1
  ) {
    const imageIndex =
      finalEdit
        .sequence[
          position
        ];

    const candidate =
      byIndex.get(
        imageIndex,
      );

    if (!candidate) {
      throw new Error(
        `Selected image #${imageIndex} is missing.`,
      );
    }

    const extension =
      path
        .extname(
          candidate.name,
        )
        .toLowerCase() ||
      ".jpg";

    const destinationName =
      `${String(position + 1).padStart(3, "0")}__${String(imageIndex).padStart(4, "0")}__${safeName(
        path.basename(
          candidate.name,
          extension,
        ),
      )}${extension}`;

    await fs.copyFile(
      candidate
        .absolutePath,
      path.join(
        stagingDir,
        destinationName,
      ),
    );

    selected.push({
      sequence:
        position + 1,
      index:
        imageIndex,
      hero:
        imageIndex ===
        finalEdit.hero,
      sourceName:
        candidate.name,
      sourcePath:
        "/" + candidate.relativePath.replace(/^\/+/, ""),
      sourceFolder:
        cleanDisplayName(path.basename(sourceFolder)),
      modified:
        candidate.modified,
      stagedFile:
        destinationName,
      alt:
        finalEdit.altText[
          String(
            imageIndex,
          )
        ],
      cached:
        false,
    });
  }

  const manifest = {
    version: 1,
    source:
      "local-folder",
    production,
    generatedAt:
      new Date()
        .toISOString(),
    classification:
      finalEdit.classification,
    hero:
      finalEdit.hero,
    selectedCount:
      selected.length,
    heroReason:
      finalEdit.heroReason,
    editorialSummary:
      finalEdit
        .editorialSummary,
    images:
      selected,
  };

  const manifestPath =
    path.join(
      outputDir,
      "final-selection.json",
    );

  await writeJson(
    manifestPath,
    manifest,
  );

  return {
    stagingDir,
    manifestPath,
    manifest,
  };
}

function monthNames() {
  return [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
}

async function findSourceText(
  sourceFolder,
) {
  const entries =
    await fs.readdir(
      sourceFolder,
      {
        withFileTypes: true,
      },
    );

  const txt =
    entries.find(
      (entry) =>
        entry.isFile() &&
        entry.name
          .toLowerCase()
          .endsWith(".txt"),
    );

  if (!txt) {
    return {
      path: null,
      text: "",
    };
  }

  const fullPath =
    path.join(
      sourceFolder,
      txt.name,
    );

  return {
    path: fullPath,
    text:
      await fs.readFile(
        fullPath,
        "utf8",
      ),
  };
}

async function runMetadataResearch(
  client,
  production,
  sourceFolder,
  outputDir,
  paidState,
) {
  const outputPath =
    path.join(
      outputDir,
      "metadata-research.json",
    );

  const proposedPath =
    path.join(
      outputDir,
      "metadata-proposed.txt",
    );

  try {
    const cached =
      await readJson(outputPath);

    if (
      cached?.researched?.title
    ) {
      console.log(
        "METADATA — using cached research",
      );
      return cached;
    }
  } catch {}

  const sourceTxt =
    await findSourceText(
      sourceFolder,
    );

  const prompt = `
Research the exact theatre/performance production below for Steve Gregson's professional photography archive.

PRODUCTION:
${production}

SOURCE FOLDER:
${path.basename(sourceFolder)}

EXISTING SOURCE TXT:
${sourceTxt.text || "(none provided)"}

Research THIS production, not another production of the same play.

Prefer:
- producing company's own website
- venue website
- official production/company pages
- programmes and official announcements
- reputable theatre reviews
- named creative professional sites

Do not fabricate credits. If a credit cannot be genuinely verified, return an empty string.

Venue must be the actual performance venue when verified.

Description must be concise public-facing portfolio copy, not a research report.

Return JSON only:
{
  "title": "",
  "venue": "",
  "month": null,
  "year": null,
  "director": "",
  "associateDirector": "",
  "musicalDirector": "",
  "choreographer": "",
  "movementDirector": "",
  "lightingDesign": "",
  "setDesign": "",
  "costumeDesign": "",
  "setCostumeDesign": "",
  "soundDesign": "",
  "commissionedBy": "",
  "description": "",
  "conflicts": [],
  "sources": [
    {
      "url": "",
      "title": "",
      "supports": []
    }
  ],
  "notes": ""
}

Every populated researched field must have credible support in sources or the supplied source TXT.
Do not invent source URLs.
`.trim();

  console.log();
  console.log(
    "METADATA — researching production and creative team...",
  );

  const response =
    await paidResponse(
      client,
      {
        model:
          RESEARCH_MODEL,
        tools: [
          {
            type:
              "web_search",
          },
        ],
        input: [
          {
            role:
              "user",
            content: [
              {
                type:
                  "input_text",
                text:
                  prompt,
              },
            ],
          },
        ],
      },
      paidState,
    );

  const researched =
    extractJson(
      response.output_text,
    );

  const audit = {
    version: 1,
    production,
    researchedAt:
      new Date()
        .toISOString(),
    model:
      RESEARCH_MODEL,
    sourceTxt: {
      path:
        sourceTxt.path,
      originalText:
        sourceTxt.text,
    },
    researched,
  };

  await writeJson(
    outputPath,
    audit,
  );

  const lines = [];

  function add(label, value) {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ""
    ) {
      return;
    }

    lines.push(
      `${label}: ${String(value).trim()}`,
    );
  }

  add(
    "Production",
    researched.title ||
      production,
  );

  add(
    "Venue",
    researched.venue,
  );

  const month =
    Number(
      researched.month,
    );

  if (
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12
  ) {
    add(
      "Month",
      monthNames()[
        month - 1
      ],
    );
  }

  add(
    "Year",
    researched.year,
  );
  add(
    "Director",
    researched.director,
  );
  add(
    "Associate Director",
    researched
      .associateDirector,
  );
  add(
    "Musical Director",
    researched
      .musicalDirector,
  );
  add(
    "Choreographer",
    researched
      .choreographer,
  );
  add(
    "Movement Director",
    researched
      .movementDirector,
  );
  add(
    "Lighting Design",
    researched
      .lightingDesign,
  );
  add(
    "Set Design",
    researched
      .setDesign,
  );
  add(
    "Costume Design",
    researched
      .costumeDesign,
  );
  add(
    "Set & Costume Design",
    researched
      .setCostumeDesign,
  );
  add(
    "Sound Design",
    researched
      .soundDesign,
  );
  add(
    "Commissioned by",
    researched
      .commissionedBy,
  );
  add(
    "Description",
    researched
      .description,
  );

  await fs.writeFile(
    proposedPath,
    lines.join("\n") +
      "\n",
    "utf8",
  );

  return audit;
}

async function validatePackage(
  outputDir,
) {
  const finalSelection =
    await readJson(
      path.join(
        outputDir,
        "final-selection.json",
      ),
    );

  const images =
    Array.isArray(
      finalSelection.images,
    )
      ? finalSelection.images
      : [];

  if (!images.length) {
    throw new Error(
      "Final selection contains no images.",
    );
  }

  const stagingDir =
    path.join(
      outputDir,
      "selected-web-staging",
    );

  const staged =
    (
      await fs.readdir(
        stagingDir,
        {
          withFileTypes: true,
        },
      )
    ).filter(
      (entry) =>
        entry.isFile() &&
        !entry.name
          .startsWith("."),
    );

  if (
    staged.length !==
    images.length
  ) {
    throw new Error(
      `Package validation failed: ${images.length} selected but ${staged.length} staged.`,
    );
  }

  for (const image of images) {
    if (
      typeof image.alt !==
        "string" ||
      !image.alt.trim()
    ) {
      throw new Error(
        `Package validation failed: image #${image.index} has no alt text.`,
      );
    }

    const stats =
      await fs.stat(
        path.join(
          stagingDir,
          image.stagedFile,
        ),
      );

    if (!stats.size) {
      throw new Error(
        `Package validation failed: empty staged file ${image.stagedFile}.`,
      );
    }
  }

  for (const required of [
    "final-selection.json",
    "metadata-research.json",
    "metadata-proposed.txt",
    "thumbnail-catalogue.json",
  ]) {
    const stats =
      await fs.stat(
        path.join(
          outputDir,
          required,
        ),
      );

    if (!stats.size) {
      throw new Error(
        `Package validation failed: ${required} is empty.`,
      );
    }
  }

  return {
    selected:
      images.length,
    staged:
      staged.length,
  };
}

async function openInFinder(
  folder,
) {
  if (process.platform !== "darwin") {
    return;
  }

  await new Promise((resolve) => {
    const child =
      spawn(
        "open",
        [folder],
        {
          stdio:
            "ignore",
        },
      );

    child.on(
      "close",
      resolve,
    );

    child.on(
      "error",
      resolve,
    );
  });
}

async function main() {
  console.log();
  console.log(
    "==============================================",
  );
  console.log(
    "STEVE GREGSON — PRODUCTION CURATOR",
  );
  console.log(
    "==============================================",
  );
  console.log(
    "Local folder → visual edit → alt text → metadata → Backstage import package",
  );
  console.log();

  const rl =
    readline.createInterface({
      input:
        process.stdin,
      output:
        process.stdout,
    });

  try {
    let sourceFolder =
      argValue("folder");

    if (!sourceFolder) {
      sourceFolder =
        await chooseFolderWithFinder();
    }

    if (!sourceFolder) {
      sourceFolder =
        await ask(
          rl,
          "Production image folder",
        );
    }

    sourceFolder =
      path.resolve(
        sourceFolder,
      );

    const sourceStats =
      await fs.stat(
        sourceFolder,
      );

    if (
      !sourceStats.isDirectory()
    ) {
      throw new Error(
        "Selected source is not a folder.",
      );
    }

    if (
      sourceLooksCloudBacked(sourceFolder) &&
      !hasFlag("allow-cloud-source")
    ) {
      throw new Error(
        "CLOUD SOURCE SAFETY STOP: this folder is inside a cloud-provider mount. Reading every source image could hydrate large amounts of data onto this Mac. Copy the single production locally first, or rerun with --allow-cloud-source only if you intentionally accept that behaviour.",
      );
    }

    const defaultProduction =
      cleanDisplayName(
        path.basename(
          sourceFolder,
        ),
      );

    const production =
      argValue(
        "production",
      ) ||
      await ask(
        rl,
        "Production name",
        defaultProduction,
      );

    const candidates =
      await listImages(
        sourceFolder,
      );

    if (!candidates.length) {
      throw new Error(
        "No supported JPG, JPEG, PNG or WebP photographs were found in that folder.",
      );
    }

    const outputRoot =
      argValue(
        "output-root",
      ) ||
      DEFAULT_OUTPUT_ROOT;

    const outputDir =
      path.join(
        outputRoot,
        safeName(
          production,
        ),
      );

    if (
      pathIsInside(sourceFolder, outputDir) ||
      pathIsInside(outputDir, sourceFolder)
    ) {
      throw new Error(
        "SAFETY STOP: source and curator output folders must be separate.",
      );
    }

    await fs.mkdir(
      outputRoot,
      { recursive: true },
    );

    await assertDiskSafety(
      outputRoot,
      candidates,
    );

    await fs.mkdir(
      outputDir,
      { recursive: true },
    );

    const discovery = {
      version: 1,
      source:
        "local-folder",
      production,
      sourceFolder,
      generatedAt:
        new Date()
          .toISOString(),
      candidateCount:
        candidates.length,
      candidates:
        candidates.map(
          (
            candidate,
            index,
          ) => ({
            index:
              index + 1,
            name:
              candidate.name,
            sourcePath:
              candidate.relativePath,
            modified:
              candidate.modified,
            size:
              candidate.size,
          }),
        ),
    };

    await writeJson(
      path.join(
        outputDir,
        "discovery.json",
      ),
      discovery,
    );

    console.log();
    console.log(
      `Source photographs: ${candidates.length}`,
    );
    console.log(
      `Output: ${outputDir}`,
    );

    const thumbnailDir =
      await prepareThumbnails(
        candidates,
        outputDir,
      );

    const allIndices =
      candidates.map(
        (_, index) =>
          index + 1,
      );

    const contactSheets =
      await generateContactSheets(
        thumbnailDir,
        allIndices,
        outputDir,
        "contact-sheets",
        "contact-sheets.json",
      );

    console.log();
    console.log(
      `Preparation complete: ${contactSheets.sheets.length} contact sheet(s).`,
    );

    if (
      hasFlag(
        "prepare-only",
      )
    ) {
      console.log();
      console.log(
        "PREPARE-ONLY COMPLETE. No paid API calls were made.",
      );
      await openInFinder(
        outputDir,
      );
      return;
    }

    const envText =
      await loadEnvText();

    const apiKey =
      readEnvValue(
        envText,
        "OPENAI_API_KEY",
      );

    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is missing from .env.local. Preparation is complete; no paid API call was made.",
      );
    }

    console.log();
    console.log(
      "The next stage uses the paid OpenAI API.",
    );
    console.log(
      "Nothing chargeable has happened yet.",
    );

    const budgetRaw =
      argValue(
        "budget",
      ) ||
      await ask(
        rl,
        "Maximum authorised API spend for this production in USD",
        "5",
      );

    const budgetUsd =
      Number(
        budgetRaw,
      );

    if (
      !Number.isFinite(
        budgetUsd,
      ) ||
      budgetUsd <= 0
    ) {
      throw new Error(
        "A positive paid-run budget is required.",
      );
    }

    if (
      !hasFlag(
        "approved-paid-run",
      )
    ) {
      const approval =
        await rl.question(
          `Type APPROVE PAID RUN to authorise this one curation up to \$${budgetUsd.toFixed(2)}: `,
        );

      if (
        approval.trim() !==
        "APPROVE PAID RUN"
      ) {
        console.log();
        console.log(
          "Paid run not approved. Preparation remains cached and can be resumed later.",
        );
        return;
      }
    }

    const OpenAI =
      (await import(
        "openai"
      )).default;

    const client =
      new OpenAI({
        apiKey,
        timeout:
          180000,
        maxRetries:
          2,
      });

    const paidState =
      await loadLedger(
        outputDir,
        budgetUsd,
      );

    const passOne =
      await runPassOne(
        client,
        production,
        contactSheets,
        outputDir,
        paidState,
      );

    console.log();
    console.log(
      `Pass 1: ${passOne.shortlist.length} shortlisted; ${passOne.strongest.length} strongest.`,
    );

    const finalEdit =
      await runPassTwo(
        client,
        production,
        passOne,
        thumbnailDir,
        outputDir,
        paidState,
      );

    const staged =
      await stageFinalSelection(
        sourceFolder,
        candidates,
        finalEdit,
        outputDir,
        production,
      );

    console.log();
    console.log(
      `Final selection staged: ${staged.manifest.selectedCount} photographs.`,
    );

    await runMetadataResearch(
      client,
      production,
      sourceFolder,
      outputDir,
      paidState,
    );

    const validation =
      await validatePackage(
        outputDir,
      );

    console.log();
    console.log(
      "==============================================",
    );
    console.log(
      "CURATION COMPLETE — IMPORT PACKAGE PASS",
    );
    console.log(
      "==============================================",
    );
    console.log(
      `Source photographs:     ${candidates.length}`,
    );
    console.log(
      `First-pass shortlist:   ${passOne.shortlist.length}`,
    );
    console.log(
      `Final website edit:     ${validation.selected}`,
    );
    console.log(
      `Alt text complete:      ${validation.selected}/${validation.selected}`,
    );
    console.log(
      `Staged photographs:     ${validation.staged}/${validation.selected}`,
    );
    console.log(
      `Recorded API spend:     \$${Number(paidState.ledger.actualSpendUsd ?? 0).toFixed(4)}`,
    );
    console.log();
    console.log(
      "Ready for Backstage → Curated Archive Import:",
    );
    console.log(
      outputDir,
    );

    await openInFinder(
      outputDir,
    );
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error();
  console.error(
    "CURATOR ERROR:",
    error instanceof Error
      ? error.message
      : String(error),
  );
  process.exitCode = 1;
});
