import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  prepareCuratedProduction,
} from "@/lib/curated-archive/prepare-production";
import {
  createCuratedImportDownloadUrl,
  materializeCuratedImport,
} from "@/lib/curated-archive/staging";
import {
  createProductionImageUploadUrl,
} from "@/lib/publishing/production-image-storage";
import {
  createWebFilename,
  finalizePublishedProduction,
  ProductionConflictError,
  type PublishedImageMetadata,
} from "@/lib/publishing/publish-production";
import {
  productionExists,
} from "@/lib/productions-repository";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublishRequest = {
  action?: unknown;
  folder?: unknown;
  slug?: unknown;
  sourceRelativePath?: unknown;
  outputFilename?: unknown;
  heroAsset?: unknown;
  galleryAssets?: unknown;
};

function stringValue(
  value: unknown,
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isPublishedImageMetadata(
  value: unknown,
): value is PublishedImageMetadata {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  return (
    typeof candidate.sourceFilepath === "string" &&
    Boolean(candidate.sourceFilepath.trim()) &&
    typeof candidate.filename === "string" &&
    Boolean(candidate.filename.trim()) &&
    typeof candidate.blurDataURL === "string" &&
    candidate.blurDataURL.startsWith(
      "data:image/webp;base64,",
    )
  );
}

async function getPrepared(
  folder: string,
) {
  const curationRoot =
    await materializeCuratedImport();

  if (!curationRoot) {
    throw new Error(
      "Choose a curated folder before publishing.",
    );
  }

  const prepared =
    await prepareCuratedProduction(
      folder,
      curationRoot,
    );

  if (
    !prepared ||
    prepared.status !== "ready" ||
    !prepared.payload
  ) {
    throw new Error(
      prepared?.issues.length
        ? prepared.issues.join(" ")
        : "Curated production is not ready to publish.",
    );
  }

  return prepared;
}

export async function POST(
  request: Request,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  let body: PublishRequest;

  try {
    body =
      (await request.json()) as PublishRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid request.",
      },
      { status: 400 },
    );
  }

  const action =
    stringValue(body.action);
  const folder =
    stringValue(body.folder);

  if (!folder) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Curated folder is required.",
      },
      { status: 400 },
    );
  }

  try {
    if (action === "prepare") {
      const prepared =
        await getPrepared(folder);
      const payload = prepared.payload;

      if (!payload) {
        throw new Error(
          "Curated production payload is missing.",
        );
      }

      if (
        await productionExists(
          payload.slug,
        )
      ) {
        throw new ProductionConflictError(
          `A production already exists for "${payload.slug}".`,
        );
      }

      const imageByStagedFile =
        new Map(
          prepared.images.map(
            (image) => [
              image.stagedFile,
              image,
            ],
          ),
        );

      const heroSource =
        imageByStagedFile.get(
          payload.hero.filepath,
        );

      if (
        !heroSource?.stagedRelativePath
      ) {
        throw new Error(
          "The curated hero image is not available in direct R2 staging.",
        );
      }

      const jobs = [
        {
          kind: "hero" as const,
          sourceFilepath:
            payload.hero.filepath,
          sourceRelativePath:
            heroSource.stagedRelativePath,
          outputFilename:
            createWebFilename(
              payload.hero.filename,
              "hero",
            ),
        },
        ...payload.images.map(
          (image, index) => {
            const source =
              imageByStagedFile.get(
                image.filepath,
              );

            if (
              !source?.stagedRelativePath
            ) {
              throw new Error(
                `Curated image "${image.filepath}" is not available in direct R2 staging.`,
              );
            }

            return {
              kind: "gallery" as const,
              sourceFilepath:
                image.filepath,
              sourceRelativePath:
                source.stagedRelativePath,
              outputFilename:
                createWebFilename(
                  image.filename,
                  String(index + 1).padStart(
                    2,
                    "0",
                  ),
                ),
            };
          },
        ),
      ];

      return NextResponse.json({
        ok: true,
        folder,
        title: payload.title,
        slug: payload.slug,
        totalImages: jobs.length,
        jobs,
      });
    }

    if (action === "sign-image") {
      const slug =
        stringValue(body.slug);
      const sourceRelativePath =
        stringValue(
          body.sourceRelativePath,
        );
      const outputFilename =
        stringValue(
          body.outputFilename,
        );

      if (
        !slug ||
        !sourceRelativePath ||
        !outputFilename
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Incomplete image signing request.",
          },
          { status: 400 },
        );
      }

      const folderToken =
        folder.replace(/[^a-zA-Z0-9]+/g, " ")
          .trim()
          .toLowerCase();
      const sourceToken =
        sourceRelativePath
          .replace(/[^a-zA-Z0-9]+/g, " ")
          .trim()
          .toLowerCase();

      if (
        folderToken &&
        !sourceToken.includes(folderToken)
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "The staged image does not belong to this curated folder.",
          },
          { status: 400 },
        );
      }

      return NextResponse.json({
        ok: true,
        sourceUrl:
          await createCuratedImportDownloadUrl(
            sourceRelativePath,
          ),
        uploadUrl:
          await createProductionImageUploadUrl(
            slug,
            outputFilename,
          ),
      });
    }

    if (action === "finalize") {
      const prepared =
        await getPrepared(folder);
      const payload = prepared.payload;

      if (!payload) {
        throw new Error(
          "Curated production payload is missing.",
        );
      }

      const heroAsset =
        body.heroAsset;
      const galleryAssets =
        body.galleryAssets;

      if (
        !isPublishedImageMetadata(
          heroAsset,
        ) ||
        !Array.isArray(
          galleryAssets,
        ) ||
        !galleryAssets.every(
          isPublishedImageMetadata,
        )
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Published image metadata is incomplete.",
          },
          { status: 400 },
        );
      }

      const expectedHeroFilename =
        createWebFilename(
          payload.hero.filename,
          "hero",
        );

      if (
        heroAsset.sourceFilepath !==
          payload.hero.filepath ||
        heroAsset.filename !==
          expectedHeroFilename
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Published hero metadata does not match the curated selection.",
          },
          { status: 409 },
        );
      }

      if (
        galleryAssets.length !==
        payload.images.length
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Published gallery metadata does not match the curated selection.",
          },
          { status: 409 },
        );
      }

      for (
        let index = 0;
        index < payload.images.length;
        index += 1
      ) {
        const expected =
          payload.images[index];
        const actual =
          galleryAssets[index];
        const expectedFilename =
          createWebFilename(
            expected.filename,
            String(index + 1).padStart(
              2,
              "0",
            ),
          );

        if (
          actual.sourceFilepath !==
            expected.filepath ||
          actual.filename !==
            expectedFilename
        ) {
          return NextResponse.json(
            {
              ok: false,
              message:
                "Published gallery metadata does not match the curated selection.",
            },
            { status: 409 },
          );
        }
      }

      const result =
        await finalizePublishedProduction(
          payload,
          heroAsset,
          galleryAssets,
        );

      return NextResponse.json({
        ok: true,
        message:
          `${payload.title} was published from the curated archive.`,
        ...result,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          "Unknown publish action.",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error(
      "Curated production publishing failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "The curated production could not be published.",
      },
      {
        status:
          error instanceof
          ProductionConflictError
            ? 409
            : 500,
      },
    );
  }
}
