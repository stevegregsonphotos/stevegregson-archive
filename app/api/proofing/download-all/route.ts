import fs from "node:fs";
import path from "node:path";
import { PassThrough } from "node:stream";

import { ZipArchive } from "archiver";
import { cookies } from "next/headers";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getProofingGalleryBySlug,
} from "../../../../lib/proofing/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const proofingImagesDirectory = path.join(
  process.cwd(),
  "data",
  "proofing-images",
);

function isSafeSegment(value: string) {
  return (
    value.length > 0 &&
    !value.includes("/") &&
    !value.includes("\\") &&
    value !== "." &&
    value !== ".."
  );
}

function safeFilename(
  originalFilename: string,
) {
  const base =
    originalFilename.replace(/\.[^.]+$/, "") ||
    "photograph";

  const safeBase = base
    .replace(/[\r\n"\\/]/g, "")
    .trim();

  return `${safeBase || "photograph"}.webp`;
}

function safeZipFilename(value: string) {
  const safeValue = value
    .replace(/[\r\n"\\/]/g, "")
    .trim();

  return `${safeValue || "photographs"}.zip`;
}

export async function GET(
  request: NextRequest,
) {
  const gallerySlug =
    request.nextUrl.searchParams
      .get("gallery")
      ?.trim() ?? "";

  if (!isSafeSegment(gallerySlug)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid download request.",
      },
      { status: 400 },
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
      { status: 404 },
    );
  }

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
          "This gallery is not available for downloads.",
      },
      { status: 403 },
    );
  }

  if (gallery.downloadPermission === "none") {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Downloads are not enabled for this gallery.",
      },
      { status: 403 },
    );
  }

  const cookieStore = await cookies();

  const expectedCookieName =
    `proofing_${gallery.id}`;

  const visitorId =
    cookieStore.get(
      expectedCookieName,
    )?.value;

  if (!visitorId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Please enter the gallery before downloading photographs.",
      },
      { status: 401 },
    );
  }

  const visitor =
    gallery.visitors?.find(
      (candidate) =>
        candidate.id === visitorId,
    );

  if (!visitor) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Your gallery session could not be found.",
      },
      { status: 401 },
    );
  }

  const imagesToDownload =
    gallery.downloadPermission === "selected"
      ? gallery.images.filter((image) =>
          visitor.selection.favourites.some(
            (favourite) =>
              favourite.imageId === image.id,
          ),
        )
      : gallery.images;

  if (imagesToDownload.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message:
          gallery.downloadPermission === "selected"
            ? "Select at least one photograph before downloading."
            : "There are no photographs to download.",
      },
      { status: 400 },
    );
  }

  for (const image of imagesToDownload) {
    if (!isSafeSegment(image.webFilename)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "One or more image filenames are invalid.",
        },
        { status: 400 },
      );
    }

    const imagePath = path.join(
      proofingImagesDirectory,
      gallery.id,
      image.webFilename,
    );

    try {
      await fs.promises.access(imagePath);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          message:
            "One or more photographs could not be downloaded.",
        },
        { status: 404 },
      );
    }
  }

  const output = new PassThrough();

  const archive = new ZipArchive({
    zlib: {
      level: 6,
    },
  });

  archive.pipe(output);

  const usedNames = new Map<string, number>();

  for (const image of imagesToDownload) {
    const imagePath = path.join(
      proofingImagesDirectory,
      gallery.id,
      image.webFilename,
    );

    const initialName = safeFilename(
      image.originalFilename,
    );

    const previousCount =
      usedNames.get(initialName) ?? 0;

    usedNames.set(
      initialName,
      previousCount + 1,
    );

    const archiveName =
      previousCount === 0
        ? initialName
        : initialName.replace(
            /\.webp$/,
            `-${previousCount + 1}.webp`,
          );

    archive.file(imagePath, {
      name: archiveName,
    });
  }

  const archiveComplete = new Promise<void>(
    (resolve, reject) => {
      output.on("end", resolve);
      output.on("error", reject);
      archive.on("error", reject);
    },
  );

  const chunks: Buffer[] = [];

  output.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });

  await archive.finalize();
  await archiveComplete;

  const zipBuffer = Buffer.concat(chunks);

  const galleryName =
    "name" in gallery &&
    typeof gallery.name === "string"
      ? gallery.name
      : gallerySlug;

  const filename = safeZipFilename(
    gallery.downloadPermission === "selected"
      ? `${galleryName}-selected`
      : galleryName,
  );

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition":
        `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
