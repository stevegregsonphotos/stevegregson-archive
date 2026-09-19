import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  prepareCuratedProduction,
} from "@/lib/curated-archive/prepare-production";
import {
  publishCuratedProduction,
} from "@/lib/curated-archive/publish-production";

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rejectProductionRuntime() {
  if (process.env.VERCEL === "1") {
    return Response.json(
      {
        ok: false,
        message:
          "Local curated batch publishing is disabled on Vercel.",
      },
      { status: 404 },
    );
  }

  return null;
}

type RootSpec = {
  label: string;
  root: string;
};

type ReadyItem = {
  label: string;
  root: string;
  folder: string;
  production: string;
};

const ROOTS: RootSpec[] = [
  {
    label: "Dropbox",
    root: path.join(
      os.homedir(),
      "Downloads",
      "Archive Download",
      "Automated Curation",
    ),
  },
  {
    label: "Google Drive",
    root: path.join(
      os.homedir(),
      "Downloads",
      "Archive Download",
      "Automated Curation - Google Drive",
    ),
  },
];

async function scanRoot(spec: RootSpec) {
  const summary = {
    label: spec.label,
    ready: 0,
    existing: 0,
    excluded: 0,
    attention: 0,
    withoutFinal: 0,
  };

  const ready: ReadyItem[] = [];
  const attention: Array<{
    production: string;
    issues: string[];
  }> = [];

  let entries: Array<import("node:fs").Dirent>;

  try {
    entries = await fs.readdir(
      spec.root,
      { withFileTypes: true },
    );
  } catch {
    return {
      summary,
      ready,
      attention: [
        {
          production: spec.label,
          issues: [
            `Curation root not found: ${spec.root}`,
          ],
        },
      ],
    };
  }

  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  for (const folder of folders) {
    const finalSelectionPath = path.join(
      spec.root,
      folder,
      "final-selection.json",
    );

    try {
      await fs.access(finalSelectionPath);
    } catch {
      summary.withoutFinal += 1;
      continue;
    }

    const prepared =
      await prepareCuratedProduction(
        folder,
        spec.root,
      );

    if (!prepared) {
      summary.attention += 1;
      attention.push({
        production: folder,
        issues: ["Could not prepare production."],
      });
      continue;
    }

    if (prepared.status === "ready") {
      summary.ready += 1;
      ready.push({
        label: spec.label,
        root: spec.root,
        folder,
        production:
          prepared.payload?.title ??
          prepared.production,
      });
      continue;
    }

    if (prepared.status === "existing") {
      summary.existing += 1;
      continue;
    }

    if (prepared.status === "excluded") {
      summary.excluded += 1;
      continue;
    }

    summary.attention += 1;
    attention.push({
      production: prepared.production,
      issues: prepared.issues,
    });
  }

  return {
    summary,
    ready,
    attention,
  };
}

async function scanAll() {
  const scanned = [];

  for (const spec of ROOTS) {
    scanned.push(await scanRoot(spec));
  }

  return scanned;
}

function escapeHtml(value: unknown) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function GET(request: Request) {
  const productionBlock = rejectProductionRuntime();
  if (productionBlock) {
    return productionBlock;
  }
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  const scanned = await scanAll();
  const ready = scanned.flatMap((item) => item.ready);
  const attention = scanned.flatMap((item) => item.attention);

  const summaryRows = scanned
    .map(({ summary }) => `
      <tr>
        <td>${escapeHtml(summary.label)}</td>
        <td>${summary.ready}</td>
        <td>${summary.existing}</td>
        <td>${summary.excluded}</td>
        <td>${summary.attention}</td>
        <td>${summary.withoutFinal}</td>
      </tr>
    `)
    .join("");

  const readyRows = ready
    .map(
      (item) =>
        `<li>${escapeHtml(item.label)} - ${escapeHtml(item.production)}</li>`,
    )
    .join("");

  const attentionRows = attention
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.production)}</strong> - ${escapeHtml(item.issues.join(" "))}</li>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Local curated batch publisher</title>
<style>
body { font-family: system-ui, sans-serif; max-width: 1100px; margin: 40px auto; padding: 0 24px; }
table { border-collapse: collapse; width: 100%; margin: 20px 0; }
th, td { border-bottom: 1px solid #ddd; text-align: left; padding: 8px; }
button { font: inherit; padding: 12px 18px; cursor: pointer; }
.warn { background: #fff4d6; padding: 14px; }
code { background: #f4f4f4; padding: 2px 5px; }
</style>
</head>
<body>
<h1>Local curated batch publisher</h1>
<p>This page reads the completed local curation packages and publishes only productions currently reported as <code>ready</code>. Existing, excluded and attention items are not published.</p>
<table>
<thead><tr><th>Source</th><th>Ready</th><th>Existing</th><th>Excluded</th><th>Attention</th><th>Without final</th></tr></thead>
<tbody>${summaryRows}</tbody>
</table>
<p><strong>Total ready to publish: ${ready.length}</strong></p>
${ready.length ? `<details><summary>Show ready productions</summary><ol>${readyRows}</ol></details>` : ""}
${attention.length ? `<details><summary>Show attention items (${attention.length})</summary><ul>${attentionRows}</ul></details>` : ""}
${ready.length ? `
<div class="warn">
<strong>This next button performs real writes to the R2/Neon environment configured in this local app.</strong>
</div>
<form method="post">
  <input type="hidden" name="confirm" value="PUBLISH_READY">
  <p><button type="submit">Publish all ${ready.length} ready productions</button></p>
</form>` : "<p>Nothing is currently ready to publish.</p>"}
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const productionBlock = rejectProductionRuntime();
  if (productionBlock) {
    return productionBlock;
  }
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  const form = await request.formData();
  const confirm = String(form.get("confirm") ?? "");

  if (confirm !== "PUBLISH_READY") {
    return Response.json(
      {
        ok: false,
        message: "Explicit publish confirmation was missing.",
      },
      { status: 400 },
    );
  }

  const scanned = await scanAll();
  const ready = scanned.flatMap((item) => item.ready);

  const results: Array<{
    source: string;
    production: string;
    status: "published" | "failed";
    message?: string;
  }> = [];

  for (let index = 0; index < ready.length; index += 1) {
    const item = ready[index];

    console.log(
      `[curated-batch ${index + 1}/${ready.length}] ${item.label} - ${item.production}`,
    );

    try {
      await publishCuratedProduction(
        item.folder,
        item.root,
      );

      results.push({
        source: item.label,
        production: item.production,
        status: "published",
      });

      console.log(
        `  OK ${item.production}`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      results.push({
        source: item.label,
        production: item.production,
        status: "failed",
        message,
      });

      console.error(
        `  FAILED ${item.production}: ${message}`,
      );
    }
  }

  const published = results.filter(
    (item) => item.status === "published",
  ).length;

  const failed = results.length - published;

  return Response.json(
    {
      ok: failed === 0,
      attempted: results.length,
      published,
      failed,
      results,
    },
    {
      status: failed === 0 ? 200 : 207,
    },
  );
}
