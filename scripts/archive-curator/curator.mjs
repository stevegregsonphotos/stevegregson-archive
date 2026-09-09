import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const PROJECT_ROOT = process.cwd();

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

const ENV_PATH = path.join(
  PROJECT_ROOT,
  ".env.local",
);

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

async function getDropboxAccessToken(
  envText,
) {
  const appKey =
    readEnvValue(
      envText,
      "DROPBOX_APP_KEY",
    );

  const appSecret =
    readEnvValue(
      envText,
      "DROPBOX_APP_SECRET",
    );

  const refreshToken =
    readEnvValue(
      envText,
      "DROPBOX_REFRESH_TOKEN",
    );

  if (
    appKey &&
    appSecret &&
    refreshToken
  ) {
    const body =
      new URLSearchParams({
        grant_type:
          "refresh_token",
        refresh_token:
          refreshToken,
      });

    const credentials =
      Buffer.from(
        `${appKey}:${appSecret}`,
      ).toString("base64");

    const response =
      await fetch(
        "https://api.dropboxapi.com/oauth2/token",
        {
          method: "POST",
          headers: {
            Authorization:
              `Basic ${credentials}`,
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
          body,
        },
      );

    if (!response.ok) {
      const message =
        await response.text();

      throw new Error(
        `Dropbox token refresh failed (${response.status}): ${message.slice(0, 500)}`,
      );
    }

    const result =
      await response.json();

    if (!result.access_token) {
      throw new Error(
        "Dropbox token refresh returned no access token.",
      );
    }

    return result.access_token;
  }

  const accessToken =
    readEnvValue(
      envText,
      "DROPBOX_ACCESS_TOKEN",
    );

  if (accessToken) {
    return accessToken;
  }

  throw new Error(
    "Dropbox credentials are missing from .env.local.",
  );
}

function safeName(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

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
    "Could not locate the manifest image array.",
  );
}

function firstString(object, keys) {
  for (const key of keys) {
    const value = object?.[key];

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return "";
}

function getProductionName(item) {
  return firstString(item, [
    "production",
    "productionFolder",
    "production_folder",
    "archiveFolder",
    "archive_folder",
    "destinationFolder",
    "destination_folder",
    "show",
    "title",
  ]);
}

function getDropboxPath(item) {
  return firstString(item, [
    "dropboxPath",
    "dropbox_path",
    "sourcePath",
    "source_path",
    "path",
    "source",
  ]);
}

function normaliseDropboxPath(value) {
  if (!value) {
    return "";
  }

  return value.startsWith("/")
    ? value
    : `/${value}`;
}

function parentDropboxPath(value) {
  const normalised =
    normaliseDropboxPath(value);

  const index =
    normalised.lastIndexOf("/");

  if (index <= 0) {
    return "";
  }

  return normalised.slice(0, index);
}

async function dropboxRequest(
  token,
  endpoint,
  body,
) {
  const response = await fetch(
    `https://api.dropboxapi.com/2/${endpoint}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const message = await response.text();

    throw new Error(
      `Dropbox ${endpoint} failed (${response.status}): ${message.slice(0, 500)}`,
    );
  }

  return response.json();
}

async function listDropboxFolder(
  token,
  folder,
) {
  const entries = [];

  let result = await dropboxRequest(
    token,
    "files/list_folder",
    {
      path: folder,
      recursive: false,
      include_deleted: false,
      include_media_info: false,
    },
  );

  entries.push(...result.entries);

  while (result.has_more) {
    result = await dropboxRequest(
      token,
      "files/list_folder/continue",
      {
        cursor: result.cursor,
      },
    );

    entries.push(...result.entries);
  }

  return entries;
}

async function downloadDropboxThumbnail(
  token,
  dropboxPath,
) {
  const response = await fetch(
    "https://content.dropboxapi.com/2/files/get_thumbnail_v2",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify({
          resource: {
            ".tag": "path",
            path: dropboxPath,
          },
          format: {
            ".tag": "jpeg",
          },
          size: {
            ".tag": "w640h480",
          },
          mode: {
            ".tag": "fitone_bestfit",
          },
        }),
      },
    },
  );

  if (!response.ok) {
    const message = await response.text();

    throw new Error(
      `Thumbnail failed (${response.status}): ${message.slice(0, 300)}`,
    );
  }

  return Buffer.from(
    await response.arrayBuffer(),
  );
}

async function ensureThumbnails(
  token,
  candidates,
  outputDir,
) {
  const thumbnailDir =
    path.join(outputDir, "thumbnails");

  await fs.mkdir(
    thumbnailDir,
    { recursive: true },
  );

  const catalogue = [];

  console.log();
  console.log("THUMBNAILS");

  for (
    let index = 0;
    index < candidates.length;
    index += 1
  ) {
    const candidate =
      candidates[index];

    const number =
      String(index + 1).padStart(4, "0");

    const filename =
      `${number}.jpg`;

    const destination =
      path.join(
        thumbnailDir,
        filename,
      );

    let cached = true;

    try {
      await fs.access(destination);
    } catch {
      cached = false;

      const buffer =
        await downloadDropboxThumbnail(
          token,
          candidate.path,
        );

      await fs.writeFile(
        destination,
        buffer,
      );
    }

    catalogue.push({
      index: index + 1,
      thumbnail: filename,
      sourceName: candidate.name,
      sourcePath: candidate.path,
      modified: candidate.modified,
    });

    if (
      (index + 1) % 25 === 0 ||
      index + 1 === candidates.length
    ) {
      console.log(
        `${index + 1}/${candidates.length}`,
      );
    }
  }

  await fs.writeFile(
    path.join(
      outputDir,
      "thumbnail-catalogue.json",
    ),
    JSON.stringify(
      catalogue,
      null,
      2,
    ),
    "utf8",
  );

  return thumbnailDir;
}

async function generateContactSheets(
  thumbnailDir,
  candidateCount,
  outputDir,
) {
  const contactSheetDir =
    path.join(outputDir, "contact-sheets");

  await fs.mkdir(
    contactSheetDir,
    { recursive: true },
  );

  const pythonScript = `
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import json
import sys

thumbnail_dir = Path(sys.argv[1])
output_dir = Path(sys.argv[2])
candidate_count = int(sys.argv[3])

PER_SHEET = 32
COLUMNS = 4
ROWS = 8
CELL_W = 400
CELL_H = 330
IMAGE_W = 380
IMAGE_H = 285
LABEL_H = 28
MARGIN = 10

try:
    font = ImageFont.truetype(
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        18,
    )
except Exception:
    font = ImageFont.load_default()

sheets = []

for sheet_start in range(0, candidate_count, PER_SHEET):
    sheet_number = sheet_start // PER_SHEET + 1
    sheet_end = min(
        sheet_start + PER_SHEET,
        candidate_count,
    )

    canvas = Image.new(
        "RGB",
        (COLUMNS * CELL_W, ROWS * CELL_H),
        "white",
    )

    draw = ImageDraw.Draw(canvas)
    indices = []

    for offset, image_index in enumerate(
        range(sheet_start + 1, sheet_end + 1)
    ):
        row = offset // COLUMNS
        col = offset % COLUMNS

        x = col * CELL_W
        y = row * CELL_H

        source = (
            thumbnail_dir
            / f"{image_index:04d}.jpg"
        )

        with Image.open(source) as image:
            image = image.convert("RGB")
            image.thumbnail(
                (IMAGE_W, IMAGE_H),
                Image.Resampling.LANCZOS,
            )

            image_x = (
                x + (CELL_W - image.width) // 2
            )
            image_y = (
                y + MARGIN
                + (IMAGE_H - image.height) // 2
            )

            canvas.paste(
                image,
                (image_x, image_y),
            )

        label = f"#{image_index:04d}"

        bbox = draw.textbbox(
            (0, 0),
            label,
            font=font,
        )

        label_width = bbox[2] - bbox[0]

        draw.text(
            (
                x + (CELL_W - label_width) // 2,
                y + IMAGE_H + MARGIN + 4,
            ),
            label,
            fill="black",
            font=font,
        )

        indices.append(image_index)

    filename = (
        f"sheet-{sheet_number:02d}.jpg"
    )

    destination = (
        output_dir / filename
    )

    canvas.save(
        destination,
        "JPEG",
        quality=88,
        optimize=True,
    )

    sheets.append({
        "sheet": sheet_number,
        "filename": filename,
        "first": indices[0],
        "last": indices[-1],
        "indices": indices,
    })

print(json.dumps(sheets))
`;

  const {
    spawn,
  } = await import(
    "node:child_process"
  );

  const sheets = await new Promise(
    (resolve, reject) => {
      const child = spawn(
        "python3",
        [
          "-c",
          pythonScript,
          thumbnailDir,
          contactSheetDir,
          String(candidateCount),
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

      child.stdout.on(
        "data",
        (chunk) => {
          stdout += chunk;
        },
      );

      child.stderr.on(
        "data",
        (chunk) => {
          stderr += chunk;
        },
      );

      child.on(
        "error",
        reject,
      );

      child.on(
        "close",
        (code) => {
          if (code !== 0) {
            reject(
              new Error(
                `Contact-sheet generation failed: ${stderr.trim()}`,
              ),
            );
            return;
          }

          try {
            resolve(
              JSON.parse(stdout),
            );
          } catch {
            reject(
              new Error(
                "Could not read contact-sheet catalogue.",
              ),
            );
          }
        },
      );
    },
  );

  await fs.writeFile(
    path.join(
      outputDir,
      "contact-sheets.json",
    ),
    JSON.stringify(
      sheets,
      null,
      2,
    ),
    "utf8",
  );

  return {
    directory: contactSheetDir,
    sheets,
  };
}

function imageToDataUrl(
  buffer,
) {
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
      "OpenAI response did not contain JSON.",
    );
  }

  return JSON.parse(
    trimmed.slice(first, last + 1),
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

async function runPassOne(
  apiKey,
  production,
  contactSheets,
  outputDir,
) {
  const OpenAI =
    (await import("openai")).default;

  const client =
    new OpenAI({ apiKey });

  const passOneCacheTagArg =
    process.argv
      .slice(2)
      .find((arg) =>
        arg.startsWith("--pass-1-cache-tag="),
      );

  const passOneCacheTag =
    passOneCacheTagArg
      ? passOneCacheTagArg
          .slice("--pass-1-cache-tag=".length)
          .trim()
          .replace(/[^a-zA-Z0-9._-]+/g, "-")
      : "";

  const passOneDir =
    path.join(
      outputDir,
      passOneCacheTag
        ? `pass-1-${passOneCacheTag}`
        : "pass-1",
    );

  await fs.mkdir(
    passOneDir,
    { recursive: true },
  );

  const model =
    process.env.OPENAI_ARCHIVE_CURATOR_MODEL ??
    "gpt-5.5";

  const results = [];

  console.log();
  console.log("PASS 1 VISUAL EDIT");

  for (
    let index = 0;
    index < contactSheets.sheets.length;
    index += 1
  ) {
    const sheet =
      contactSheets.sheets[index];

    const resultPath =
      path.join(
        passOneDir,
        `sheet-${String(sheet.sheet).padStart(2, "0")}.json`,
      );

    try {
      const cached =
        JSON.parse(
          await fs.readFile(
            resultPath,
            "utf8",
          ),
        );

      results.push(cached);

      console.log(
        `Sheet ${sheet.sheet}/${contactSheets.sheets.length}: cached (${cached.shortlist.length} shortlisted)`,
      );

      continue;
    } catch {}

    const imagePath =
      path.join(
        contactSheets.directory,
        sheet.filename,
      );

    const buffer =
      await fs.readFile(imagePath);

    const prompt = `
You are making the FIRST-PASS visual edit for the professional theatre-photography archive of Steve Gregson.

Production:
${production}

This contact sheet contains photographs #${String(sheet.first).padStart(4, "0")} through #${String(sheet.last).padStart(4, "0")}.

THIS IS A SHORTLISTING PASS, NOT THE FINAL GALLERY.

Your job is to retain every photograph that deserves serious consideration in the final whole-production edit.

PHOTOGRAPHIC EXCELLENCE IS THE FIRST GATE.

Judge photographs on:
- visual impact
- composition
- timing and decisive moment
- quality and use of theatrical light
- atmosphere
- expression and human connection
- control of scale and space
- clarity of photographic intention
- ability to stand alone as an impressive photograph
- ability to advertise the photographer's skill to a prospective theatre client

Also preserve strong photographs that contribute genuinely different:
- scale
- wide, medium or close framing
- movement or stillness
- ensemble or individual moments
- lighting states
- colour and atmosphere
- technical or creative process
- architectural/stage views
- intimate human moments
- useful visual details

Do NOT keep a mediocre photograph merely because it documents something different.

Do NOT over-prune at this stage.

If two or more photographs are both excellent but similar, retain them for Pass 2 unless one is clearly inferior. Pass 2 will compare candidates across the entire production and remove final redundancy.

Do not try to hit a fixed number. A strong sheet may produce many candidates; a weak sheet may produce few.

The number printed beneath each photograph is its unique identifier.

Return JSON only:

{
  "shortlist": [],
  "strongest": [],
  "heroCandidates": [],
  "notes": ""
}

Rules:
- shortlist = every image worthy of serious final consideration.
- strongest = the exceptional photographs on this sheet.
- heroCandidates = only images strong enough potentially to represent the whole production and Steve Gregson's photography.
- All numbers must come from this contact sheet.
`.trim();

    console.log(
      `Sheet ${sheet.sheet}/${contactSheets.sheets.length}: reviewing...`,
    );

    const response =
      await client.responses.create({
        model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: prompt,
              },
              {
                type: "input_image",
                detail: "high",
                image_url:
                  imageToDataUrl(buffer),
              },
            ],
          },
        ],
      });

    const raw =
      response.output_text?.trim();

    if (!raw) {
      throw new Error(
        `Pass 1 returned no output for sheet ${sheet.sheet}.`,
      );
    }

    const parsed =
      extractJson(raw);

    const result = {
      sheet: sheet.sheet,
      first: sheet.first,
      last: sheet.last,
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
          parsed.heroCandidates,
          sheet.indices,
        ),
      notes:
        typeof parsed.notes === "string"
          ? parsed.notes.trim()
          : "",
      model,
    };

    await fs.writeFile(
      resultPath,
      JSON.stringify(
        result,
        null,
        2,
      ),
      "utf8",
    );

    results.push(result);

    console.log(
      `  shortlisted ${result.shortlist.length}; strongest ${result.strongest.length}; hero candidates ${result.heroCandidates.length}`,
    );
  }

  const shortlist = [
    ...new Set(
      results.flatMap(
        (result) =>
          result.shortlist,
      ),
    ),
  ].sort((a, b) => a - b);

  const strongest = [
    ...new Set(
      results.flatMap(
        (result) =>
          result.strongest,
      ),
    ),
  ].sort((a, b) => a - b);

  const heroCandidates = [
    ...new Set(
      results.flatMap(
        (result) =>
          result.heroCandidates,
      ),
    ),
  ].sort((a, b) => a - b);

  const summary = {
    version: 1,
    production,
    model,
    candidateCount:
      contactSheets.sheets.reduce(
        (total, sheet) =>
          total + sheet.indices.length,
        0,
      ),
    shortlistCount:
      shortlist.length,
    shortlist,
    strongestCount:
      strongest.length,
    strongest,
    heroCandidateCount:
      heroCandidates.length,
    heroCandidates,
    sheets: results,
  };

  await fs.writeFile(
    path.join(
      outputDir,
      passOneCacheTag
        ? `pass-1-${passOneCacheTag}.json`
        : "pass-1.json",
    ),
    JSON.stringify(
      summary,
      null,
      2,
    ),
    "utf8",
  );

  return summary;
}

async function generateFinalistContactSheets(
  thumbnailDir,
  finalistIndices,
  outputDir,
) {
  const finalistDir =
    path.join(
      outputDir,
      "pass-2-contact-sheets",
    );

  await fs.mkdir(
    finalistDir,
    { recursive: true },
  );

  const pythonScript = `
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import json
import sys

thumbnail_dir = Path(sys.argv[1])
output_dir = Path(sys.argv[2])
indices = json.loads(sys.argv[3])

PER_SHEET = 24
COLUMNS = 4
ROWS = 6
CELL_W = 440
CELL_H = 390
IMAGE_W = 420
IMAGE_H = 335
MARGIN = 10

try:
    font = ImageFont.truetype(
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        20,
    )
except Exception:
    font = ImageFont.load_default()

sheets = []

for start in range(0, len(indices), PER_SHEET):
    batch = indices[start:start + PER_SHEET]
    sheet_number = start // PER_SHEET + 1

    canvas = Image.new(
        "RGB",
        (COLUMNS * CELL_W, ROWS * CELL_H),
        "white",
    )

    draw = ImageDraw.Draw(canvas)

    for offset, image_index in enumerate(batch):
        row = offset // COLUMNS
        col = offset % COLUMNS

        x = col * CELL_W
        y = row * CELL_H

        source = (
            thumbnail_dir
            / f"{image_index:04d}.jpg"
        )

        with Image.open(source) as image:
            image = image.convert("RGB")
            image.thumbnail(
                (IMAGE_W, IMAGE_H),
                Image.Resampling.LANCZOS,
            )

            image_x = (
                x + (CELL_W - image.width) // 2
            )

            image_y = (
                y + MARGIN
                + (IMAGE_H - image.height) // 2
            )

            canvas.paste(
                image,
                (image_x, image_y),
            )

        label = f"#{image_index:04d}"

        bbox = draw.textbbox(
            (0, 0),
            label,
            font=font,
        )

        width = bbox[2] - bbox[0]

        draw.text(
            (
                x + (CELL_W - width) // 2,
                y + IMAGE_H + MARGIN + 6,
            ),
            label,
            fill="black",
            font=font,
        )

    filename = (
        f"finalists-{sheet_number:02d}.jpg"
    )

    destination = (
        output_dir / filename
    )

    canvas.save(
        destination,
        "JPEG",
        quality=90,
        optimize=True,
    )

    sheets.append({
        "sheet": sheet_number,
        "filename": filename,
        "indices": batch,
    })

print(json.dumps(sheets))
`;

  const {
    spawn,
  } = await import(
    "node:child_process"
  );

  const sheets = await new Promise(
    (resolve, reject) => {
      const child = spawn(
        "python3",
        [
          "-c",
          pythonScript,
          thumbnailDir,
          finalistDir,
          JSON.stringify(
            finalistIndices,
          ),
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

      child.stdout.on(
        "data",
        (chunk) => {
          stdout += chunk;
        },
      );

      child.stderr.on(
        "data",
        (chunk) => {
          stderr += chunk;
        },
      );

      child.on(
        "error",
        reject,
      );

      child.on(
        "close",
        (code) => {
          if (code !== 0) {
            reject(
              new Error(
                `Finalist contact-sheet generation failed: ${stderr.trim()}`,
              ),
            );
            return;
          }

          try {
            resolve(
              JSON.parse(stdout),
            );
          } catch {
            reject(
              new Error(
                "Could not read finalist contact-sheet catalogue.",
              ),
            );
          }
        },
      );
    },
  );

  await fs.writeFile(
    path.join(
      outputDir,
      "pass-2-contact-sheets.json",
    ),
    JSON.stringify(
      sheets,
      null,
      2,
    ),
    "utf8",
  );

  return {
    directory: finalistDir,
    sheets,
  };
}

async function runPassTwo(
  apiKey,
  production,
  passOne,
  thumbnailDir,
  outputDir,
) {
  const passTwoCacheTagArg =
    process.argv
      .slice(2)
      .find((arg) =>
        arg.startsWith("--pass-2-cache-tag="),
      );

  const passTwoCacheTag =
    passTwoCacheTagArg
      ? passTwoCacheTagArg
          .slice("--pass-2-cache-tag=".length)
          .trim()
          .replace(/[^a-zA-Z0-9._-]+/g, "-")
      : "";

  const cachedOutputPath =
    path.join(
      outputDir,
      passTwoCacheTag
        ? `pass-2-${passTwoCacheTag}.json`
        : "pass-2.json",
    );

  const forceRerun =
    process.argv.includes(
      "--rerun-pass-2",
    );

  if (!forceRerun) {
    try {
      const cached =
        JSON.parse(
          await fs.readFile(
            cachedOutputPath,
            "utf8",
          ),
        );

      if (
        Array.isArray(cached.selected) &&
        Array.isArray(cached.sequence) &&
        cached.selected.length > 0
      ) {
        console.log();
        console.log(
          "PASS 2 FINAL EDIT",
        );
        console.log(
          `Using cached final edit (${cached.selected.length} selected; hero #${String(
            cached.hero,
          ).padStart(4, "0")}).`,
        );

        return {
          ...cached,
          outputPath:
            cachedOutputPath,
          contactSheets: null,
        };
      }
    } catch {}
  }

  const finalistIndices = [
    ...new Set([
      ...passOne.strongest,
      ...passOne.heroCandidates,
    ]),
  ].sort((a, b) => a - b);

  if (!finalistIndices.length) {
    throw new Error(
      "Pass 1 produced no finalists.",
    );
  }

  const contactSheets =
    await generateFinalistContactSheets(
      thumbnailDir,
      finalistIndices,
      outputDir,
    );

  console.log();
  console.log(
    "PASS 2 FINALISTS",
  );
  console.log(
    "Finalists:",
    finalistIndices.length,
  );
  console.log(
    "Sheets:",
    contactSheets.sheets.length,
  );

  const OpenAI =
    (await import("openai")).default;

  const client =
    new OpenAI({ apiKey });

  const model =
    process.env.OPENAI_ARCHIVE_CURATOR_MODEL ??
    "gpt-5.5";

  const content = [
    {
      type: "input_text",
      text: `
You are making the FINAL whole-production edit for the professional theatre-photography archive of Steve Gregson.

Production:
${production}

You are seeing only the strongest finalists retained after a first visual edit.

This Archive has two purposes:
1. preserve a meaningful photographic record of the production;
2. ABOVE ALL, demonstrate why a client should hire Steve Gregson.

PHOTOGRAPHIC EXCELLENCE IS THE FIRST GATE.

Every photograph in the final gallery must earn its place as photography.

Judge on:
- visual impact
- composition
- timing and decisive moment
- theatrical light
- atmosphere
- expression and human connection
- control of scale and space
- clarity of photographic intention
- memorability
- ability to stand alone as an impressive photograph
- ability to advertise Steve Gregson's photographic skill

Then build breadth FROM the strongest photographs.

GALLERY SIZE

- Absolute minimum target: 20 when the source genuinely supports 20 Archive-worthy photographs.
- Normal production: normally 20-40.
- Large or visually varied production: normally 40-50.
- Exceptional productions: no quota and no artificial maximum.
- These are editorial ranges, not targets to fill.
- Never add a weaker image merely to reach a number.
- Never remove an exceptional image merely because a nominal range has already been reached.

THE FINAL GALLERY SHOULD SHOW, WHERE THE MATERIAL SUPPORTS IT:

- scale
- architectural/stage wides
- medium storytelling compositions
- close and intimate frames
- ensembles
- individuals
- movement
- stillness
- theatrical lighting
- colour
- shadow
- haze, beams and atmosphere
- human connection
- technical/creative process when photographically strong
- details when photographically strong
- different visual rhythms and intensities

DUPLICATION

Be ruthless with TRUE repetition.

When several photographs communicate substantially the same idea, retain the strongest composition, moment and visual impact.

Do not confuse useful photographic variation with duplication.

Two images can show the same performer, same lighting state or same scene and still both deserve inclusion if they offer meaningfully different:
- scale
- composition
- expression
- gesture
- atmosphere
- relationship
- perspective
- photographic impact

HERO

The hero is NOT necessarily the image that best explains the production.

Choose the hero as the single strongest advertisement for Steve Gregson as a photographer.

It should be the image most likely to:
- stop a prospective theatre client;
- demonstrate exceptional photographic ability;
- feel authored rather than merely recorded;
- be memorable;
- make someone want to open the gallery.

SEQUENCE

Sequence as a photographic portfolio, not a chronological technical report.

Create rhythm through changes of:
- scale
- intimacy
- colour
- intensity
- people
- space
- stillness
- movement

Avoid long repetitive runs.

CLASSIFICATION

Choose one:
- small
- normal
- large
- exceptional

This classification should describe the amount and breadth of genuinely strong photographic material, not merely the raw number of source files.

The number printed beneath each image is its unique identifier.

Return JSON only:

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

Requirements:
- selected contains ONLY finalist image numbers shown in these sheets.
- hero MUST also be in selected.
- sequence should contain every selected image exactly once.
- rangeCovered should only reference selected images.
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
      type: "input_text",
      text:
        `Finalist contact sheet ${sheet.sheet}: ` +
        sheet.indices
          .map(
            (value) =>
              `#${String(value).padStart(4, "0")}`,
          )
          .join(", "),
    });

    content.push({
      type: "input_image",
      detail: "high",
      image_url:
        imageToDataUrl(buffer),
    });
  }

  console.log();
  console.log(
    "PASS 2 FINAL EDIT",
  );
  console.log(
    "Reviewing whole production...",
  );

  const response =
    await client.responses.create({
      model,
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
      "Pass 2 returned no output.",
    );
  }

  const parsed =
    extractJson(raw);

  const selected =
    normaliseIndices(
      parsed.selected,
      finalistIndices,
    );

  const parsedHero =
    Number(parsed.hero);

  const hero =
    finalistIndices.includes(
      parsedHero,
    )
      ? parsedHero
      : selected[0] ?? null;

  if (
    hero !== null &&
    !selected.includes(hero)
  ) {
    selected.unshift(hero);
  }

  const sequence =
    normaliseIndices(
      parsed.sequence,
      selected,
    );

  for (const value of selected) {
    if (!sequence.includes(value)) {
      sequence.push(value);
    }
  }

  const allowedClassifications =
    new Set([
      "small",
      "normal",
      "large",
      "exceptional",
    ]);

  const classification =
    allowedClassifications.has(
      parsed.classification,
    )
      ? parsed.classification
      : "normal";

  const rangeKeys = [
    "scale",
    "wide",
    "medium",
    "close",
    "lighting",
    "technicalProcess",
    "humanMoments",
    "details",
  ];

  const rangeCovered = {};

  for (const key of rangeKeys) {
    rangeCovered[key] =
      normaliseIndices(
        parsed.rangeCovered?.[key],
        selected,
      );
  }

  const result = {
    version: 1,
    production,
    model,
    finalistCount:
      finalistIndices.length,
    finalists:
      finalistIndices,
    classification,
    hero,
    selectedCount:
      selected.length,
    selected,
    sequence,
    heroReason:
      typeof parsed.heroReason === "string"
        ? parsed.heroReason.trim()
        : "",
    editorialSummary:
      typeof parsed.editorialSummary === "string"
        ? parsed.editorialSummary.trim()
        : "",
    rangeCovered,
  };

  const outputPath =
    cachedOutputPath;

  await fs.writeFile(
    outputPath,
    JSON.stringify(
      result,
      null,
      2,
    ),
    "utf8",
  );

  return {
    ...result,
    outputPath,
    contactSheets,
  };
}

async function downloadDropboxFile(
  token,
  dropboxPath,
) {
  const response = await fetch(
    "https://content.dropboxapi.com/2/files/download",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg":
          JSON.stringify({
            path: dropboxPath,
          }),
      },
    },
  );

  if (!response.ok) {
    const message =
      await response.text();

    throw new Error(
      `Dropbox download failed (${response.status}): ${message.slice(0, 400)}`,
    );
  }

  return Buffer.from(
    await response.arrayBuffer(),
  );
}

function deriveDropboxProductionDate(
  candidates,
) {
  const counts = new Map();

  for (const candidate of candidates) {
    if (!candidate.modified) {
      continue;
    }

    const date =
      new Date(candidate.modified);

    if (
      Number.isNaN(date.getTime())
    ) {
      continue;
    }

    const key =
      `${date.getUTCFullYear()}-${String(
        date.getUTCMonth() + 1,
      ).padStart(2, "0")}`;

    counts.set(
      key,
      (counts.get(key) ?? 0) + 1,
    );
  }

  const ranked =
    [...counts.entries()].sort(
      (a, b) =>
        b[1] - a[1] ||
        a[0].localeCompare(b[0]),
    );

  if (!ranked.length) {
    return {
      year: null,
      month: null,
      evidence: [],
    };
  }

  const [best] = ranked;
  const [year, month] =
    best[0]
      .split("-")
      .map(Number);

  return {
    year,
    month,
    evidence:
      ranked.map(
        ([value, count]) => ({
          value,
          count,
        }),
      ),
  };
}

async function stageFinalSelection(
  token,
  production,
  candidates,
  passTwo,
  outputDir,
) {
  const byIndex =
    new Map(
      candidates.map(
        (candidate, index) => [
          index + 1,
          candidate,
        ],
      ),
    );

  const stagingDir =
    path.join(
      outputDir,
      "selected-web-staging",
    );

  await fs.mkdir(
    stagingDir,
    { recursive: true },
  );

  const dateEvidence =
    deriveDropboxProductionDate(
      candidates,
    );

  const selected = [];

  console.log();
  console.log(
    "STAGING FINAL WEB SELECTION",
  );

  for (
    let position = 0;
    position < passTwo.sequence.length;
    position += 1
  ) {
    const imageIndex =
      passTwo.sequence[position];

    const candidate =
      byIndex.get(imageIndex);

    if (!candidate) {
      throw new Error(
        `Selected image #${imageIndex} is missing from discovery.`,
      );
    }

    const extension =
      path.extname(candidate.name) ||
      ".jpg";

    const destinationName =
      `${String(position + 1).padStart(3, "0")}__${String(
        imageIndex,
      ).padStart(4, "0")}__${safeName(
        path.basename(
          candidate.name,
          extension,
        ),
      )}${extension.toLowerCase()}`;

    const destination =
      path.join(
        stagingDir,
        destinationName,
      );

    let cached = true;

    try {
      const stats =
        await fs.stat(destination);

      if (!stats.size) {
        throw new Error(
          "Empty cached file.",
        );
      }
    } catch {
      cached = false;

      const buffer =
        await downloadDropboxFile(
          token,
          candidate.path,
        );

      await fs.writeFile(
        destination,
        buffer,
      );
    }

    selected.push({
      sequence:
        position + 1,
      index:
        imageIndex,
      hero:
        imageIndex ===
        passTwo.hero,
      sourceName:
        candidate.name,
      sourcePath:
        candidate.path,
      sourceFolder:
        candidate.sourceFolder,
      modified:
        candidate.modified,
      stagedFile:
        destinationName,
      cached,
    });

    if (
      (position + 1) % 10 === 0 ||
      position + 1 ===
        passTwo.sequence.length
    ) {
      console.log(
        `${position + 1}/${passTwo.sequence.length}`,
      );
    }
  }

  const manifest = {
    version: 1,
    production,
    generatedAt:
      new Date().toISOString(),
    classification:
      passTwo.classification,
    hero:
      passTwo.hero,
    selectedCount:
      selected.length,
    dropboxDate:
      dateEvidence,
    heroReason:
      passTwo.heroReason,
    editorialSummary:
      passTwo.editorialSummary,
    images:
      selected,
  };

  const manifestPath =
    path.join(
      outputDir,
      "final-selection.json",
    );

  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      manifest,
      null,
      2,
    ),
    "utf8",
  );

  return {
    stagingDir,
    manifestPath,
    manifest,
  };
}

async function main() {
  const productionArg =
    process.argv
      .slice(2)
      .find((arg) =>
        arg.startsWith("--production="),
      );

  if (!productionArg) {
    throw new Error(
      'Use --production="Production folder name"',
    );
  }

  const requestedProduction =
    productionArg
      .slice("--production=".length)
      .trim();

  const envText =
    await fs.readFile(ENV_PATH, "utf8");

  const token =
    await getDropboxAccessToken(
      envText,
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

  const productionNames = [
    ...new Set(
      items
        .map(getProductionName)
        .filter(Boolean),
    ),
  ];

  const requestedNormalised =
    normaliseProductionName(
      requestedProduction,
    );

  const exact =
    productionNames.find(
      (name) =>
        normaliseProductionName(name) ===
        requestedNormalised,
    );

  const partial =
    productionNames.filter((name) =>
      normaliseProductionName(name)
        .includes(requestedNormalised),
    );

  const production =
    exact ??
    (partial.length === 1
      ? partial[0]
      : null);

  if (!production) {
    console.log(
      "Matching productions:",
      partial.length,
    );

    for (const name of partial.slice(0, 20)) {
      console.log(`- ${name}`);
    }

    throw new Error(
      "Production could not be resolved uniquely.",
    );
  }

  const productionItems =
    items.filter(
      (item) =>
        getProductionName(item) ===
        production,
    );

  const sourceFiles =
    productionItems
      .map(getDropboxPath)
      .filter(Boolean)
      .map(normaliseDropboxPath);

  if (!sourceFiles.length) {
    throw new Error(
      "No Dropbox source paths found for production.",
    );
  }

  const sourceFolders = [
    ...new Set(
      sourceFiles
        .map(parentDropboxPath)
        .filter(Boolean),
    ),
  ];

  console.log();
  console.log("PRODUCTION");
  console.log(production);
  console.log();
  console.log(
    "Claude selections:",
    sourceFiles.length,
  );
  console.log(
    "Mapped source folders:",
    sourceFolders.length,
  );

  const candidates = [];

  for (const folder of sourceFolders) {
    console.log();
    console.log(
      `Listing Dropbox: ${folder}`,
    );

    const entries =
      await listDropboxFolder(
        token,
        folder,
      );

    const images =
      entries.filter((entry) => {
        if (entry[".tag"] !== "file") {
          return false;
        }

        return /\.(?:jpe?g|png|webp|tiff?)$/i.test(
          entry.name,
        );
      });

    console.log(
      `Images found: ${images.length}`,
    );

    for (const entry of images) {
      candidates.push({
        name: entry.name,
        path:
          entry.path_display ??
          entry.path_lower,
        sourceFolder: folder,
        modified:
          entry.client_modified ??
          entry.server_modified ??
          null,
        size:
          typeof entry.size === "number"
            ? entry.size
            : null,
      });
    }
  }

  const uniqueCandidates = [
    ...new Map(
      candidates.map((item) => [
        item.path.toLowerCase(),
        item,
      ]),
    ).values(),
  ];

  uniqueCandidates.sort((a, b) =>
    a.path.localeCompare(
      b.path,
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    ),
  );

  const outputDir = path.join(
    WORK_ROOT,
    safeName(production),
  );

  await fs.mkdir(
    outputDir,
    {
      recursive: true,
    },
  );

  const discovery = {
    version: 1,
    production,
    generatedAt:
      new Date().toISOString(),
    claudeSelections:
      sourceFiles,
    sourceFolders,
    candidateCount:
      uniqueCandidates.length,
    candidates:
      uniqueCandidates.map(
        (item, index) => ({
          index: index + 1,
          ...item,
        }),
      ),
  };

  const outputPath = path.join(
    outputDir,
    "discovery.json",
  );

  await fs.writeFile(
    outputPath,
    JSON.stringify(
      discovery,
      null,
      2,
    ),
    "utf8",
  );

  console.log();
  console.log("DISCOVERY COMPLETE");
  console.log(
    "Candidates:",
    uniqueCandidates.length,
  );
  console.log(
    "Output:",
    outputPath,
  );

  const shouldPrepare =
    process.argv.includes("--prepare");

  if (shouldPrepare) {
    const thumbnailDir =
      await ensureThumbnails(
        token,
        uniqueCandidates,
        outputDir,
      );

    console.log();
    console.log(
      "THUMBNAIL CACHE COMPLETE",
    );
    console.log(
      "Thumbnails:",
      uniqueCandidates.length,
    );
    console.log(
      "Directory:",
      thumbnailDir,
    );

    const contactSheets =
      await generateContactSheets(
        thumbnailDir,
        uniqueCandidates.length,
        outputDir,
      );

    console.log();
    console.log(
      "CONTACT SHEETS COMPLETE",
    );
    console.log(
      "Sheets:",
      contactSheets.sheets.length,
    );
    console.log(
      "Directory:",
      contactSheets.directory,
    );

    for (
      const sheet
      of contactSheets.sheets
    ) {
      console.log(
        `${sheet.filename}: #${String(sheet.first).padStart(4, "0")} - #${String(sheet.last).padStart(4, "0")}`,
      );
    }

    const shouldCurate =
      process.argv.includes("--curate");

    if (shouldCurate) {
      const openaiKey =
        readEnvValue(
          envText,
          "OPENAI_API_KEY",
        );

      if (!openaiKey) {
        throw new Error(
          "OPENAI_API_KEY is missing from .env.local",
        );
      }

      const passOne =
        await runPassOne(
          openaiKey,
          production,
          contactSheets,
          outputDir,
        );

      console.log();
      console.log(
        "PASS 1 COMPLETE",
      );
      console.log(
        "Original candidates:",
        passOne.candidateCount,
      );
      console.log(
        "Shortlisted:",
        passOne.shortlistCount,
      );
      console.log(
        "Strongest:",
        passOne.strongestCount,
      );
      console.log(
        "Hero candidates:",
        passOne.heroCandidateCount,
      );
      console.log(
        "Output:",
        path.join(
          outputDir,
          "pass-1.json",
        ),
      );

      const passTwo =
        await runPassTwo(
          openaiKey,
          production,
          passOne,
          thumbnailDir,
          outputDir,
        );

      console.log();
      console.log(
        "PASS 2 COMPLETE",
      );
      console.log(
        "Classification:",
        passTwo.classification,
      );
      console.log(
        "Finalists:",
        passTwo.finalistCount,
      );
      console.log(
        "Selected:",
        passTwo.selectedCount,
      );
      console.log(
        "Hero:",
        passTwo.hero,
      );
      console.log(
        "Output:",
        passTwo.outputPath,
      );

      const shouldStage =
        process.argv.includes("--stage");

      if (shouldStage) {
        const staged =
          await stageFinalSelection(
            token,
            production,
            uniqueCandidates,
            passTwo,
            outputDir,
          );

        console.log();
        console.log(
          "FINAL SELECTION STAGED",
        );
        console.log(
          "Selected:",
          staged.manifest.selectedCount,
        );
        console.log(
          "Dropbox date:",
          staged.manifest.dropboxDate.year &&
          staged.manifest.dropboxDate.month
            ? `${staged.manifest.dropboxDate.year}-${String(
                staged.manifest.dropboxDate.month,
              ).padStart(2, "0")}`
            : "Unavailable",
        );
        console.log(
          "Manifest:",
          staged.manifestPath,
        );
        console.log(
          "Files:",
          staged.stagingDir,
        );
      }
    }
  } else {
    console.log();
    console.log(
      "No images were downloaded.",
    );
  }

  console.log(
    "Dropbox was read only.",
  );
}

main().catch((error) => {
  console.error();
  console.error(
    "CURATOR ERROR:",
    error.message,
  );
  process.exitCode = 1;
});
