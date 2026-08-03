import {
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductionImage = {
  src: string;
  alt: string;
  layout:
    | "wide"
    | "left"
    | "right"
    | "medium"
    | "full"
    | "left-small"
    | "right-small"
    | "wide-left"
    | "wide-right";
};

type ProductionPayload = {
  slug: string;
  hero: string;
  heroAlt: string;
  images: ProductionImage[];
};

function isSafeSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function serialiseProductionFile(
  exportName: string,
  source: string,
  payload: ProductionPayload,
) {
  const start = source.indexOf("= {");
  const end = source.lastIndexOf("};");

  if (start === -1 || end === -1) {
    throw new Error(
      "The production file format could not be recognised.",
    );
  }

  const objectSource = JSON.stringify(
    payload,
    null,
    2,
  );

  return `${source.slice(
    0,
    start + 2,
  )}${objectSource}${source.slice(end + 1)}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      slug?: unknown;
      hero?: unknown;
    };

    if (
      typeof body.slug !== "string" ||
      !isSafeSlug(body.slug) ||
      typeof body.hero !== "string" ||
      !body.hero
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "A valid production slug and hero image are required.",
        },
        { status: 400 },
      );
    }

    const projectRoot = process.cwd();
    const productionFile = path.join(
      projectRoot,
      "content",
      "productions",
      `${body.slug}.ts`,
    );

    const source = await readFile(
      productionFile,
      "utf8",
    );

    const exportMatch = source.match(
      /export const\s+([A-Za-z0-9_]+)\s*:/,
    );

    if (!exportMatch) {
      throw new Error(
        "The production export name could not be found.",
      );
    }

    const objectMatch = source.match(
      /=\s*({[\s\S]*})\s*;\s*$/,
    );

    if (!objectMatch) {
      throw new Error(
        "The production data could not be read.",
      );
    }

    const production = JSON.parse(
      objectMatch[1],
    ) as ProductionPayload & {
      title: string;
      venue: string;
      year: number;
      description: string;
      credits: unknown[];
    };

    const chosenImage =
      production.images.find(
        (image) => image.src === body.hero,
      );

    if (!chosenImage) {
      return Response.json(
        {
          ok: false,
          message:
            "The selected hero is not part of this production gallery.",
        },
        { status: 400 },
      );
    }

    const previousHero = production.hero;

    production.hero = chosenImage.src;
    production.heroAlt = chosenImage.alt;

    production.images = [
      {
        src: previousHero,
        alt: production.heroAlt,
        layout: "wide",
      },
      ...production.images.filter(
        (image) => image.src !== chosenImage.src,
      ),
    ];

    const updatedSource =
      serialiseProductionFile(
        exportMatch[1],
        source,
        production,
      );

    await writeFile(
      productionFile,
      updatedSource,
      "utf8",
    );

    return Response.json({
      ok: true,
      message: "Hero image updated.",
      hero: production.hero,
    });
  } catch (error) {
    console.error(
      "Production update failed:",
      error,
    );

    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "The production could not be updated.",
      },
      { status: 500 },
    );
  }
}export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");

    if (!slug || !isSafeSlug(slug)) {
      return Response.json(
        {
          ok: false,
          message:
            "A valid production slug is required.",
        },
        { status: 400 },
      );
    }

    const productionFile = path.join(
      process.cwd(),
      "content",
      "productions",
      `${slug}.ts`,
    );

    const source = await readFile(
      productionFile,
      "utf8",
    );

    const objectMatch = source.match(
      /=\s*({[\s\S]*})\s*;\s*$/,
    );

    if (!objectMatch) {
      throw new Error(
        "The production data could not be read.",
      );
    }

    const production = JSON.parse(
      objectMatch[1],
    );

    return Response.json({
      ok: true,
      production,
    });
  } catch (error) {
    console.error(
      "Production loading failed:",
      error,
    );

    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "The production could not be loaded.",
      },
      { status: 500 },
    );
  }
}