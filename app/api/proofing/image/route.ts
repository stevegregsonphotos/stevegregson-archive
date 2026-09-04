import sharp from "sharp";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  getProofingGalleryBySlug,
} from "../../../../lib/proofing/repository";

import { getProofingImage } from "../../../../lib/proofing/image-storage";
import {
  getProofingWatermark,
} from "../../../../lib/proofing/watermarks";

import {
  getProofingWatermarkFile,
} from "../../../../lib/proofing/watermark-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isSafeSegment(value: string) {
  return (
    value.length > 0 &&
    !value.includes("/") &&
    !value.includes("\\") &&
    value !== "." &&
    value !== ".."
  );
}

function watermarkPlacement(
  position:
    | "top-left"
    | "top-center"
    | "top-right"
    | "center-left"
    | "center"
    | "center-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right",
  imageWidth: number,
  imageHeight: number,
  watermarkWidth: number,
  watermarkHeight: number,
) {
  const margin = Math.max(
    20,
    Math.round(
      Math.min(imageWidth, imageHeight) * 0.04,
    ),
  );

  const left = {
    left: margin,
    center: Math.round(
      (imageWidth - watermarkWidth) / 2,
    ),
    right:
      imageWidth -
      watermarkWidth -
      margin,
  };

  const top = {
    top: margin,
    center: Math.round(
      (imageHeight - watermarkHeight) / 2,
    ),
    bottom:
      imageHeight -
      watermarkHeight -
      margin,
  };

  switch (position) {
    case "top-left":
      return {
        left: left.left,
        top: top.top,
      };

    case "top-center":
      return {
        left: left.center,
        top: top.top,
      };

    case "top-right":
      return {
        left: left.right,
        top: top.top,
      };

    case "center-left":
      return {
        left: left.left,
        top: top.center,
      };

    case "center":
      return {
        left: left.center,
        top: top.center,
      };

    case "center-right":
      return {
        left: left.right,
        top: top.center,
      };

    case "bottom-left":
      return {
        left: left.left,
        top: top.bottom,
      };

    case "bottom-center":
      return {
        left: left.center,
        top: top.bottom,
      };

    case "bottom-right":
    default:
      return {
        left: left.right,
        top: top.bottom,
      };
  }
}

export async function GET(request: NextRequest) {
  const gallerySlug =
    request.nextUrl.searchParams
      .get("gallery")
      ?.trim() ?? "";

  const imageId =
    request.nextUrl.searchParams
      .get("image")
      ?.trim() ?? "";

  if (
    !isSafeSegment(gallerySlug) ||
    !isSafeSegment(imageId)
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid image request.",
      },
      {
        status: 400,
      },
    );
  }

  const gallery =
    await getProofingGalleryBySlug(gallerySlug);

  if (!gallery) {
    return NextResponse.json(
      {
        ok: false,
        message: "Gallery not found.",
      },
      {
        status: 404,
      },
    );
  }

  /*
   * Proof photographs must not bypass gallery
   * availability rules.
   */
  const hasExpiredByDate =
    Boolean(gallery.expiresAt) &&
    new Date(
      gallery.expiresAt as string,
    ).getTime() < Date.now();

  if (
    gallery.status !== "live" ||
    hasExpiredByDate
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "This gallery is not available.",
      },
      { status: 403 },
    );
  }

  /*
   * A valid visitor session is required for
   * photographs inside the gallery.
   *
   * The one exception is the designated cover
   * photograph, which must be visible on the
   * email-entry screen before a session exists.
   */
  const cookieStore = await cookies();

  const visitorId =
    cookieStore.get(
      `proofing_${gallery.id}`,
    )?.value;

  const visitor = visitorId
    ? gallery.visitors?.find(
        (candidate) =>
          candidate.id === visitorId,
      )
    : undefined;

  const isPublicCover =
    gallery.coverImageId === imageId;

  if (!visitor && !isPublicCover) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Please enter the gallery to view this photograph.",
      },
      { status: 401 },
    );
  }

  const image = gallery.images.find(
    (candidate) => candidate.id === imageId,
  );

  if (!image) {
    return NextResponse.json(
      {
        ok: false,
        message: "Image not found.",
      },
      {
        status: 404,
      },
    );
  }

  if (!isSafeSegment(image.webFilename)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid image filename.",
      },
      {
        status: 400,
      },
    );
  }

    try {
      const file = await getProofingImage(
        gallery.id,
        image.webFilename,
      );

    /*
     * No watermark selected:
     * return the stored web proof unchanged.
     */
    if (
      !gallery.watermarkEnabled ||
      !gallery.watermarkId
    ) {
      return new NextResponse(file, {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control":
            "private, no-store",
        },
      });
    }

    const watermark =
      await getProofingWatermark(
        gallery.watermarkId,
      );

    if (!watermark) {
      return new NextResponse(file, {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control":
            "private, no-store",
        },
      });
    }

    const watermarkFile =
      await getProofingWatermarkFile(
        watermark.filename,
      );

    const baseImage = sharp(file);

    const baseMetadata =
      await baseImage.metadata();

    if (
      !baseMetadata.width ||
      !baseMetadata.height
    ) {
      throw new Error(
        "Could not read proof dimensions.",
      );
    }

    const sizePercent =
      gallery.watermarkSize ?? 30;

    const opacityPercent =
      gallery.watermarkOpacity ?? 65;

    const position =
      gallery.watermarkPosition ??
      "bottom-right";

    /*
     * Width is relative to the photograph.
     * Keep the watermark within sensible bounds.
     */
    const targetWidth = Math.max(
      40,
      Math.round(
        baseMetadata.width *
          (sizePercent / 100),
      ),
    );

    const resizedWatermark =
      await sharp(watermarkFile)
        .resize({
          width: targetWidth,
          withoutEnlargement: false,
        })
        .ensureAlpha()
        .linear(
          1,
          0,
        )
        .toBuffer();

    const watermarkMetadata =
      await sharp(
        resizedWatermark,
      ).metadata();

    if (
      !watermarkMetadata.width ||
      !watermarkMetadata.height
    ) {
      throw new Error(
        "Could not read watermark dimensions.",
      );
    }

    /*
     * Preserve the PNG's original transparency and
     * adjust only its existing alpha values.
     *
     * Flattening/removing alpha here would create a
     * black rectangle around transparent watermarks.
     */
    const {
      data: watermarkPixels,
      info: watermarkPixelInfo,
    } = await sharp(resizedWatermark)
      .ensureAlpha()
      .raw()
      .toBuffer({
        resolveWithObject: true,
      });

    const opacity =
      opacityPercent / 100;

    for (
      let index = 3;
      index < watermarkPixels.length;
      index += 4
    ) {
      watermarkPixels[index] =
        Math.round(
          watermarkPixels[index] * opacity,
        );
    }

    const colour =
      await sharp(
        watermarkPixels,
        {
          raw: {
            width: watermarkPixelInfo.width,
            height: watermarkPixelInfo.height,
            channels: 4,
          },
        },
      )
        .png()
        .toBuffer();

    const placement =
      watermarkPlacement(
        position,
        baseMetadata.width,
        baseMetadata.height,
        watermarkMetadata.width,
        watermarkMetadata.height,
      );

    const output =
      await sharp(file)
        .composite([
          {
            input: colour,
            left: Math.max(
              0,
              placement.left,
            ),
            top: Math.max(
              0,
              placement.top,
            ),
          },
        ])
        .webp({
          quality: 82,
          effort: 4,
        })
        .toBuffer();

    return new NextResponse(output, {
      headers: {
        "Content-Type": "image/webp",
        /*
         * Watermark settings can change at any time,
         * so don't let an old clean/watermarked image
         * remain cached in the browser.
         */
        "Cache-Control":
          "private, no-store",
      },
    });
  } catch (error) {
    console.error(
      "Proofing image delivery failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "Image file could not be read.",
      },
      {
        status: 404,
      },
    );
  }
}
