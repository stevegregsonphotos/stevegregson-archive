import {
  prepareCuratedProduction,
} from "@/lib/curated-archive/prepare-production";
import {
  publishImageBuffer,
} from "@/lib/publishing/publish-image";
import {
  publishProduction,
} from "@/lib/publishing/publish-production";

import fs from "node:fs/promises";
import path from "node:path";

export class CuratedProductionNotFoundError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "CuratedProductionNotFoundError";
  }
}

export class CuratedProductionNotReadyError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "CuratedProductionNotReadyError";
  }
}

export async function publishCuratedProduction(
  folder: string,
) {
  const prepared =
    await prepareCuratedProduction(
      folder,
    );

  if (!prepared) {
    throw new CuratedProductionNotFoundError(
      "Curated production was not found.",
    );
  }

  if (
    prepared.status !== "ready" ||
    !prepared.payload
  ) {
    throw new CuratedProductionNotReadyError(
      prepared.issues.length > 0
        ? prepared.issues.join(" ")
        : `Curated production is not ready to publish (${prepared.status}).`,
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

  const result =
    await publishProduction(
      prepared.payload,
      async (
        sourceFilepath,
        outputFilename,
        destinationDirectory,
      ) => {
        const image =
          imageByStagedFile.get(
            sourceFilepath,
          );

        if (!image) {
          throw new Error(
            `Curated image "${sourceFilepath}" is not part of the prepared selection.`,
          );
        }

        const resolvedStagingRoot =
          path.resolve(
            prepared.stagedDirectory,
          );

        const resolvedImagePath =
          path.resolve(
            image.absolutePath,
          );

        if (
          !resolvedImagePath.startsWith(
            `${resolvedStagingRoot}${path.sep}`,
          )
        ) {
          throw new Error(
            `Curated image "${sourceFilepath}" falls outside the staging directory.`,
          );
        }

        const sourceBuffer =
          await fs.readFile(
            resolvedImagePath,
          );

        return publishImageBuffer(
          sourceBuffer,
          sourceFilepath,
          outputFilename,
          destinationDirectory,
        );
      },
    );

  return {
    prepared,
    result,
  };
}
