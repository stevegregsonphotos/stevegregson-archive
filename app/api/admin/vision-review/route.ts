import OpenAI from "openai";

import { openai } from "@/lib/vision/client";
import { VISION_SYSTEM_PROMPT } from "@/lib/vision/prompt";
import type {
  VisionReviewRequest,
  VisionReviewResponse,
} from "@/lib/vision/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createPrompt(
  request: VisionReviewRequest,
) {
  return JSON.stringify(
    {
      production: request.production,

      images: request.images.map((image) => ({
        filename: image.filename,
        heroScore: image.heroScore,
        technicalScore: image.technicalScore,
        orientation: image.orientation,
        width: image.width,
        height: image.height,
      })),
    },
    null,
    2,
  );
}

export async function POST(req: Request) {
  try {
    const body =
      (await req.json()) as VisionReviewRequest;

    if (!body.images.length) {
      return Response.json(
        {
          ok: false,
          message: "No images supplied.",
        },
        {
          status: 400,
        },
      );
    }

    const prompt = createPrompt(body);
        const response = await openai.responses.create({
      model:
        process.env.OPENAI_VISION_MODEL ?? "gpt-5",

      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: VISION_SYSTEM_PROMPT,
            },
          ],
        },
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

    const output = response.output_text?.trim();

    if (!output) {
      return Response.json(
        {
          ok: false,
          message: "Vision AI returned no output.",
        },
        {
          status: 500,
        },
      );
    }

    let review: VisionReviewResponse;

    try {
      review = JSON.parse(
        output,
      ) as VisionReviewResponse;
    } catch {
      return Response.json(
        {
          ok: false,
          message:
            "Vision AI returned invalid JSON.",
          raw: output,
        },
        {
          status: 500,
        },
      );
    }

    return Response.json({
      ok: true,
      review,
    });
  } catch (error) {
    console.error(error);

    if (error instanceof OpenAI.APIError) {
      return Response.json(
        {
          ok: false,
          message: error.message,
        },
        {
          status: error.status ?? 500,
        },
      );
    }

    return Response.json(
      {
        ok: false,
        message: "Vision review failed.",
      },
      {
        status: 500,
      },
    );
  }
}