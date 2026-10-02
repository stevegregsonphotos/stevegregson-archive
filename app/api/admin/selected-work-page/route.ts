import { revalidatePath } from "next/cache";

import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import { getCommissionsPicturesForEditor } from "../../../../lib/commissions-pictures";
import {
  getProductionCardImageUrl,
  getProductionImageUrl,
} from "../../../../lib/production-image-url";
import {
  getProduction,
  getProductionIndex,
} from "../../../../lib/productions-repository";
import {
  getSelectedWorkDisplayUrl,
  getSelectedWorkImageUrl,
} from "../../../../lib/selected-work-image-url";
import {
  cleanCommissionsImages,
  cleanSelectedWorkPage,
} from "../../../../lib/selected-work-page";
import {
  getSelectedWorkPage,
  saveCommissionsImages,
  saveSelectedWorkPage,
} from "../../../../lib/selected-work-page-repository";
import { getSelectedWork } from "../../../../lib/selected-work-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Backstage: the Selected Work (production) page and the Commissions page
 * images.
 *   GET                      current page, Commissions pictures, production list
 *   GET ?production=<slug>   that production's photographs, to add from
 *   GET ?library=1           the Selected Work photo library, to add from
 *   PUT { page }             save the Selected Work page
 *   PUT { commissions }      save the Commissions page pictures
 */

export async function GET(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  const url = new URL(request.url);
  const productionSlug = url.searchParams.get("production");

  try {
    if (productionSlug) {
      const production = await getProduction(productionSlug);

      if (!production) {
        return Response.json({ ok: false, error: "Production not found." }, { status: 404 });
      }

      const files = [
        { src: production.hero, alt: production.heroAlt },
        ...production.images.map((image) => ({ src: image.src, alt: image.alt })),
      ].filter((image, index, all) => image.src && all.findIndex((other) => other.src === image.src) === index);

      return Response.json({
        ok: true,
        production: {
          slug: production.slug,
          title: production.title,
          venue: production.venue,
          year: production.year,
        },
        images: files.map((image) => ({
          src: getProductionImageUrl(production.slug, image.src),
          smallSrc: getProductionCardImageUrl(production.slug, image.src),
          alt: image.alt || production.title,
        })),
      });
    }

    if (url.searchParams.get("library")) {
      const library = await getSelectedWork();
      const images = (["production", "rehearsal", "campaign"] as const).flatMap((category) =>
        library[category].map((image) => ({
          src: getSelectedWorkImageUrl(category, image.filename),
          smallSrc: getSelectedWorkDisplayUrl(category, image.filename),
          alt: image.alt,
          width: image.width ?? 0,
          height: image.height ?? 0,
          category,
        })),
      );

      return Response.json({ ok: true, images });
    }

    const [{ page, saved }, commissions, productions] = await Promise.all([
      getSelectedWorkPage(),
      getCommissionsPicturesForEditor(),
      getProductionIndex(),
    ]);

    return Response.json({
      ok: true,
      page,
      saved,
      commissions,
      productions: productions.map((production) => ({
        slug: production.slug,
        title: production.title,
        venue: production.venue,
        year: production.year,
      })),
    });
  } catch (error) {
    console.error("Selected Work page GET failed", error);
    return Response.json({ ok: false, error: "Could not load." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  try {
    const body = (await request.json()) as { page?: unknown; commissions?: unknown };

    if (body.page !== undefined) {
      const page = cleanSelectedWorkPage(body.page);

      if (!page) {
        return Response.json(
          { ok: false, error: "Something in the page list isn't valid, so nothing was saved." },
          { status: 400 },
        );
      }

      await saveSelectedWorkPage(page);
      revalidatePath("/selected-work");
      return Response.json({ ok: true, page });
    }

    if (body.commissions !== undefined) {
      const commissions = cleanCommissionsImages(body.commissions);

      if (!commissions) {
        return Response.json(
          { ok: false, error: "One of the Commissions pictures isn't valid, so nothing was saved." },
          { status: 400 },
        );
      }

      await saveCommissionsImages(commissions);
      revalidatePath("/commissions");
      return Response.json({ ok: true, commissions });
    }

    return Response.json({ ok: false, error: "Nothing to save." }, { status: 400 });
  } catch (error) {
    console.error("Selected Work page PUT failed", error);
    return Response.json({ ok: false, error: "Could not save. Please try again." }, { status: 500 });
  }
}
