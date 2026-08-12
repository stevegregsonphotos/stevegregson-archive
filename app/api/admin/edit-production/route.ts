import { readFile, writeFile } from "node:fs/promises";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
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
  suggestedFilename?: string;
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
  access?: "public" | "password";
accessPasswordEncrypted?: string;
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
  access?: unknown;
accessPassword?: unknown;
  credits?: unknown;
  images?: unknown;
};

const ALLOWED_LAYOUTS = new Set<GalleryLayout>([
  "wide",
  "left",
  "right",
  "medium",
  "full",
  "left-small",
  "right-small",
  "wide-left",
  "wide-right",
]);

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
function getPasswordKey() {
  const value = process.env.PRODUCTION_PASSWORD_KEY;

  if (!value || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(
      "PRODUCTION_PASSWORD_KEY is missing or invalid.",
    );
  }

  return Buffer.from(value, "hex");
}

function encryptAccessPassword(password: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    getPasswordKey(),
    iv,
  );

  const encrypted = Buffer.concat([
    cipher.update(password, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

function decryptAccessPassword(value: string) {
  const [ivHex, authTagHex, encryptedHex] =
    value.split(":");

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error(
      "The stored production password is invalid.",
    );
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getPasswordKey(),
    Buffer.from(ivHex, "hex"),
  );

  decipher.setAuthTag(
    Buffer.from(authTagHex, "hex"),
  );

  const decrypted = Buffer.concat([
    decipher.update(
      Buffer.from(encryptedHex, "hex"),
    ),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
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

  if (assignmentIndex === -1 || objectEndIndex === -1) {
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
  )}${objectSource}${source.slice(objectEndIndex + 1)}`;
}

function isProductionImage(
  value: unknown,
): value is ProductionImage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const image = value as Record<string, unknown>;

  return (
    typeof image.src === "string" &&
    isSafeFilename(image.src) &&
    typeof image.alt === "string" &&
    typeof image.layout === "string" &&
    ALLOWED_LAYOUTS.has(image.layout as GalleryLayout) &&
    (image.suggestedFilename === undefined ||
      (typeof image.suggestedFilename === "string" &&
        isSafeFilename(image.suggestedFilename)))
  );
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
    isSafeFilename(production.hero) &&
    typeof production.heroAlt === "string" &&
    Array.isArray(production.credits) &&
    Array.isArray(production.images) &&
    production.images.every(isProductionImage)
  );
}

function parseCredits(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("The production credits are invalid.");
  }

  return value.map((item): ProductionCredit => {
    if (typeof item !== "object" || item === null) {
      throw new Error(
        "Each credit requires a role and name.",
      );
    }

    const credit = item as Record<string, unknown>;

    if (
      typeof credit.role !== "string" ||
      typeof credit.name !== "string"
    ) {
      throw new Error(
        "Each credit requires a role and name.",
      );
    }

    const role = credit.role.trim();
    const name = credit.name.trim();

    if (!role || !name) {
      throw new Error(
        "Each credit requires a role and name.",
      );
    }

    const website =
      typeof credit.website === "string" &&
      credit.website.trim()
        ? credit.website.trim()
        : undefined;

    return {
      role,
      name,
      ...(website ? { website } : {}),
    };
  });
}

function parseImages(value: unknown) {
  if (!Array.isArray(value) || !value.every(isProductionImage)) {
    throw new Error("The production gallery is invalid.");
  }

  const seen = new Set<string>();

  return value.map((image) => {
    if (seen.has(image.src)) {
      throw new Error(
        `The gallery contains the duplicate image "${image.src}".`,
      );
    }

    seen.add(image.src);

    return {
      src: image.src,
      alt: image.alt.trim(),
      layout: image.layout,
      ...(image.suggestedFilename
        ? { suggestedFilename: image.suggestedFilename.trim() }
        : {}),
    };
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");

    if (!slug || !isSafeSlug(slug)) {
      return Response.json(
        {
          ok: false,
          message: "A valid production slug is required.",
        },
        { status: 400 },
      );
    }

    const source = await readFile(
      getProductionFile(slug),
      "utf8",
    );
    const production = readProductionFromSource(source);

    if (!validateProduction(production)) {
      throw new Error(
        "The production data is incomplete or invalid.",
      );
    }

const responseProduction = {
  ...production,
  accessPassword:
    production.access === "password" &&
    production.accessPasswordEncrypted
      ? decryptAccessPassword(
          production.accessPasswordEncrypted,
        )
      : "",
};

return Response.json({
  ok: true,
  production: responseProduction,
});
  } catch (error) {
    console.error("Production loading failed:", error);

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
    const body = (await request.json()) as UpdateRequest;

    if (
      typeof body.slug !== "string" ||
      !isSafeSlug(body.slug)
    ) {
      return Response.json(
        {
          ok: false,
          message: "A valid production slug is required.",
        },
        { status: 400 },
      );
    }

    const productionFile = getProductionFile(body.slug);
    const source = await readFile(productionFile, "utf8");
    const production = readProductionFromSource(source);

    if (!validateProduction(production)) {
      throw new Error(
        "The existing production data is incomplete or invalid.",
      );
    }

    const previousHero = production.hero;
    const previousHeroAlt = production.heroAlt;
    let nextImages =
      body.images === undefined
        ? [...production.images]
        : parseImages(body.images);

    const requestedHero =
      body.hero === undefined ? production.hero : body.hero;

    if (
      typeof requestedHero !== "string" ||
      !isSafeFilename(requestedHero)
    ) {
      return Response.json(
        {
          ok: false,
          message: "The selected hero image is invalid.",
        },
        { status: 400 },
      );
    }

    if (requestedHero !== production.hero) {
      const chosenImage = nextImages.find(
        (image) => image.src === requestedHero,
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

      production.hero = chosenImage.src;
      production.heroAlt = chosenImage.alt;
      nextImages = [
        {
          src: previousHero,
          alt: previousHeroAlt,
          layout: "wide",
        },
        ...nextImages.filter(
          (image) => image.src !== chosenImage.src,
        ),
      ];
    }

    production.images = nextImages;

    if (body.title !== undefined) {
      if (
        typeof body.title !== "string" ||
        !body.title.trim()
      ) {
        return Response.json(
          { ok: false, message: "A production title is required." },
          { status: 400 },
        );
      }

      production.title = body.title.trim();
    }

    if (body.venue !== undefined) {
      if (
        typeof body.venue !== "string" ||
        !body.venue.trim()
      ) {
        return Response.json(
          { ok: false, message: "A venue is required." },
          { status: 400 },
        );
      }

      production.venue = body.venue.trim();
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
            message: "A valid production year is required.",
          },
          { status: 400 },
        );
      }

      production.year = year;
    }

    if (body.description !== undefined) {
  if (typeof body.description !== "string") {
    return Response.json(
      {
        ok: false,
        message: "The production description is invalid.",
      },
      { status: 400 },
    );
  }

  production.description = body.description.trim();
}

if (body.access !== undefined) {
  if (
    body.access !== "public" &&
    body.access !== "password"
  ) {
    return Response.json(
      {
        ok: false,
        message:
          "The production access setting is invalid.",
      },
      { status: 400 },
    );
  }

  if (body.access === "public") {
  production.access = "public";
  delete production.accessPasswordEncrypted;
} else {
  const password =
    typeof body.accessPassword === "string"
      ? (body.accessPassword as string).trim()
      : "";

  if (password) {
    production.access = "password";
    production.accessPasswordEncrypted =
      encryptAccessPassword(password);
  } else if (
    production.access === "password" &&
    production.accessPasswordEncrypted
  ) {
    production.access = "password";
  } else {
    return Response.json(
      {
        ok: false,
        message:
          "Enter a password before protecting this production.",
      },
      { status: 400 },
    );
  }
}
}

    if (body.credits !== undefined) {
      production.credits = parseCredits(body.credits);
    }

    const updatedSource = serialiseProductionFile(
      source,
      production,
    );

    if (updatedSource !== source) {
      await writeFile(productionFile, updatedSource, "utf8");
    }

    const responseProduction = {
  ...production,
  accessPassword:
    production.access === "password" &&
    production.accessPasswordEncrypted
      ? decryptAccessPassword(
          production.accessPasswordEncrypted,
        )
      : "",
};

return Response.json({
  ok: true,
  message: "Production updated successfully.",
  production: responseProduction,
});
  } catch (error) {
    console.error("Production update failed:", error);

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
