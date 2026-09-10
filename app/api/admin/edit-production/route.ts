import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

import {
  decryptProductionPassword,
  encryptProductionPassword,
} from "@/lib/production-access";
import {
  prepareDirectoryCredits,
  rememberDirectoryCredits,
} from "@/lib/directory-writer";
import {
  commitGitHubTextFiles,
  readGitHubTextFile,
} from "@/lib/github-content";

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
  showHeroWhenLocked?: boolean;
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
  showHeroWhenLocked?: unknown;
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
function getProductionFile(slug: string) {
  return path.join(
    process.cwd(),
    "content",
    "productions",
    `${slug}.ts`,
  );
}

function literalNodeToValue(
  node: ts.Expression,
): unknown {
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return node.text;
  }

  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }

  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }

  if (ts.isPrefixUnaryExpression(node)) {
    const value =
      literalNodeToValue(node.operand);

    if (typeof value !== "number") {
      throw new Error(
        "Unsupported unary production value.",
      );
    }

    if (
      node.operator ===
      ts.SyntaxKind.MinusToken
    ) {
      return -value;
    }

    if (
      node.operator ===
      ts.SyntaxKind.PlusToken
    ) {
      return value;
    }
  }

  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((element) => {
      if (ts.isSpreadElement(element)) {
        throw new Error(
          "Spread values are not supported in production data.",
        );
      }

      return literalNodeToValue(
        element as ts.Expression,
      );
    });
  }

  if (ts.isObjectLiteralExpression(node)) {
    const result:
      Record<string, unknown> = {};

    for (const property of node.properties) {
      if (
        !ts.isPropertyAssignment(property)
      ) {
        throw new Error(
          "Unsupported production object property.",
        );
      }

      let key: string;

      if (
        ts.isIdentifier(property.name) ||
        ts.isStringLiteral(property.name) ||
        ts.isNumericLiteral(property.name)
      ) {
        key = property.name.text;
      } else {
        throw new Error(
          "Unsupported production property name.",
        );
      }

      result[key] =
        literalNodeToValue(
          property.initializer,
        );
    }

    return result;
  }

  throw new Error(
    "Unsupported value in production data.",
  );
}

function readProductionFromSource(
  source: string,
): ProductionData {
  const sourceFile =
    ts.createSourceFile(
      "production.ts",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

  for (const statement of
    sourceFile.statements) {
    if (
      !ts.isVariableStatement(statement)
    ) {
      continue;
    }

    for (const declaration of
      statement.declarationList
        .declarations) {
      const initializer =
        declaration.initializer;

      if (
        initializer &&
        ts.isObjectLiteralExpression(
          initializer,
        )
      ) {
        return literalNodeToValue(
          initializer,
        ) as ProductionData;
      }
    }
  }

  throw new Error(
    "The production data could not be read.",
  );
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
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

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
      ? decryptProductionPassword(
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
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

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

    const productionPath =
      `content/productions/${body.slug}.ts`;

    const source =
      await readGitHubTextFile(
        productionPath,
      );

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
      encryptProductionPassword(password);
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

    if (body.showHeroWhenLocked !== undefined) {
      if (typeof body.showHeroWhenLocked !== "boolean") {
        return Response.json(
          {
            ok: false,
            message: "The locked hero setting is invalid.",
          },
          { status: 400 },
        );
      }

      if (body.showHeroWhenLocked) {
        production.showHeroWhenLocked = true;
      } else {
        delete production.showHeroWhenLocked;
      }
    }

    if (body.credits !== undefined) {
      production.credits = parseCredits(body.credits);
    }

    const updatedSource = serialiseProductionFile(
      source,
      production,
    );

    let directorySync:
      Awaited<
        ReturnType<
          typeof rememberDirectoryCredits
        >
      > | null = null;

    let directoryWarning:
      string | null = null;

    if (process.env.VERCEL) {
      const directoryPath =
        "lib/directory.json";

      const directorySource =
        await readGitHubTextFile(
          directoryPath,
        );

      const preparedDirectory =
        prepareDirectoryCredits(
          directorySource,
          production.credits,
        );

      directorySync =
        preparedDirectory.result;

      const files: Array<{
        path: string;
        source: string;
      }> = [];

      if (updatedSource !== source) {
        files.push({
          path: productionPath,
          source: updatedSource,
        });
      }

      if (preparedDirectory.changed) {
        files.push({
          path: directoryPath,
          source: preparedDirectory.source,
        });
      }

      if (files.length > 0) {
        await commitGitHubTextFiles({
          files,
          message:
            `Update production: ${production.title}`,
        });
      }
    } else {
      if (updatedSource !== source) {
        await writeFile(
          getProductionFile(body.slug),
          updatedSource,
          "utf8",
        );
      }

      try {
        directorySync =
          await rememberDirectoryCredits(
            production.credits,
          );
      } catch (directoryError) {
        console.error(
          "Directory sync failed:",
          directoryError,
        );

        directoryWarning =
          directoryError instanceof Error
            ? directoryError.message
            : "The global website directory could not be updated.";
      }
    }

    const responseProduction = {
      ...production,
      accessPassword:
        production.access === "password" &&
        production.accessPasswordEncrypted
          ? decryptProductionPassword(
              production.accessPasswordEncrypted,
            )
          : "",
    };

    return Response.json({
      ok: true,
      message:
        "Production updated successfully.",
      production:
        responseProduction,
      directorySync,
      directoryWarning,
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
