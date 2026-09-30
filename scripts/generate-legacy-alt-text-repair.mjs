import fs from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import OpenAI from "openai";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const PLAN =
  "scripts/legacy-alt-text-repair-plan.json";

const OUTPUT =
  "scripts/legacy-alt-text-repair-proposals.json";

const LEDGER =
  "scripts/legacy-alt-text-repair-ledger.json";

const MODEL =
  process.env.OPENAI_ARCHIVE_ALT_REPAIR_MODEL?.trim() ||
  "gpt-5.5";

const BUDGET_USD =
  Number(
    process.env.OPENAI_ALT_REPAIR_BUDGET_USD ??
    "0",
  );

const MAX_OUTPUT_TOKENS = 3500;
const BATCH_SIZE = 10;

const PRICING = {
  model: "gpt-5.5",
  inputPerMillion: 5,
  cachedInputPerMillion: 0.5,
  outputPerMillion: 30,
};

const EXECUTE =
  process.argv.includes("--execute");

const SLUG_ARGUMENT =
  process.argv.find(
    value =>
      value.startsWith("--slug="),
  );

const ONLY_SLUG =
  SLUG_ARGUMENT
    ? SLUG_ARGUMENT
        .slice("--slug=".length)
        .trim()
    : "";

function isLegacyGeneric(value) {
  return /\bproduction\s*photograph(?:\s+\d+\s+of\s+\d+)?\b/i
    .test(String(value ?? ""));
}

function cleanAlt(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function validateAlt(value) {
  const alt =
    cleanAlt(value);

  if (!alt) {
    throw new Error(
      "Generated alt text is empty.",
    );
  }

  if (isLegacyGeneric(alt)) {
    throw new Error(
      `Generated alt still contains legacy boilerplate: ${alt}`,
    );
  }

  if (
    /^(image|photo|photograph)\s+of\b/i
      .test(alt)
  ) {
    throw new Error(
      `Generated alt begins with prohibited wording: ${alt}`,
    );
  }

  if (alt.length > 240) {
    throw new Error(
      `Generated alt exceeds 240 characters: ${alt.length}`,
    );
  }

  return alt;
}

async function readJson(file) {
  try {
    return JSON.parse(
      await fs.readFile(
        file,
        "utf8",
      ),
    );
  } catch (error) {
    if (
      error?.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

async function writeJsonAtomic(
  file,
  data,
) {
  const temp =
    `${file}.tmp`;

  await fs.writeFile(
    temp,
    JSON.stringify(
      data,
      null,
      2,
    ) + "\n",
  );

  await fs.rename(
    temp,
    file,
  );
}

function usageCost(usage) {
  const inputTokens =
    Number(
      usage?.input_tokens ??
      0,
    );

  const cachedTokens =
    Number(
      usage
        ?.input_tokens_details
        ?.cached_tokens ??
      0,
    );

  const outputTokens =
    Number(
      usage?.output_tokens ??
      0,
    );

  const uncached =
    Math.max(
      0,
      inputTokens -
        cachedTokens,
    );

  return (
    (
      uncached /
      1_000_000
    ) *
      PRICING.inputPerMillion +
    (
      cachedTokens /
      1_000_000
    ) *
      PRICING.cachedInputPerMillion +
    (
      outputTokens /
      1_000_000
    ) *
      PRICING.outputPerMillion
  );
}

async function loadLedger() {
  return (
    await readJson(
      LEDGER,
    )
  ) || {
    version: 1,
    model: MODEL,
    budgetUsd:
      BUDGET_USD,
    actualSpendUsd: 0,
    calls: [],
    completed: {},
  };
}

async function guardedCreate(
  client,
  params,
  ledger,
) {
  if (
    MODEL !==
    PRICING.model
  ) {
    throw new Error(
      `BUDGET STOP: model ${MODEL} is not authorised by this repair runner.`,
    );
  }

  if (
    !Number.isFinite(
      BUDGET_USD,
    ) ||
    BUDGET_USD <= 0
  ) {
    throw new Error(
      "BUDGET STOP: set OPENAI_ALT_REPAIR_BUDGET_USD to an explicit positive ceiling.",
    );
  }

  if (
    !client.responses
      ?.inputTokens?.count
  ) {
    throw new Error(
      "BUDGET STOP: SDK lacks responses.inputTokens.count; refusing unguarded paid request.",
    );
  }

  const counted =
    await client.responses
      .inputTokens
      .count({
        model: MODEL,
        input:
          params.input,
      });

  const inputTokens =
    Number(
      counted
        ?.input_tokens ??
      0,
    );

  if (
    !Number.isFinite(
      inputTokens,
    ) ||
    inputTokens <= 0
  ) {
    throw new Error(
      "BUDGET STOP: input-token preflight failed.",
    );
  }

  const conservativeMax =
    (
      inputTokens /
      1_000_000
    ) *
      PRICING.inputPerMillion +
    (
      MAX_OUTPUT_TOKENS /
      1_000_000
    ) *
      PRICING.outputPerMillion;

  const already =
    Number(
      ledger.actualSpendUsd ??
      0,
    );

  if (
    already +
      conservativeMax >
    BUDGET_USD
  ) {
    throw new Error(
      `BUDGET STOP: next call could exceed $${BUDGET_USD.toFixed(2)} ceiling. ` +
      `Recorded $${already.toFixed(4)}; conservative next-call max $${conservativeMax.toFixed(4)}.`,
    );
  }

  const response =
    await client.responses.create({
      ...params,
      model: MODEL,
      max_output_tokens:
        MAX_OUTPUT_TOKENS,
    });

  if (!response?.usage) {
    throw new Error(
      "BUDGET STOP: response had no usage data.",
    );
  }

  const cost =
    usageCost(
      response.usage,
    );

  ledger.actualSpendUsd =
    already + cost;

  ledger.updatedAt =
    new Date()
      .toISOString();

  ledger.budgetUsd =
    BUDGET_USD;

  ledger.model =
    MODEL;

  ledger.calls.push({
    at:
      new Date()
        .toISOString(),
    inputTokens:
      response.usage
        .input_tokens ??
      0,
    cachedInputTokens:
      response.usage
        ?.input_tokens_details
        ?.cached_tokens ??
      0,
    outputTokens:
      response.usage
        .output_tokens ??
      0,
    actualCostUsd:
      cost,
    cumulativeSpendUsd:
      ledger.actualSpendUsd,
  });

  await writeJsonAtomic(
    LEDGER,
    ledger,
  );

  console.log(
    `ALT REPAIR BUDGET: call $${cost.toFixed(4)} | cumulative ` +
    `$${ledger.actualSpendUsd.toFixed(4)} / $${BUDGET_USD.toFixed(2)}`,
  );

  return response;
}

function buildBatchInput(batch) {
  const production =
    batch[0];

  const content = [
    {
      type: "input_text",
      text: [
        "Write accessibility alt text for theatre production photographs.",
        "",
        "These photographs already have legacy boilerplate alt text. Replace it with concise, image-specific descriptions of what is visibly present.",
        "",
        "Production context:",
        JSON.stringify(
          {
            title:
              production.title,
            venue:
              production.venue,
            year:
              production.year,
            description:
              production.description,
          },
          null,
          2,
        ),
        "",
        "Requirements:",
        "- Describe the visible action, performers, staging, costume, composition, lighting or atmosphere when useful.",
        "- Be factual and specific to each individual photograph.",
        "- Every alt text in the batch must be distinct. When photographs are visually similar, differentiate them using visible action, pose, composition, props, costume, lighting, or positioning.",
        "- Aim for under 140 characters where practical.",
        "- Never use the phrase 'production photograph'.",
        "- Do not begin with 'image of', 'photo of', or 'photograph of'.",
        "- Do not include Steve Gregson's name.",
        "- Do not infer age, gender, ethnicity, disability, relationships, emotions, character identity or other personal attributes unless clearly supported.",
        "- Do not describe a scene as rehearsal, backstage, performance, press, campaign or another context unless that context is explicitly supplied.",
        "- If the current alt text, production description, production credits, filename, or other supplied production context explicitly identifies a performer, public figure, celebrity, or character shown in the photograph, include that name when useful.",
        "- Preserve a known character name when it is explicitly supported.",
        "- Never identify a real person from appearance alone.",
        "- Otherwise describe people generically as performer, actor, person, or another neutral visible role.",
        "- Return one result for every supplied image ID and no others.",
      ].join("\n"),
    },
  ];

  for (const image of batch) {
    content.push(
      {
        type: "input_text",
        text:
          `IMAGE ID: ${image.imageId}\n` +
          `Current filename: ${image.filename}\n` +
          `Current legacy alt: ${image.originalAlt}`,
      },
      {
        type: "input_image",
        image_url:
          image.imageUrl,
        detail: "high",
      },
    );
  }

  return [
    {
      role: "user",
      content,
    },
  ];
}

async function main() {
  const plan =
    await readJson(
      PLAN,
    );

  if (
    !plan ||
    plan.imageCount !== 2389 ||
    plan.productionCount !== 72 ||
    !Array.isArray(
      plan.images,
    ) ||
    plan.images.length !== 2389
  ) {
    throw new Error(
      "STOP: authoritative repair plan is missing or has changed.",
    );
  }

  const existing =
    await readJson(
      OUTPUT,
    );

  const proposals =
    existing ?? {
      version: 1,
      generatedAt:
        new Date()
          .toISOString(),
      model:
        MODEL,
      sourcePlan:
        PLAN,
      proposals: {},
    };

  proposals.proposals =
    proposals.proposals &&
    typeof proposals.proposals ===
      "object"
      ? proposals.proposals
      : {};

  if (
    ONLY_SLUG &&
    !plan.images.some(
      image =>
        image.slug ===
        ONLY_SLUG,
    )
  ) {
    throw new Error(
      `STOP: production slug "${ONLY_SLUG}" is not in the frozen repair plan.`,
    );
  }

  const pending =
    plan.images.filter(
      image =>
        !proposals.proposals[
          image.imageId
        ] &&
        (
          !ONLY_SLUG ||
          image.slug ===
            ONLY_SLUG
        ),
    );

  const byProduction =
    new Map();

  for (const image of pending) {
    const group =
      byProduction.get(
        image.slug,
      ) ?? [];

    group.push(image);

    byProduction.set(
      image.slug,
      group,
    );
  }

  let plannedCalls = 0;

  for (
    const images
    of byProduction.values()
  ) {
    plannedCalls +=
      Math.ceil(
        images.length /
          BATCH_SIZE,
      );
  }

  console.log(
    "\n=== LEGACY ALT GENERATOR ===",
  );

  console.log(
    "Model:",
    MODEL,
  );

  console.log(
    "Total cohort:",
    plan.images.length,
  );

  console.log(
    "Production filter:",
    ONLY_SLUG || "ALL",
  );

  console.log(
    "Already proposed:",
    Object.keys(
      proposals.proposals,
    ).length,
  );

  console.log(
    "Remaining:",
    pending.length,
  );

  console.log(
    "Productions remaining:",
    byProduction.size,
  );

  console.log(
    "Planned calls:",
    plannedCalls,
  );

  if (!EXECUTE) {
    console.log(
      "\nPLAN ONLY — NO OPENAI CALLS MADE.",
    );

    console.log(
      "NO DATABASE CHANGES MADE.",
    );

    return;
  }

  const apiKey =
    process.env
      .OPENAI_API_KEY
      ?.trim();

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured.",
    );
  }

  const client =
    new OpenAI({
      apiKey,
    });

  const ledger =
    await loadLedger();

  for (
    const [slug, images]
    of byProduction.entries()
  ) {
    console.log(
      `\n=== ${slug} — ${images.length} remaining ===`,
    );

    for (
      let offset = 0;
      offset < images.length;
      offset += BATCH_SIZE
    ) {
      const batch =
        images.slice(
          offset,
          offset + BATCH_SIZE,
        );

      const response =
        await guardedCreate(
          client,
          {
            reasoning: {
              effort: "low",
            },
            text: {
              format: {
                type: "json_schema",
                name: "legacy_alt_repair",
                strict: true,
                schema: {
                  type: "object",
                  additionalProperties:
                    false,
                  properties: {
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties:
                          false,
                        properties: {
                          imageId: {
                            type: "string",
                          },
                          alt: {
                            type: "string",
                          },
                        },
                        required: [
                          "imageId",
                          "alt",
                        ],
                      },
                    },
                  },
                  required: [
                    "items",
                  ],
                },
              },
            },
            input:
              buildBatchInput(
                batch,
              ),
          },
          ledger,
        );

      const output =
        response.output_text
          ?.trim();

      if (!output) {
        throw new Error(
          "Vision model returned no output.",
        );
      }

      const parsed =
        JSON.parse(
          output,
        );

      if (
        !Array.isArray(
          parsed.items,
        )
      ) {
        throw new Error(
          "Vision response contained no items array.",
        );
      }

      const expected =
        new Set(
          batch.map(
            image =>
              image.imageId,
          ),
        );

      const returned =
        new Set();

      for (
        const item
        of parsed.items
      ) {
        if (
          !expected.has(
            item.imageId,
          )
        ) {
          throw new Error(
            `Unexpected image ID returned: ${item.imageId}`,
          );
        }

        if (
          returned.has(
            item.imageId,
          )
        ) {
          throw new Error(
            `Duplicate image ID returned: ${item.imageId}`,
          );
        }

        returned.add(
          item.imageId,
        );

        const source =
          batch.find(
            image =>
              image.imageId ===
              item.imageId,
          );

        proposals.proposals[
          item.imageId
        ] = {
          imageId:
            item.imageId,
          slug:
            source.slug,
          filename:
            source.filename,
          originalAlt:
            source.originalAlt,
          proposedAlt:
            validateAlt(
              item.alt,
            ),
        };
      }

      const missingReturned =
        batch.filter(
          image =>
            !returned.has(
              image.imageId,
            ),
        );

      proposals.updatedAt =
        new Date()
          .toISOString();

      await writeJsonAtomic(
        OUTPUT,
        proposals,
      );

      ledger.completed =
        ledger.completed &&
        typeof ledger.completed ===
          "object"
          ? ledger.completed
          : {};

      for (
        const imageId
        of returned
      ) {
        ledger.completed[
          imageId
        ] = true;
      }

      await writeJsonAtomic(
        LEDGER,
        ledger,
      );

      console.log(
        `Saved ${Object.keys(proposals.proposals).length}/${plan.images.length} proposals.`,
      );

      if (
        missingReturned.length
      ) {
        console.warn(
          `PARTIAL RESPONSE: saved ${returned.size}/${expected.size}; ` +
          `${missingReturned.length} image(s) remain for a resumable retry.`,
        );
      }
    }
  }

  console.log(
    "\nALT GENERATION COMPLETE.",
  );

  console.log(
    `Proposals: ${Object.keys(proposals.proposals).length}`,
  );

  console.log(
    `Spend recorded: $${Number(ledger.actualSpendUsd ?? 0).toFixed(4)}`,
  );

  console.log(
    "DATABASE UNCHANGED.",
  );
}

await main();
