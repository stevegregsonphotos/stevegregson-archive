import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import {
  isPublishingSettings,
} from "../../../../lib/publishing-settings";

import {
  getPublishingSettings,
  savePublishingSettings,
} from "../../../../lib/publishing-settings-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  return Response.json({
    ok: true,
    settings: await getPublishingSettings(),
  });
}

export async function POST(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

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

    const settings =
      await savePublishingSettings(body);

    return Response.json({
      ok: true,
      message: "Publishing settings saved.",
      settings,
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
