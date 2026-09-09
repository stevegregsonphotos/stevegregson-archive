import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import OpenAI from "openai";

const ARCHIVE_ROOT = path.join(
  os.homedir(),
  "Downloads",
  "Archive Download",
);

const SELECTS_ROOT = path.join(
  ARCHIVE_ROOT,
  "Archive Selects",
);

const CURATION_ROOT = path.join(
  ARCHIVE_ROOT,
  "Automated Curation",
);

const ENV_PATH = path.resolve(".env.local");

const METADATA_OVERRIDES_PATH =
  path.resolve(
    "scripts/archive-curator/archive-metadata-overrides.json",
  );

const monthNames = [
  "",
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

async function writeProposedMetadata({
  production,
  researched,
  proposedTxtPath,
}) {
  let overrides = {};

  try {
    overrides =
      JSON.parse(
        await fs.readFile(
          METADATA_OVERRIDES_PATH,
          "utf8",
        ),
      );
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  const manualOverride =
    overrides[production] ?? {};

  const proposed = {
    ...researched,
    ...manualOverride,
  };

  const lines = [];

  function addLine(label, value) {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim()
    ) {
      lines.push(
        `${label}: ${String(value).trim()}`,
      );
    }
  }

  addLine(
    "Production",
    proposed.title,
  );
  addLine(
    "Venue",
    proposed.venue,
  );

  const proposedMonth =
    Number.isInteger(proposed.month) &&
    proposed.month >= 1 &&
    proposed.month <= 12
      ? monthNames[proposed.month]
      : typeof proposed.month === "string"
        ? monthNames.find(
            (month) =>
              month.toLowerCase() ===
              proposed.month.trim().toLowerCase(),
          )
        : undefined;

  addLine(
    "Month",
    proposedMonth,
  );

  addLine("Year", proposed.year);
  addLine("Director", proposed.director);
  addLine(
    "Associate Director",
    proposed.associateDirector,
  );
  addLine(
    "Musical Director",
    proposed.musicalDirector,
  );
  addLine(
    "Choreographer",
    proposed.choreographer,
  );
  addLine(
    "Movement Director",
    proposed.movementDirector,
  );
  addLine(
    "Lighting Design",
    proposed.lightingDesign,
  );
  addLine(
    "Set Design",
    proposed.setDesign,
  );
  addLine(
    "Costume Design",
    proposed.costumeDesign,
  );
  addLine(
    "Set & Costume Design",
    proposed.setCostumeDesign,
  );
  addLine(
    "Sound Design",
    proposed.soundDesign,
  );
  addLine(
    "Commissioned by",
    proposed.commissionedBy,
  );
  addLine(
    "Description",
    proposed.description,
  );

  await fs.writeFile(
    proposedTxtPath,
    `${lines.join("\n")}\n`,
    "utf8",
  );

  return {
    proposed,
    overrideApplied:
      Object.keys(manualOverride).length > 0,
  };
}

function readEnvValue(text, key) {
  const line = text
    .split(/\r?\n/)
    .find((value) =>
      value.startsWith(`${key}=`),
    );

  if (!line) {
    return null;
  }

  let value =
    line.slice(key.length + 1).trim();

  if (
    (value.startsWith('"') &&
      value.endsWith('"')) ||
    (value.startsWith("'") &&
      value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return value || null;
}

function safeName(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[—–−]/g, "-")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanValue(value) {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  const trimmed = value.trim();

  if (/^not\s+found$/i.test(trimmed)) {
    return "";
  }

  return trimmed;
}

function parseTxt(text) {
  const result = {};

  for (
    const line
    of text.split(/\r?\n/)
  ) {
    const match =
      line.match(
        /^([^:]+):\s*(.*)$/,
      );

    if (!match) {
      continue;
    }

    result[
      match[1].trim()
    ] = cleanValue(
      match[2],
    );
  }

  return result;
}

function extractJson(text) {
  const trimmed = text.trim();

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
      "Research response did not contain JSON.",
    );
  }

  return JSON.parse(
    trimmed.slice(
      first,
      last + 1,
    ),
  );
}

const productionArg =
  process.argv
    .slice(2)
    .find((arg) =>
      arg.startsWith(
        "--production=",
      ),
    );

if (!productionArg) {
  throw new Error(
    'Use --production="Production folder name"',
  );
}

const production =
  productionArg
    .slice(
      "--production=".length,
    )
    .trim();

const forceRerun =
  process.argv.includes(
    "--rerun",
  );

const productionDir =
  path.join(
    SELECTS_ROOT,
    production,
  );

const files =
  await fs.readdir(
    productionDir,
  );

const txtName =
  files.find((name) =>
    name
      .toLowerCase()
      .endsWith(".txt"),
  );

if (!txtName) {
  throw new Error(
    `No TXT found for ${production}`,
  );
}

const txtPath =
  path.join(
    productionDir,
    txtName,
  );

const originalText =
  await fs.readFile(
    txtPath,
    "utf8",
  );

const source =
  parseTxt(originalText);

const finalSelectionPath =
  path.join(
    CURATION_ROOT,
    safeName(production),
    "final-selection.json",
  );

let dropboxDate = null;

try {
  const finalSelection =
    JSON.parse(
      await fs.readFile(
        finalSelectionPath,
        "utf8",
      ),
    );

  dropboxDate =
    finalSelection.dropboxDate ??
    null;
} catch {}

const envText =
  await fs.readFile(
    ENV_PATH,
    "utf8",
  );

const apiKey =
  readEnvValue(
    envText,
    "OPENAI_API_KEY",
  );

if (!apiKey) {
  throw new Error(
    "OPENAI_API_KEY is missing from .env.local",
  );
}

const outputDir =
  path.join(
    CURATION_ROOT,
    safeName(production),
  );

const outputPath =
  path.join(
    outputDir,
    "metadata-research.json",
  );

const proposedTxtPath =
  path.join(
    outputDir,
    "metadata-proposed.txt",
  );

if (!forceRerun) {
  try {
    const cached =
      JSON.parse(
        await fs.readFile(
          outputPath,
          "utf8",
        ),
      );

    if (cached?.researched?.title) {
      const {
        overrideApplied,
      } =
        await writeProposedMetadata({
          production,
          researched:
            cached.researched,
          proposedTxtPath,
        });

      console.log();
      console.log(
        "METADATA RESEARCH",
      );
      console.log(production);
      console.log(
        "Using cached research.",
      );
      if (overrideApplied) {
        console.log(
          "Steve metadata override applied.",
        );
      }
      console.log(
        "Output:",
        outputPath,
      );
      console.log(
        "Proposed TXT:",
        proposedTxtPath,
      );
      process.exit(0);
    }
  } catch {}
}

const client =
  new OpenAI({ apiKey });

const model =
  process.env
    .OPENAI_ARCHIVE_RESEARCH_MODEL ??
  "gpt-5.5";

const prompt = `
Research the exact theatre/performance production below for a professional photography Archive.

PRODUCTION FOLDER:
${production}

EXISTING SOURCE TXT:
${originalText}

DROPBOX DATE EVIDENCE:
${JSON.stringify(dropboxDate, null, 2)}

This is evidence-based metadata research.

IMPORTANT RULES:

1. Research THIS SPECIFIC production, not another production of the same play/show.

2. Search the web. Prefer:
   - producing company's own website
   - venue website
   - official production/company pages
   - programme or official announcement
   - reputable theatre reviews
   - named creative's professional portfolio/site

3. Existing TXT is useful evidence but is NOT automatically correct.

4. Any existing value equal to "Not found" (case-insensitive) means UNKNOWN. It is not metadata.

5. Do not fabricate or infer creative credits merely because a role normally exists.

6. If a credit cannot be genuinely verified, return an empty string.

7. Distinguish the PERFORMANCE VENUE from the producing organisation/school. "Venue" should be the actual theatre/performance location when verified.

8. Month/year:
   - explicit reliable production information takes priority;
   - Dropbox image date is an authoritative fallback for when Steve photographed the production;
   - if web evidence conflicts materially with Dropbox/source evidence, report the conflict instead of silently changing it.

9. Production title should NOT contain the date. Return the clean show/production title only.

10. "Commissioned by" means the organisation/client for whom Steve photographed the production, when reasonably established.

11. Movement Director may be returned in movementDirector. Do NOT silently relabel Movement Director as Choreographer unless a source actually calls them choreographer.

12. Set and Costume may be separate or combined. Preserve the source's actual credit structure.

13. Description is public-facing portfolio copy, NOT a research report.
   - Write 1-2 concise, polished sentences.
   - Identify the production/company and useful production-specific context.
   - Do not mention review dates, research methodology, evidence gathering, Dropbox, verification, or phrases such as "reviewed performances".
   - Avoid generic plot-summary filler.
   - Do not stuff creative credits into the description when they already have dedicated fields.

Return JSON only in exactly this general shape:

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

For every populated researched field, there must be credible support in sources or explicit source/Dropbox evidence.

Do not invent source URLs.
`.trim();

console.log();
console.log(
  "METADATA RESEARCH",
);
console.log(production);
console.log(
  "Searching the web...",
);

const response =
  await client.responses.create({
    model,
    tools: [
      {
        type: "web_search",
      },
    ],
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: prompt,
          },
        ],
      },
    ],
  });

const raw =
  response.output_text?.trim();

if (!raw) {
  throw new Error(
    "Metadata research returned no output.",
  );
}

const researched =
  extractJson(raw);

const audit = {
  version: 1,
  production,
  researchedAt:
    new Date().toISOString(),
  model,
  sourceTxt: {
    path: txtPath,
    parsed: source,
    originalText,
  },
  dropboxDate,
  researched,
};

await fs.mkdir(
  outputDir,
  { recursive: true },
);

await fs.writeFile(
  outputPath,
  JSON.stringify(
    audit,
    null,
    2,
  ),
  "utf8",
);

const {
  proposed,
  overrideApplied,
} =
  await writeProposedMetadata({
    production,
    researched,
    proposedTxtPath,
  });

console.log();
console.log(
  "METADATA RESEARCH COMPLETE",
);
console.log(
  "Output:",
  outputPath,
);
console.log(
  "Proposed TXT:",
  proposedTxtPath,
);
console.log();
console.log(
  JSON.stringify(
    proposed,
    null,
    2,
  ),
);
if (overrideApplied) {
  console.log(
    "Steve metadata override applied.",
  );
}
console.log();
console.log(
  "Original TXT was NOT changed.",
);
