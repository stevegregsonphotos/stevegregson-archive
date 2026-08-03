import {
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GalleryLayout =
  | "wide"
  | "left"
  | "right"
  | "medium"
  | "full"
  | "left-small"
  | "right-small"
  | "wide-left"
  | "wide-right";

type ProductionImage = {
  src: string;
  alt: string;
  layout: GalleryLayout;
};

type ProductionCredit = {
  role: string;
  name: string;
  website?: string;
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

type UpdateRequest = {
  slug?: unknown;
  hero?: unknown;
  title?: unknown;
  venue?: unknown;
  year?: unknown;
  description?: unknown;
  credits?: unknown;
};

function isSafeSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function getProductionFile(slug: string) {
  return path.join(
    process.cwd(),
    "content",
    "productions",
    `${slug}.ts`,
  );
}

function readProductionFromSource(
  source: string,
): ProductionData {
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

function serialiseProductionFile(
  source: string,
  production: ProductionData,
) {
  const assignmentIndex = source.indexOf("= {");
  const objectEndIndex = source.lastIndexOf("};");

  if (
    assignmentIndex === -1 ||
    objectEndIndex === -1
  ) {
    throw new Error(
      "The production file format could not be recognised.",
    );
  }

  const objectSource = JSON.stringify(
    production,
    null,
    2,
  );

  return `${source.slice(
    0,
    assignmentIndex + 2,
  )}${objectSource}${source.slice(
    objectEndIndex + 1,
  )}`;
}

function validateProduction(
  production: ProductionData,
) {
  return (
    typeof production.slug === "string" &&
    isSafeSlug(production.slug) &&
    typeof production.title === "string" &&
    Boolean(production.title.trim()) &&
    typeof production.venue === "string" &&
    Boolean(production.venue.trim()) &&
    Number.isInteger(production.year) &&
    typeof production.description === "string" &&
    typeof production.hero === "string" &&
    Boolean(production.hero) &&
    typeof production.heroAlt === "string" &&
    Array.isArray(production.credits) &&
    Array.isArray(production.images)
  );
}

export async function GET(request: Request) {
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

    const source = await readFile(
      getProductionFile(slug),
      "utf8",
    );

    const production =
      readProductionFromSource(source);

    if (!validateProduction(production)) {
      throw new Error(
        "The production data is incomplete or invalid.",
      );
    }

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

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as UpdateRequest;

    if (
      typeof body.slug !== "string" ||
      !isSafeSlug(body.slug)
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "A valid production slug is required.",
        },
        { status: 400 },
      );
    }

    const productionFile =
      getProductionFile(body.slug);

    const source = await readFile(
      productionFile,
      "utf8",
    );

    const production =
      readProductionFromSource(source);

    if (!validateProduction(production)) {
      throw new Error(
        "The existing production data is incomplete or invalid.",
      );
    }

  let heroChanged = false;
let detailsChanged = false;
let creditsChanged = false;

    if (body.hero !== undefined) {
      if (
        typeof body.hero !== "string" ||
        !body.hero
      ) {
        return Response.json(
          {
            ok: false,
            message:
              "The selected hero image is invalid.",
          },
          { status: 400 },
        );
      }

      if (body.hero !== production.hero) {
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
        const previousHeroAlt =
          production.heroAlt;

        production.hero = chosenImage.src;
        production.heroAlt = chosenImage.alt;

        production.images = [
          {
            src: previousHero,
            alt: previousHeroAlt,
            layout: "wide",
          },
          ...production.images.filter(
            (image) =>
              image.src !== chosenImage.src,
          ),
        ];

        heroChanged = true;
      }
    }

    if (body.title !== undefined) {
      if (
        typeof body.title !== "string" ||
        !body.title.trim()
      ) {
        return Response.json(
          {
            ok: false,
            message:
              "A production title is required.",
          },
          { status: 400 },
        );
      }

      const title = body.title.trim();

      if (title !== production.title) {
        production.title = title;
        detailsChanged = true;
      }
    }

    if (body.venue !== undefined) {
      if (
        typeof body.venue !== "string" ||
        !body.venue.trim()
      ) {
        return Response.json(
          {
            ok: false,
            message: "A venue is required.",
          },
          { status: 400 },
        );
      }

      const venue = body.venue.trim();

      if (venue !== production.venue) {
        production.venue = venue;
        detailsChanged = true;
      }
    }

    if (body.year !== undefined) {
      const year =
        typeof body.year === "number"
          ? body.year
          : typeof body.year === "string"
            ? Number.parseInt(body.year, 10)
            : Number.NaN;

      if (!Number.isInteger(year)) {
        return Response.json(
          {
            ok: false,
            message:
              "A valid production year is required.",
          },
          { status: 400 },
        );
      }

      if (year !== production.year) {
        production.year = year;
        detailsChanged = true;
      }
    }

    if (body.description !== undefined) {
      if (typeof body.description !== "string") {
        return Response.json(
          {
            ok: false,
            message:
              "The production description is invalid.",
          },
          { status: 400 },
        );
      }
      if (body.credits !== undefined) {
  if (!Array.isArray(body.credits)) {
    return Response.json(
      {
        ok: false,
        message: "The production credits are invalid.",
      },
      { status: 400 },
    );
  }

  const credits: ProductionCredit[] = [];

  for (const item of body.credits) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("role" in item) ||
      !("name" in item) ||
      typeof item.role !== "string" ||
      typeof item.name !== "string"
    ) {
      return Response.json(
        {
          ok: false,
          message: "Each credit requires a role and name.",
        },
        { status: 400 },
      );
    }

    const role = item.role.trim();
    const name = item.name.trim();

    if (!role || !name) {
      return Response.json(
        {
          ok: false,
          message: "Each credit requires a role and name.",
        },
        { status: 400 },
      );
    }

    const website =
      "website" in item &&
      typeof item.website === "string" &&
      item.website.trim()
        ? item.website.trim()
        : undefined;

    credits.push({
      role,
      name,
      ...(website ? { website } : {}),
    });
  }

  if (
    JSON.stringify(credits) !==
    JSON.stringify(production.credits)
  ) {
    production.credits = credits;
    creditsChanged = true;
  }
}

      const description =
        body.description.trim();

      if (
        description !== production.description
      ) {
        production.description = description;
        detailsChanged = true;
      }
    }

    if (
  !heroChanged &&
  !detailsChanged &&
  !creditsChanged
) {
      return Response.json({
        ok: true,
        message: "No changes were needed.",
        production,
      });
    }

    const updatedSource =
      serialiseProductionFile(
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
      message:
  heroChanged && detailsChanged && creditsChanged
    ? "Production details, credits and hero updated successfully."
    : heroChanged && detailsChanged
      ? "Production details and hero updated successfully."
      : heroChanged && creditsChanged
        ? "Production credits and hero updated successfully."
        : detailsChanged && creditsChanged
          ? "Production details and credits updated successfully."
          : heroChanged
            ? "Hero image updated successfully."
            : detailsChanged
              ? "Production details updated successfully."
              : "Production credits updated successfully.",
      production,
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
}