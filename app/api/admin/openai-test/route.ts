import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model =
    process.env.OPENAI_VISION_MODEL?.trim() || "gpt-5";
  const enabled =
    process.env.BACKSTAGE_VISION_ENABLED === "true";

  if (!enabled) {
    return Response.json(
      {
        ok: false,
        message:
          "Vision AI is disabled in .env.local.",
      },
      { status: 400 },
    );
  }

  if (!apiKey) {
    return Response.json(
      {
        ok: false,
        message:
          "OPENAI_API_KEY is not configured.",
      },
      { status: 400 },
    );
  }

  try {
    const client = new OpenAI({ apiKey });

    const response = await client.responses.create({
      model,
      input:
        "Reply with exactly: Backstage Vision AI connected.",
      max_output_tokens: 30,
    });

    return Response.json({
      ok: true,
      message:
        response.output_text.trim() ||
        "Backstage Vision AI connected.",
      model,
    });
  } catch (error) {
    console.error("OpenAI connection test failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "The OpenAI connection test failed.";

    return Response.json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}