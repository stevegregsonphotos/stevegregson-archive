import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { openai } from "@/lib/vision/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_LAYOUTS = [
  "wide",
  "left",
  "right",
  "medium",
  "full",
  "left-small",
  "right-small",
  "wide-left",
  "wide-right",
] as const;

type GalleryLayout = (typeof ALLOWED_LAYOUTS)[number];

type ProductionCredit = {
  role: string;
  name: string;
  website?: string;
};

type ProductionImage = {
  src: string;
  alt: string;
  layout: GalleryLayout;
};

type ProductionData = {
  slug: string;
  title: string;
  venue: string;
  year: number;
  description: string;
  hero: string;
  heroAlt: string;
  credits: ProductionCredit[];
  images: ProductionImage[];
};

type AnalyseImageRequest = {
  slug?: unknown;
  image?: unknown;
};

type VisionMetadata = {
  alt: string;
  filename: string;
  layout: GalleryLayout;
};

const MAX_SOURCE_SIZE = 50 * 1024 * 1024;

function isSafeSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isSafeFilename(value: string) {
  return (
    Boolean(value) &&
    value === path.basename(value) &&
    !value.includes("\0") &&
    value !== "." &&
    value !== ".."
  );
}

function readProductionFromSource(source: string) {
  const objectMatch = source.match(
    /=\s*({[\s\S]*})\s*;\s*$/,
  );

  if (!objectMatch) {
    throw new Error(
      "The production data could not be read.",
    );
  }

  return JSON.parse(objectMatch[1]) as ProductionData;
}

function normaliseFilename(
  suggestedFilename: string,
  originalFilename: string,
) {
  const originalExtension =
    path.extname(originalFilename).toLowerCase() || ".jpg";

  const suggestedBase = path
    .basename(suggestedFilename, path.extname(suggestedFilename))
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return `${suggestedBase || "theatre-production-image"}${originalExtension}`;
}

function validateMetadata(
  value: unknown,
  originalFilename: string,
): VisionMetadata {
  if (typeof value !== "object" || value === null) {
    throw new Error(
      "Vision AI returned invalid metadata.",
    );
  }

  const metadata = value as Record<string, unknown>;

  if (
    typeof metadata.alt !== "string" ||
    !metadata.alt.trim() ||
    typeof metadata.filename !== "string" ||
    !metadata.filename.trim() ||
    typeof metadata.layout !== "string" ||
    !ALLOWED_LAYOUTS.includes(
      metadata.layout as GalleryLayout,
    )
  ) {
    throw new Error(
      "Vision AI returned incomplete metadata.",
    );
  }

  return {
    alt: metadata.alt.trim().slice(0, 240),
    filename: normaliseFilename(
      metadata.filename,
      originalFilename,
    ),
    layout: metadata.layout as GalleryLayout,
  };
}

function buildPrompt(
  production: ProductionData,
  image: ProductionImage | null,
  filename: string,
) {
  return [
    "Create metadata for one image on a professional theatre photographer's website.",
    "",
    "Production context:",
    JSON.stringify(
      {
        title: production.title,
        venue: production.venue,
        year: production.year,
        description: production.description,
        credits: production.credits.map((credit) => ({
          role: credit.role,
          name: credit.name,
        })),
        currentFilename: filename,
        currentAltText: image?.alt ?? "",
        currentLayout: image?.layout ?? "wide",
      },
      null,
      2,
    ),
    "",
    "Requirements:",
    "- Write concise, factual alt text, ideally under 140 characters.",
    "- Do not begin with 'image of', 'photo of', or 'photograph of'.",
    "- Describe the visible performance, staging, action, composition, lighting, and mood only when useful.",
    "- Do not identify a performer, character, or person unless that identity is unambiguously supported by the supplied production context.",
    "- Suggest a lowercase, hyphen-separated, SEO-friendly filename without a path.",
    "- Do not include the photographer's name in every filename or alt text.",
    "- Choose the strongest layout for the composition from the allowed values.",
    `- Allowed layouts: ${ALLOWED_LAYOUTS.join(", ")}.`,
    "- Return only the structured metadata requested by the response schema.",
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as AnalyseImageRequest;

    if (
      typeof body.slug !== "string" ||
      !isSafeSlug(body.slug) ||
      typeof body.image !== "string" ||
      !isSafeFilename(body.image)
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "A valid production slug and image filename are required.",
        },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY?.trim()) {
      return Response.json(
        {
          ok: false,
          message:
            "OPENAI_API_KEY is not configured.",
        },
        { status: 503 },
      );
    }

    if (
      process.env.BACKSTAGE_VISION_ENABLED !== "true"
    ) {
      return Response.json(
        {
          ok: false,
          message: "Vision AI is disabled.",
        },
        { status: 503 },
      );
    }

    const productionFile = path.join(
      process.cwd(),
      "content",
      "productions",
      `${body.slug}.ts`,
    );
    const imageFile = path.join(
      process.cwd(),
      "public",
      "images",
      "productions",
      body.slug,
      body.image,
    );

    const [productionSource, sourceImage] =
      await Promise.all([
        readFile(productionFile, "utf8"),
        readFile(imageFile),
      ]);

    if (sourceImage.byteLength > MAX_SOURCE_SIZE) {
      return Response.json(
        {
          ok: false,
          message:
            "The image is larger than the 50 MB analysis limit.",
        },
        { status: 413 },
      );
    }

    const production =
      readProductionFromSource(productionSource);

    if (production.slug !== body.slug) {
      throw new Error(
        "The production slug does not match its file.",
      );
    }

    const galleryImage =
      body.image === production.hero
        ? {
            src: production.hero,
            alt: production.heroAlt,
            layout: "wide" as const,
          }
        : production.images.find(
            (image) => image.src === body.image,
          ) ?? null;

    if (!galleryImage) {
      return Response.json(
        {
          ok: false,
          message:
            "The image is not part of this production.",
        },
        { status: 404 },
      );
    }

    const analysisImage = await sharp(sourceImage)
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    const imageDataUrl = `data:image/jpeg;base64,${analysisImage.toString(
      "base64",
    )}`;

    const response = await openai.responses.create({
      model:
        process.env.OPENAI_VISION_MODEL?.trim() ||
        "gpt-5",
      reasoning: {
        effort: "low",
      },
      text: {
        format: {
          type: "json_schema",
          name: "theatre_image_metadata",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              alt: {
                type: "string",
              },
              filename: {
                type: "string",
              },
              layout: {
                type: "string",
                enum: [...ALLOWED_LAYOUTS],
              },
            },
            required: ["alt", "filename", "layout"],
          },
        },
      },
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildPrompt(
                production,
                galleryImage,
                body.image,
              ),
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "high",
            },
          ],
        },
      ],
    });

    const output = response.output_text?.trim();

    if (!output) {
      throw new Error(
        "Vision AI returned no metadata.",
      );
    }

    const metadata = validateMetadata(
      JSON.parse(output) as unknown,
      body.image,
    );

    return Response.json({
      ok: true,
      image: body.image,
      metadata,
      model:
        process.env.OPENAI_VISION_MODEL?.trim() ||
        "gpt-5",
    });
  } catch (error) {
    console.error(
      "Image metadata analysis failed:",
      error,
    );

    if (error instanceof OpenAI.APIError) {
      return Response.json(
        {
          ok: false,
          message: error.message,
        },
        { status: error.status ?? 500 },
      );
    }

    if (
      error instanceof SyntaxError &&
      error.message.includes("JSON")
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "Vision AI returned invalid metadata JSON.",
        },
        { status: 502 },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "The image could not be analysed.";

    const status =
      message.includes("ENOENT") ||
      message.includes("not part of this production")
        ? 404
        : 500;

    return Response.json(
      {
        ok: false,
        message,
      },
      { status },
    );
  }
}
