import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_PUBLISHING_SETTINGS,
  isPublishingSettings,
  type PublishingSettings,
} from "../../../../lib/publishing-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSettingsFile() {
  return path.join(
    process.cwd(),
    "content",
    "settings",
    "publishing.json",
  );
}

async function readSettings(): Promise<PublishingSettings> {
  try {
    const source = await readFile(getSettingsFile(), "utf8");
    const parsed = JSON.parse(source) as unknown;

    return isPublishingSettings(parsed)
      ? parsed
      : DEFAULT_PUBLISHING_SETTINGS;
  } catch {
    return DEFAULT_PUBLISHING_SETTINGS;
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    settings: await readSettings(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;

    if (!isPublishingSettings(body)) {
      return Response.json(
        {
          ok: false,
          message: "The publishing settings are invalid.",
        },
        { status: 400 },
      );
    }

    await writeFile(
      getSettingsFile(),
      `${JSON.stringify(body, null, 2)}\n`,
      "utf8",
    );

    return Response.json({
      ok: true,
      message: "Publishing settings saved.",
      settings: body,
    });
  } catch (error) {
    console.error("Publishing settings update failed:", error);

    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Publishing settings could not be saved.",
      },
      { status: 500 },
    );
  }
}
