import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  rememberDirectoryCredits,
} from "@/lib/directory-writer";
import {
  decryptProductionPassword,
  encryptProductionPassword,
} from "@/lib/production-access";
import {
  getProduction,
  replaceProduction,
} from "@/lib/productions-repository";
import {
  copyProductionImage,
  deleteProductionImage,
  productionImageExists,
  uniqueProductionImageFilename,
} from "@/lib/publishing/production-image-storage";

import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GalleryLayout =
  | "wide" | "left" | "right" | "medium" | "full"
  | "left-small" | "right-small" | "wide-left" | "wide-right";

type ProductionImage = {
  src: string;
  alt: string;
  layout: GalleryLayout;
  blurDataURL?: string;
  suggestedFilename?: string;
};

type ProductionCredit = {
  role: string;
  name: string;
  website?: string;
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
  "wide", "left", "right", "medium", "full",
  "left-small", "right-small", "wide-left", "wide-right",
]);

function isSafeSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isSafeFilename(value: string) {
  return Boolean(value) &&
    value === path.basename(value) &&
    !value.includes("\0") &&
    value !== "." && value !== "..";
}

function isProductionImage(value: unknown): value is ProductionImage {
  if (!value || typeof value !== "object") return false;
  const image = value as Record<string, unknown>;
  return typeof image.src === "string" &&
    isSafeFilename(image.src) &&
    typeof image.alt === "string" &&
    typeof image.layout === "string" &&
    ALLOWED_LAYOUTS.has(image.layout as GalleryLayout) &&
    (image.blurDataURL === undefined || typeof image.blurDataURL === "string") &&
    (image.suggestedFilename === undefined ||
      (typeof image.suggestedFilename === "string" &&
       isSafeFilename(image.suggestedFilename)));
}

function parseCredits(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("The production credits are invalid.");
  }
  return value.map((item): ProductionCredit => {
    if (!item || typeof item !== "object") {
      throw new Error("Each credit requires a role and name.");
    }
    const credit = item as Record<string, unknown>;
    if (typeof credit.role !== "string" || typeof credit.name !== "string") {
      throw new Error("Each credit requires a role and name.");
    }
    const role = credit.role.trim();
    const name = credit.name.trim();
    if (!role || !name) {
      throw new Error("Each credit requires a role and name.");
    }
    const website =
      typeof credit.website === "string" && credit.website.trim()
        ? credit.website.trim()
        : undefined;
    return { role, name, ...(website ? { website } : {}) };
  });
}

function parseImages(value: unknown) {
  if (!Array.isArray(value) || !value.every(isProductionImage)) {
    throw new Error("The production gallery is invalid.");
  }
  const seen = new Set<string>();
  return value.map((image) => {
    if (seen.has(image.src)) {
      throw new Error(`The gallery contains the duplicate image "${image.src}".`);
    }
    seen.add(image.src);
    return {
      src: image.src,
      alt: image.alt.trim(),
      layout: image.layout,
      ...(image.blurDataURL ? { blurDataURL: image.blurDataURL } : {}),
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
    const slug = new URL(request.url).searchParams.get("slug");
    if (!slug || !isSafeSlug(slug)) {
      return Response.json(
        { ok: false, message: "A valid production slug is required." },
        { status: 400 },
      );
    }
    const production = await getProduction(slug);
    if (!production) {
      return Response.json(
        { ok: false, message: "The production could not be found." },
        { status: 404 },
      );
    }
    return Response.json({
      ok: true,
      production: {
        ...production,
        accessPassword:
          production.access === "password" &&
          production.accessPasswordEncrypted
            ? decryptProductionPassword(
                production.accessPasswordEncrypted,
              )
            : "",
      },
    });
  } catch (error) {
    console.error("Production loading failed:", error);
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : "The production could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }
  const copiedFilenames: string[] = [];
  let activeSlug: string | null = null;
  try {
    const body = (await request.json()) as UpdateRequest;
    if (typeof body.slug !== "string" || !isSafeSlug(body.slug)) {
      return Response.json(
        { ok: false, message: "A valid production slug is required." },
        { status: 400 },
      );
    }

    activeSlug = body.slug;
    const existing = await getProduction(body.slug);
    if (!existing) {
      return Response.json(
        { ok: false, message: "The production could not be found." },
        { status: 404 },
      );
    }

    const production = {
      ...existing,
      credits: [...existing.credits],
      images: [...existing.images],
    };

    const previousHero = production.hero;
    const previousHeroAlt = production.heroAlt;
    const previousHeroBlur = production.heroBlurDataURL;

    let nextImages = body.images === undefined
      ? [...production.images]
      : parseImages(body.images);

    const existingImageByFilename = new Map(
      production.images.map((image) => [image.src, image]),
    );
    nextImages = nextImages.map((image) => {
      const old = existingImageByFilename.get(image.src);
      return {
        ...image,
        ...(image.blurDataURL || !old?.blurDataURL
          ? {}
          : { blurDataURL: old.blurDataURL }),
      };
    });

    const requestedHero =
      body.hero === undefined ? production.hero : body.hero;
    if (typeof requestedHero !== "string" || !isSafeFilename(requestedHero)) {
      return Response.json(
        { ok: false, message: "The selected hero image is invalid." },
        { status: 400 },
      );
    }

    if (requestedHero !== production.hero) {
      const chosenImage = nextImages.find(
        (image) => image.src === requestedHero,
      );
      if (!chosenImage) {
        return Response.json(
          { ok: false, message: "The selected hero is not part of this production gallery." },
          { status: 400 },
        );
      }
      production.hero = chosenImage.src;
      production.heroAlt = chosenImage.alt;
      production.heroBlurDataURL = chosenImage.blurDataURL;
      nextImages = [
        {
          src: previousHero,
          alt: previousHeroAlt,
          layout: "wide" as const,
          ...(previousHeroBlur ? { blurDataURL: previousHeroBlur } : {}),
        },
        ...nextImages.filter((image) => image.src !== chosenImage.src),
      ];
    }

    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        return Response.json({ ok: false, message: "A production title is required." }, { status: 400 });
      }
      production.title = body.title.trim();
    }
    if (body.venue !== undefined) {
      if (typeof body.venue !== "string" || !body.venue.trim()) {
        return Response.json({ ok: false, message: "A venue is required." }, { status: 400 });
      }
      production.venue = body.venue.trim();
    }
    if (body.year !== undefined) {
      const year = typeof body.year === "number"
        ? body.year
        : typeof body.year === "string"
          ? Number.parseInt(body.year, 10)
          : Number.NaN;
      if (!Number.isInteger(year)) {
        return Response.json({ ok: false, message: "A valid production year is required." }, { status: 400 });
      }
      production.year = year;
    }
    if (body.description !== undefined) {
      if (typeof body.description !== "string") {
        return Response.json({ ok: false, message: "The production description is invalid." }, { status: 400 });
      }
      production.description = body.description.trim();
    }
    if (body.access !== undefined) {
      if (body.access !== "public" && body.access !== "password") {
        return Response.json({ ok: false, message: "The production access setting is invalid." }, { status: 400 });
      }
      if (body.access === "public") {
        production.access = "public";
        delete production.accessPasswordEncrypted;
      } else {
        const password =
          typeof body.accessPassword === "string"
            ? body.accessPassword.trim()
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
          return Response.json({ ok: false, message: "Enter a password before protecting this production." }, { status: 400 });
        }
      }
    }
    if (body.showHeroWhenLocked !== undefined) {
      if (typeof body.showHeroWhenLocked !== "boolean") {
        return Response.json({ ok: false, message: "The locked hero setting is invalid." }, { status: 400 });
      }
      production.showHeroWhenLocked = body.showHeroWhenLocked || undefined;
    }
    if (body.credits !== undefined) {
      production.credits = parseCredits(body.credits);
    }

    const reserved = new Set<string>();
    const renamedFrom: string[] = [];
    const finalImages: ProductionImage[] = [];

    for (const image of nextImages) {
      if (!(await productionImageExists(body.slug, image.src))) {
        return Response.json(
          { ok: false, message: `${image.src} exists in the production but its R2 object is missing.` },
          { status: 404 },
        );
      }
      let finalFilename = image.src;
      if (image.suggestedFilename) {
        finalFilename = await uniqueProductionImageFilename(
          body.slug,
          image.suggestedFilename,
          image.src,
          reserved,
        );
      }
      reserved.add(finalFilename);
      if (finalFilename !== image.src) {
        await copyProductionImage(
          body.slug,
          image.src,
          finalFilename,
        );
        copiedFilenames.push(finalFilename);
        renamedFrom.push(image.src);
      }
      finalImages.push({
        ...image,
        src: finalFilename,
        suggestedFilename: undefined,
      });
    }

    production.images = finalImages;
    const saved = await replaceProduction(production);
    if (!saved) {
      throw new Error("The production disappeared before the update could be committed.");
    }

    for (const oldFilename of renamedFrom) {
      await deleteProductionImage(
        body.slug,
        oldFilename,
      ).catch((cleanupError) => {
        console.error("Old production R2 image cleanup failed:", cleanupError);
      });
    }

    let directorySync:
      Awaited<ReturnType<typeof rememberDirectoryCredits>> | null = null;
    let directoryWarning: string | null = null;
    try {
      directorySync = await rememberDirectoryCredits(saved.credits);
    } catch (directoryError) {
      console.error("Directory sync failed:", directoryError);
      directoryWarning = directoryError instanceof Error
        ? directoryError.message
        : "The global website directory could not be updated.";
    }

    return Response.json({
      ok: true,
      message: "Production updated successfully.",
      production: {
        ...saved,
        accessPassword:
          saved.access === "password" && saved.accessPasswordEncrypted
            ? decryptProductionPassword(saved.accessPasswordEncrypted)
            : "",
      },
      directorySync,
      directoryWarning,
    });
  } catch (error) {
    if (activeSlug) {
      for (const filename of copiedFilenames) {
        await deleteProductionImage(
          activeSlug,
          filename,
        ).catch(() => undefined);
      }
    }
    console.error("Production update failed:", error);
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : "The production could not be updated." },
      { status: 500 },
    );
  }
}
