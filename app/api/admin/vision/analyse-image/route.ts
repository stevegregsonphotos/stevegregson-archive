import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import OpenAI from "openai";
import path from "node:path";


import { openai } from "@/lib/vision/client";
import {
  getProductionImageUrl,
} from "@/lib/production-image-url";
import {
  getProduction,
} from "@/lib/productions-repository";
import {
  getSelectedWorkItem,
} from "@/lib/selected-work-repository";
import {
  getSelectedWorkImageUrl,
} from "@/lib/selected-work-image-url";

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

const SELECTED_WORK_CATEGORIES = [
  "production",
  "rehearsal",
  "campaign",
] as const;

type GalleryLayout = (typeof ALLOWED_LAYOUTS)[number];

type SelectedWorkCategory =
  (typeof SELECTED_WORK_CATEGORIES)[number];

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
type PrePublishProduction = {
  title?: string;
  venue?: string;
  year?: number | string;
  description?: string;
};

type AnalyseImageRequest = {
  slug?: unknown;
  selectedWorkCategory?: unknown;
  image?: unknown;
  previewUrl?: unknown;
  production?: unknown;
};

type VisionMetadata = {
  alt: string;
  filename: string;
  layout: GalleryLayout;
};

type AnalysisContext = {
  imageUrl: string;
  prompt: string;
  originalFilename: string;
};

const MAX_PREVIEW_DATA_URL_LENGTH =
  6 * 1024 * 1024;

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

function isSelectedWorkCategory(
  value: unknown,
): value is SelectedWorkCategory {
  return (
    typeof value === "string" &&
    SELECTED_WORK_CATEGORIES.includes(
      value as SelectedWorkCategory,
    )
  );
}

function normaliseFilename(
  suggestedFilename: string,
  originalFilename: string,
) {
  const originalExtension =
    path.extname(originalFilename).toLowerCase() ||
    ".jpg";

  const suggestedBase = path
    .basename(
      suggestedFilename,
      path.extname(suggestedFilename),
    )
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return `${
    suggestedBase || "theatre-production-image"
  }${originalExtension}`;
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
    alt: metadata.alt
  .trim()
  .replace(/\s+/g, " ")
  .slice(0, 240),
    filename: normaliseFilename(
      metadata.filename,
      originalFilename,
    ),
    layout: metadata.layout as GalleryLayout,
  };
}

function buildProductionPrompt(
  production: ProductionData,
  image: ProductionImage,
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
        credits: production.credits.map(
          (credit) => ({
            role: credit.role,
            name: credit.name,
          }),
        ),
        currentFilename: filename,
        currentAltText: image.alt,
        currentLayout: image.layout,
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
    `- Allowed layouts: ${ALLOWED_LAYOUTS.join(
      ", ",
    )}.`,
    "- Return only the structured metadata requested by the response schema.",
  ].join("\n");
}
function buildPrePublishProductionPrompt(
  production: PrePublishProduction,
  filename: string,
) {
  return [
    "Create metadata for one image on a professional theatre photographer's website.",
    "",
    "Production context:",
    JSON.stringify(
      {
        title: production.title ?? "",
        venue: production.venue ?? "",
        year: production.year ?? "",
        description: production.description ?? "",
        currentFilename: filename,
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
    `- Allowed layouts: ${ALLOWED_LAYOUTS.join(
      ", ",
    )}.`,
    "- Return only the structured metadata requested by the response schema.",
  ].join("\n");
}
function buildSelectedWorkPrompt(
  category: SelectedWorkCategory,
  filename: string,
) {
  const categoryContext: Record<
    SelectedWorkCategory,
    string
  > = {
    production:
      "Production photography showing live performance, staging, lighting, design, movement, atmosphere, and dramatic action.",
    rehearsal:
      "Rehearsal or backstage photography showing theatrical process, preparation, collaboration, creative work, and candid moments off stage.",
    campaign:
      "Campaign, press, marketing, publicity, or PR photography created to promote a theatre production, company, performer, or creative project.",
  };

  return [
    "Create metadata for one image in the Selected Work portfolio of a professional theatre photographer.",
    "",
    "Selected Work category:",
    categoryContext[category],
    "",
    "Current filename:",
    filename,
    "",
    "Requirements:",
    "- Write concise, factual alt text, ideally under 140 characters.",
    "- Do not begin with 'image of', 'photo of', or 'photograph of'.",
    "- Describe only what is visibly supported by the photograph.",
    "- Mention performance, staging, action, composition, lighting, costume, setting, or mood only when useful.",
    "- Do not guess a person's identity, character name, production title, venue, or company.",
    "- Suggest a lowercase, hyphen-separated, SEO-friendly filename without a path.",
    "- Do not include the photographer's name in every filename or alt text.",
    "- Choose the strongest layout for the composition from the allowed values.",
    `- Allowed layouts: ${ALLOWED_LAYOUTS.join(
      ", ",
    )}.`,
    "- Return only the structured metadata requested by the response schema.",
  ].join("\n");
}

async function loadProductionContext(
  slug: string,
  filename: string,
): Promise<AnalysisContext> {
  const production =
    await getProduction(slug);

  if (!production) {
    throw new Error(
      "The production could not be found.",
    );
  }

  const galleryImage =
    filename === production.hero
      ? {
          src: production.hero,
          alt: production.heroAlt,
          layout: "wide" as const,
        }
      : production.images.find(
          (image) =>
            image.src === filename,
        );

  if (!galleryImage) {
    throw new Error(
      "The image is not part of this production.",
    );
  }

  return {
    imageUrl:
      getProductionImageUrl(
        slug,
        filename,
      ),
    prompt:
      buildProductionPrompt(
        production,
        galleryImage,
        filename,
      ),
    originalFilename:
      filename,
  };
}

function loadPrePublishProductionContext(
  previewUrl: string,
  production: PrePublishProduction,
  filename: string,
): AnalysisContext {
  const match = previewUrl.match(
    /^data:image\/(?:jpeg|jpg);base64,(.+)$/,
  );

  if (!match) {
    throw new Error(
      "The production preview image is invalid.",
    );
  }

  if (
    previewUrl.length >
    MAX_PREVIEW_DATA_URL_LENGTH
  ) {
    throw new Error(
      "The production preview image is too large for analysis.",
    );
  }

  return {
    imageUrl: previewUrl,
    prompt: buildPrePublishProductionPrompt(
      production,
      filename,
    ),
    originalFilename: filename,
  };
}
async function loadSelectedWorkContext(
  category: SelectedWorkCategory,
  filename: string,
): Promise<AnalysisContext> {
  const item =
    await getSelectedWorkItem(
      category,
      filename,
    );

  if (!item) {
    throw new Error(
      "The Selected Work image could not be found.",
    );
  }

  return {
    imageUrl:
      getSelectedWorkImageUrl(
        category,
        item.image.filename,
      ),
    prompt: buildSelectedWorkPrompt(
      category,
      filename,
    ),
    originalFilename: filename,
  };
}

export async function POST(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  try {
    const body =
      (await request.json()) as AnalyseImageRequest;

    if (
      typeof body.image !== "string" ||
      !isSafeFilename(body.image)
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "A valid image filename is required.",
        },
        { status: 400 },
      );
    }

        const hasProductionSlug =
        typeof body.slug === "string" &&
        isSafeSlug(body.slug);

      const hasSelectedWorkCategory =
        isSelectedWorkCategory(
          body.selectedWorkCategory,
        );

      const hasPrePublishProduction =
        typeof body.previewUrl === "string" &&
        typeof body.production === "object" &&
        body.production !== null;

      const contextModes = [
        hasProductionSlug,
        hasSelectedWorkCategory,
        hasPrePublishProduction,
      ].filter(Boolean).length;

      if (contextModes !== 1) {
        return Response.json(
          {
            ok: false,
            message:
              "Provide exactly one valid image analysis context.",
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
      process.env.BACKSTAGE_VISION_ENABLED !==
      "true"
    ) {
      return Response.json(
        {
          ok: false,
          message: "Vision AI is disabled.",
        },
        { status: 503 },
      );
    }

          const context = hasProductionSlug
        ? await loadProductionContext(
            body.slug as string,
            body.image,
          )
        : hasSelectedWorkCategory
          ? await loadSelectedWorkContext(
              body.selectedWorkCategory as SelectedWorkCategory,
              body.image,
            )
          : loadPrePublishProductionContext(
              body.previewUrl as string,
              body.production as PrePublishProduction,
              body.image,
            );

    const imageDataUrl =
      context.imageUrl;

    const response =
      await openai.responses.create({
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
              required: [
                "alt",
                "filename",
                "layout",
              ],
            },
          },
        },
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: context.prompt,
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

    const output =
      response.output_text?.trim();

    if (!output) {
      throw new Error(
        "Vision AI returned no metadata.",
      );
    }

    const metadata = validateMetadata(
      JSON.parse(output) as unknown,
      context.originalFilename,
    );

    return Response.json({
      ok: true,
      image: context.originalFilename,
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
        {
          status: error.status ?? 500,
        },
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
      message.includes(
        "not part of this production",
      )
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