import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import OpenAI from "openai";

const PROJECT_ROOT = process.cwd();

const ENV_PATH = path.join(
  PROJECT_ROOT,
  ".env.local",
);

const CONTACT_SHEET_DIR = path.join(
  os.homedir(),
  "Downloads",
  "Archive Download",
  "Curation Review",
  "Rock In The Rose",
  "Contact Sheets",
);

const OUTPUT_PATH = path.join(
  os.homedir(),
  "Downloads",
  "Archive Download",
  "Curation Review",
  "Rock In The Rose",
  "ai-curation-test.json",
);

const PRODUCTION = {
  title:
    "Creative Lighting Control: Rock In The Rose",
  venue:
    "Rose Bruford College, Sidcup",
  month: "February",
  year: 2023,
  candidateCount: 311,
};

const MANUAL_BENCHMARK = [
  3, 12, 18, 22, 31, 34, 36, 43,
  47, 52, 58, 65, 71, 76, 82, 95,
  102, 108, 121, 127, 131, 139,
  142, 146, 150, 156, 159, 163,
  169, 172, 175, 190, 205, 209,
  215, 220, 225, 226, 232, 234,
  244, 247, 249, 254, 260, 268,
  278, 292,
];

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

function imageToDataUrl(buffer) {
  return (
    "data:image/jpeg;base64," +
    buffer.toString("base64")
  );
}

function extractJson(text) {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {}

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (
    firstBrace === -1 ||
    lastBrace === -1 ||
    lastBrace <= firstBrace
  ) {
    throw new Error(
      "Model response did not contain a JSON object.",
    );
  }

  return JSON.parse(
    trimmed.slice(firstBrace, lastBrace + 1),
  );
}

function normaliseNumbers(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [
    ...new Set(
      values
        .map((value) => Number(value))
        .filter(
          (value) =>
            Number.isInteger(value) &&
            value >= 1 &&
            value <= 311,
        ),
    ),
  ];
}

const envText =
  await fs.readFile(ENV_PATH, "utf8");

const apiKey =
  readEnvValue(envText, "OPENAI_API_KEY");

if (!apiKey) {
  throw new Error(
    "OPENAI_API_KEY is missing from .env.local",
  );
}

const client = new OpenAI({
  apiKey,
});

const sheetNames = (
  await fs.readdir(CONTACT_SHEET_DIR)
)
  .filter((name) =>
    /^rock-in-the-rose-\d{2}\.(?:jpg|jpeg)$/i.test(
      name,
    ),
  )
  .sort();

if (sheetNames.length !== 8) {
  throw new Error(
    `Expected 8 contact sheets, found ${sheetNames.length}.`,
  );
}

const content = [
  {
    type: "input_text",
    text: `
You are editing the long-term professional theatre-photography archive of Steve Gregson.

This is NOT a "pick a few highlights" task.

You must curate a substantial gallery that showcases the photographer's range and ability across the whole shoot.

PRODUCTION
${JSON.stringify(PRODUCTION, null, 2)}

EDITORIAL STANDARD

- Absolute minimum target: 20 photographs when the material supports it.
- Normal production: 20-40 photographs.
- Large or visually varied production: 40-50 photographs.
- Exceptional productions may exceed 50. Do not impose an artificial quota.
- Do not pad with weak photographs merely to reach a number.

The finished edit must demonstrate breadth in the photographer's work, including where available:

- scale and architectural stage pictures
- wide compositions
- medium storytelling frames
- close and intimate images
- theatrical lighting
- colour
- haze, beams and atmosphere
- technical control and backstage/process imagery
- performers and human moments
- details
- strong standalone compositions
- decisive moments
- visual rhythm across the full gallery

Avoid:

- genuine near-duplicates
- repeated frames that add nothing
- weak expressions
- obvious technical failures
- selecting many photographs simply because they show the same attractive lighting state

IMPORTANT:
The image number printed beneath each photograph is the unique identifier, e.g. #0047 means image 47.

Review ALL eight contact sheets as one production, not as eight separate galleries.

Choose:
1. a final gallery selection
2. one hero image
3. a sequence for the gallery
4. a short editorial rationale

Return JSON only in exactly this shape:

{
  "classification": "small|normal|large|exceptional",
  "hero": 0,
  "selected": [],
  "sequence": [],
  "heroReason": "",
  "editorialSummary": "",
  "rangeCovered": {
    "scale": [],
    "wide": [],
    "medium": [],
    "close": [],
    "lighting": [],
    "technicalProcess": [],
    "humanMoments": [],
    "details": []
  }
}
`.trim(),
  },
];

for (const name of sheetNames) {
  const fullPath =
    path.join(CONTACT_SHEET_DIR, name);

  const buffer =
    await fs.readFile(fullPath);

  content.push({
    type: "input_text",
    text: `Contact sheet: ${name}`,
  });

  content.push({
    type: "input_image",
    detail: "high",
    image_url: imageToDataUrl(buffer),
  });
}

console.log(
  `Sending ${sheetNames.length} contact sheets to OpenAI...`,
);

const response =
  await client.responses.create({
    model:
      process.env.OPENAI_ARCHIVE_CURATOR_MODEL ??
      "gpt-5.5",
    input: [
      {
        role: "user",
        content,
      },
    ],
  });

const raw =
  response.output_text?.trim();

if (!raw) {
  throw new Error(
    "OpenAI returned no output.",
  );
}

const result =
  extractJson(raw);

result.selected =
  normaliseNumbers(result.selected);

result.sequence =
  normaliseNumbers(result.sequence);

result.hero =
  Number(result.hero);

const selectedSet =
  new Set(result.selected);

const benchmarkSet =
  new Set(MANUAL_BENCHMARK);

const overlap =
  result.selected.filter((number) =>
    benchmarkSet.has(number),
  );

const missedBenchmark =
  MANUAL_BENCHMARK.filter(
    (number) => !selectedSet.has(number),
  );

const additionalChoices =
  result.selected.filter(
    (number) => !benchmarkSet.has(number),
  );

const report = {
  production: PRODUCTION,
  model:
    process.env.OPENAI_ARCHIVE_CURATOR_MODEL ??
    "gpt-5.5",
  result,
  benchmark: {
    manualSelectionCount:
      MANUAL_BENCHMARK.length,
    aiSelectionCount:
      result.selected.length,
    overlapCount:
      overlap.length,
    overlap,
    missedBenchmark,
    additionalChoices,
    manualHero: 292,
    aiHero: result.hero,
  },
};

await fs.writeFile(
  OUTPUT_PATH,
  JSON.stringify(report, null, 2),
  "utf8",
);

console.log();
console.log("DONE");
console.log(
  "Classification:",
  result.classification,
);
console.log(
  "AI selected:",
  result.selected.length,
);
console.log(
  "Hero:",
  result.hero,
);
console.log(
  "Overlap with our manual 48:",
  `${overlap.length}/${MANUAL_BENCHMARK.length}`,
);
console.log(
  "Output:",
  OUTPUT_PATH,
);
