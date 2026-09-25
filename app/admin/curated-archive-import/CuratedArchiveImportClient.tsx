"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  analyseImageAutoCorrection,
  renderEditedImage,
  type ImageEditorSettings,
} from "@/lib/client-image-editor";

type ExistingProduction = {
  slug: string;
  title: string;
  month: number | null;
  year: number;
};

type CuratedArchiveImportClientProps = {
  existingProductions: ExistingProduction[];
};

type PreflightProduction = {
  folder: string;
  folders?: string[];
  sourceProductions?: string[];
  production: string;
  title: string;
  venue: string;
  month: number | null;
  year: number | null;
  description: string;
  selectedCount: number;
  heroIndex: number | null;
  excluded: boolean;
  locked: boolean;
  automaticLocked: boolean;
  accessOverride:
    | "public"
    | "password"
    | null;
  accessSource:
    | "automatic"
    | "manual";
  existingSlug: string | null;
  status:
    | "ready"
    | "excluded"
    | "existing"
    | "attention";
  issues: string[];
};

type PreflightResponse = {
  ok: boolean;
  summary: {
    total: number;
    ready: number;
    excluded: number;
    existing: number;
    attention: number;
    locked: number;
  };
  productions: PreflightProduction[];
};

type StatusFilter =
  | "all"
  | "locked"
  | PreflightProduction["status"];

const MONTHS = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const CURATED_IMPORT_SESSION_KEY =
  "stevegregson_curated_import_preflight";

type CuratedPublishJob = {
  kind: "hero" | "gallery";
  sourceFilepath: string;
  sourceRelativePath: string;
  outputFilename: string;
  editSettings?: ImageEditorSettings;
};

type CuratedPublishedAsset = {
  sourceFilepath: string;
  filename: string;
  blurDataURL: string;
};

type CuratedPreflightIndexImage = {
  index?: number;
  hero?: boolean;
  stagedFile?: string;
  sourcePath?: string;
  sourceFolder?: string;
  sourceRootId?: string;
  sourceRootPath?: string;
};

type CuratedPreflightIndexProduction = {
  folder: string;
  production: string;
  source?: unknown;
  sourceBoundary?: unknown;
  hero?: number;
  selectedCount?: number;
  images: CuratedPreflightIndexImage[];
  metadata: Record<string, string>;
};

type CuratedPreflightIndex = {
  version: 1;
  generatedAt: string;
  productions: CuratedPreflightIndexProduction[];
};

function normalisePreflightProductionName(
  value: string,
) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[—–−]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parsePreflightMetadata(
  text: string,
) {
  const result: Record<string, string> = {};

  for (
    const rawLine
    of text.split(/\r?\n/)
  ) {
    const line =
      rawLine.trim();

    if (!line) {
      continue;
    }

    const separator =
      line.indexOf(":");

    if (separator === -1) {
      continue;
    }

    const key =
      line
        .slice(0, separator)
        .trim();

    const value =
      line
        .slice(separator + 1)
        .trim();

    if (key) {
      result[key] = value;
    }
  }

  return result;
}

async function preparePublishedImage(
  sourceBlob: Blob,
  sourceFilepath: string,
  outputFilename: string,
  editSettings?: ImageEditorSettings,
): Promise<{
  blob: Blob;
  asset: CuratedPublishedAsset;
}> {
  const objectUrl =
    URL.createObjectURL(sourceBlob);

  try {
    const image = new Image();

    await new Promise<void>(
      (resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () =>
          reject(
            new Error(
              `Could not prepare ${sourceFilepath} for publishing.`,
            ),
          );
        image.src = objectUrl;
      },
    );

    let canvas: HTMLCanvasElement;
    let blob: Blob;

    if (editSettings) {
      const edited =
        await renderEditedImage(
          image,
          editSettings,
          {
            maxDimension: 2560,
            quality: 0.82,
          },
          analyseImageAutoCorrection(
            image,
          ),
        );

      blob = edited.blob;
      canvas =
        document.createElement("canvas");
      canvas.width = edited.width;
      canvas.height = edited.height;

      const editedImage = new Image();
      const editedUrl =
        URL.createObjectURL(blob);

      try {
        await new Promise<void>(
          (resolve, reject) => {
            editedImage.onload = () => resolve();
            editedImage.onerror = () =>
              reject(
                new Error(
                  `Could not prepare edited ${sourceFilepath} for publishing.`,
                ),
              );
            editedImage.src = editedUrl;
          },
        );

        const context =
          canvas.getContext("2d");

        if (!context) {
          throw new Error(
            `Could not prepare ${sourceFilepath} for publishing.`,
          );
        }

        context.drawImage(
          editedImage,
          0,
          0,
          canvas.width,
          canvas.height,
        );
      } finally {
        URL.revokeObjectURL(
          editedUrl,
        );
      }
    } else {
      const scale = Math.min(
        1,
        2560 /
          Math.max(
            image.naturalWidth,
            image.naturalHeight,
          ),
      );

      const width = Math.max(
        1,
        Math.round(
          image.naturalWidth * scale,
        ),
      );
      const height = Math.max(
        1,
        Math.round(
          image.naturalHeight * scale,
        ),
      );

      canvas =
        document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context =
        canvas.getContext("2d");

      if (!context) {
        throw new Error(
          `Could not prepare ${sourceFilepath} for publishing.`,
        );
      }

      context.drawImage(
        image,
        0,
        0,
        width,
        height,
      );

      blob =
        await new Promise<Blob>(
          (resolve, reject) => {
            canvas.toBlob(
              (result) => {
                if (result) {
                  resolve(result);
                } else {
                  reject(
                    new Error(
                      `Could not create ${outputFilename}.`,
                    ),
                  );
                }
              },
              "image/webp",
              0.82,
            );
          },
        );
    }

    const width = canvas.width;
    const height = canvas.height;

    const blurCanvas =
      document.createElement("canvas");
    const blurWidth = 24;
    const blurScale =
      blurWidth / width;
    blurCanvas.width = blurWidth;
    blurCanvas.height = Math.max(
      1,
      Math.round(
        height * blurScale,
      ),
    );

    const blurContext =
      blurCanvas.getContext("2d");

    if (!blurContext) {
      throw new Error(
        `Could not prepare blur placeholder for ${sourceFilepath}.`,
      );
    }

    blurContext.drawImage(
      canvas,
      0,
      0,
      blurCanvas.width,
      blurCanvas.height,
    );

    const blurDataURL =
      blurCanvas.toDataURL(
        "image/webp",
        0.38,
      );

    return {
      blob,
      asset: {
        sourceFilepath,
        filename: outputFilename,
        blurDataURL,
      },
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function statusLabel(
  status: PreflightProduction["status"],
) {
  if (status === "ready") {
    return "Ready";
  }

  if (status === "excluded") {
    return "Excluded";
  }

  if (status === "existing") {
    return "Already published";
  }

  return "Needs attention";
}

export default function CuratedArchiveImportClient({
  existingProductions,
}: CuratedArchiveImportClientProps) {
  const [data, setData] =
    useState<PreflightResponse | null>(
      null,
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [uploading, setUploading] =
    useState(false);

  const [
    uploadProgressText,
    setUploadProgressText,
  ] = useState("");

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [
    changingAccess,
    setChangingAccess,
  ] = useState<string | null>(null);

  const [
    importingProduction,
    setImportingProduction,
  ] = useState<string | null>(null);

  const [
    importProgressText,
    setImportProgressText,
  ] = useState("");

  const [
    batchImporting,
    setBatchImporting,
  ] = useState(false);

  const [
    selectedReadyFolders,
    setSelectedReadyFolders,
  ] = useState<string[]>([]);

  const [
    batchProgress,
    setBatchProgress,
  ] = useState<{
    current: number;
    total: number;
    title: string;
  } | null>(null);

  const [
    batchResult,
    setBatchResult,
  ] = useState<{
    imported: number;
    failed: Array<{
      title: string;
      message: string;
    }>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let restoredData:
      PreflightResponse | null = null;

    try {
      const saved =
        window.sessionStorage.getItem(
          CURATED_IMPORT_SESSION_KEY,
        );

      if (saved) {
        const parsed =
          JSON.parse(
            saved,
          ) as PreflightResponse;

        if (
          parsed?.ok &&
          parsed.summary &&
          Array.isArray(
            parsed.productions,
          )
        ) {
          restoredData = parsed;
          setData(parsed);
        }
      }
    } catch {}

    async function loadExistingPreflight() {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            "/api/admin/curated-archive-import/preflight",
            {
              cache: "no-store",
            },
          );

        const result =
          (await response.json()) as
            | PreflightResponse
            | {
                ok?: boolean;
                message?: string;
              };

        if (
          !response.ok ||
          !result.ok ||
          !("summary" in result) ||
          !("productions" in result)
        ) {
          throw new Error(
            "message" in result &&
              result.message
              ? result.message
              : "Curated archive preflight failed.",
          );
        }

        if (!cancelled) {
          if (
            result.summary.total === 0 &&
            restoredData &&
            restoredData.summary.total > 0
          ) {
            setData(restoredData);
          } else {
            setData(result);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? `Preflight failed: ${loadError.message}`
              : "Preflight failed: Curated archive preflight failed.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadExistingPreflight();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!data) {
      return;
    }

    try {
      window.sessionStorage.setItem(
        CURATED_IMPORT_SESSION_KEY,
        JSON.stringify(data),
      );
    } catch {}
  }, [data]);

  useEffect(() => {
    if (!data) {
      setSelectedReadyFolders([]);
      return;
    }

    const readyFolders =
      new Set(
        data.productions
          .filter(
            (production) =>
              production.status === "ready",
          )
          .map(
            (production) =>
              production.folder,
          ),
      );

    setSelectedReadyFolders(
      (current) =>
        current.filter(
          (folder) =>
            readyFolders.has(folder),
        ),
    );
  }, [data]);

  async function uploadCuratedFolder(
    files: FileList | null,
  ) {
    if (!files || files.length === 0) {
      return;
    }

    setUploading(true);
    setError("");
    setBatchResult(null);
    setData(null);

    try {
      window.sessionStorage.removeItem(
        CURATED_IMPORT_SESSION_KEY,
      );
    } catch {}

    try {
      const selectedFiles =
        Array.from(files);

      const firstRelativePath =
        selectedFiles[0]
          .webkitRelativePath;

      const folderName =
        firstRelativePath
          ? firstRelativePath.split("/")[0]
          : "curated-production";

      const packageFiles =
        selectedFiles.filter((file) => {
          const relativePath =
            (
              file.webkitRelativePath ||
              `${folderName}/${file.name}`
            ).replace(/\\/g, "/");

          const parts =
            relativePath
              .split("/")
              .filter(Boolean);

          if (parts.length < 2) {
            return false;
          }

          const pathInsideChosenRoot =
            parts.slice(1);

          const fileName =
            pathInsideChosenRoot.at(-1) ?? "";

          const selectedWebStagingIndex =
            pathInsideChosenRoot.indexOf(
              "selected-web-staging",
            );

          if (
            selectedWebStagingIndex >= 0 &&
            selectedWebStagingIndex <
              pathInsideChosenRoot.length - 1
          ) {
            return true;
          }

          return (
            fileName === "final-selection.json" ||
            fileName === "metadata-research.json" ||
            fileName === "metadata-proposed.txt"
          );
        });



      const rawPackagedPaths =
        packageFiles.map((file) =>
          (
            file.webkitRelativePath ||
            `${folderName}/${file.name}`
          ).replace(/\\/g, "/"),
        );

      /*
       * Directory selection always includes the chosen root
       * directory in webkitRelativePath.
       *
       * For a collection:
       *   Collection/Production/final-selection.json
       *
       * For one production:
       *   Production/final-selection.json
       *
       * R2 staging must always have Production as its top-level
       * directory, regardless of which of those two workflows
       * was used.
       */
      const isCollectionUpload =
        rawPackagedPaths.some(
          (relativePath) =>
            relativePath.endsWith(
              "/final-selection.json",
            ) &&
            relativePath
              .split("/")
              .filter(Boolean)
              .length >= 3,
        );

      function stagingRelativePath(
        relativePath: string,
      ) {
        const parts =
          relativePath
            .replace(/\\/g, "/")
            .split("/")
            .filter(Boolean);

        return (
          isCollectionUpload
            ? parts.slice(1)
            : parts
        ).join("/");
      }

      const packagedPaths =
        rawPackagedPaths.map(
          stagingRelativePath,
        );

      const finalSelections =
        packagedPaths.filter(
          (relativePath) =>
            relativePath.endsWith(
              "/final-selection.json",
            ),
        );

      const stagedImages =
        packagedPaths.filter(
          (relativePath) =>
            relativePath.includes(
              "/selected-web-staging/",
            ),
        );

      const metadataFiles =
        packagedPaths.filter(
          (relativePath) =>
            relativePath.endsWith(
              "/metadata-research.json",
            ) ||
            relativePath.endsWith(
              "/metadata-proposed.txt",
            ),
        );

      setUploadProgressText(
        `Found ${finalSelections.length.toLocaleString()} completed production${
          finalSelections.length === 1 ? "" : "s"
        }. Preparing ${packageFiles.length.toLocaleString()} authoritative files from ${selectedFiles.length.toLocaleString()} selected files…`,
      );

      if (
        finalSelections.length === 0 &&
        metadataFiles.length === 0
      ) {
        throw new Error(
          "Choose the main curated output folder, or an individual production folder containing curated selection or production metadata.",
        );
      }

      if (
        finalSelections.length > 0 &&
        stagedImages.length === 0
      ) {
        throw new Error(
          "A final selection was found, but no final curated images were found inside selected-web-staging.",
        );
      }

      async function readUploadResponse(
        response: Response,
        context: string,
      ) {
        let result: {
          ok?: boolean;
          message?: string;
          path?: string;
        };

        try {
          result =
            (await response.json()) as {
              ok?: boolean;
              message?: string;
              path?: string;
            };
        } catch (error) {
          throw new Error(
            `${context} response could not be read (${response.status}): ${
              error instanceof Error
                ? error.message
                : String(error)
            }`,
          );
        }

        if (!response.ok || !result.ok) {
          throw new Error(
            `${context} failed (${response.status}): ${
              result.message ||
              "Unknown staging error."
            }`,
          );
        }

        return result;
      }

      async function uploadDirectToR2(
        relativePath: string,
        contentType: string,
        body: BodyInit,
        cacheControl = "no-store",
      ) {
        const signingUrl =
          new URL(
            "/api/admin/curated-archive-import/upload",
            window.location.origin,
          );

        signingUrl.searchParams.set(
          "action",
          "presign",
        );
        signingUrl.searchParams.set(
          "relativePath",
          relativePath,
        );
        signingUrl.searchParams.set(
          "contentType",
          contentType,
        );

        let signingResponse:
          | Response
          | null = null;

        let signingError:
          unknown = null;

        for (
          let attempt = 1;
          attempt <= 5;
          attempt += 1
        ) {
          try {
            signingResponse =
              await fetch(
                signingUrl.toString(),
                {
                  method: "POST",
                },
              );

            if (
              signingResponse.ok ||
              (
                signingResponse.status < 500 &&
                signingResponse.status !== 429
              )
            ) {
              break;
            }

            signingError =
              new Error(
                `HTTP ${signingResponse.status}`,
              );
          } catch (error) {
            signingResponse = null;
            signingError = error;
          }

          if (attempt < 5) {
            await new Promise(
              (resolve) =>
                setTimeout(
                  resolve,
                  Math.min(
                    8000,
                    500 *
                      2 ** (attempt - 1),
                  ),
                ),
            );
          }
        }

        if (!signingResponse) {
          throw new Error(
            `Preparing R2 upload for "${relativePath}" failed after 5 attempts: ${
              signingError instanceof Error
                ? signingError.message
                : String(signingError)
            }`,
          );
        }

        const signed =
          await readUploadResponse(
            signingResponse,
            `Preparing R2 upload for "${relativePath}"`,
          ) as {
            ok: boolean;
            url?: string;
            path?: string;
          };

        if (!signed.url) {
          throw new Error(
            `No R2 upload URL was returned for "${relativePath}".`,
          );
        }

        let r2Response:
          | Response
          | null = null;
        let lastError:
          unknown = null;

        for (
          let attempt = 1;
          attempt <= 4;
          attempt += 1
        ) {
          try {
            r2Response =
              await fetch(
                signed.url,
                {
                  method: "PUT",
                  headers: {
                    "Content-Type":
                      contentType,
                    "Cache-Control":
                      cacheControl,
                  },
                  body,
                },
              );

            if (r2Response.ok) {
              break;
            }

            lastError =
              new Error(
                `HTTP ${r2Response.status}`,
              );
          } catch (error) {
            lastError = error;
          }

          if (attempt < 4) {
            await new Promise(
              (resolve) =>
                setTimeout(
                  resolve,
                  attempt * 1000,
                ),
            );
          }
        }

        if (!r2Response?.ok) {
          throw new Error(
            `Direct R2 upload failed for "${relativePath}" after 4 attempts: ${
              lastError instanceof Error
                ? lastError.message
                : String(lastError)
            }`,
          );
        }
      }

      /*
       * Build the compact preflight index from the files already
       * available in the browser. This keeps the eventual preflight
       * route from rediscovering hundreds of small R2 objects.
       */
      const fileByStagingPath =
        new Map(
          packageFiles.map(
            (file) => [
              stagingRelativePath(
                (
                  file.webkitRelativePath ||
                  `${folderName}/${file.name}`
                ).replace(/\\/g, "/"),
              ),
              file,
            ] as const,
          ),
        );

      const metadataFallbackByProduction =
        new Map<
          string,
          Record<string, string>
        >();

      const productionFolders =
        Array.from(
          new Set(
            finalSelections.map(
              (relativePath) =>
                relativePath.split("/")[0],
            ),
          ),
        );

      for (const folder of productionFolders) {
        const researchFile =
          fileByStagingPath.get(
            `${folder}/metadata-research.json`,
          );

        const proposedFile =
          fileByStagingPath.get(
            `${folder}/metadata-proposed.txt`,
          );

        if (
          !researchFile ||
          !proposedFile
        ) {
          continue;
        }

        try {
          const research =
            JSON.parse(
              await researchFile.text(),
            ) as {
              production?: unknown;
            };

          if (
            typeof research.production !==
              "string" ||
            !research.production.trim()
          ) {
            continue;
          }

          metadataFallbackByProduction.set(
            normalisePreflightProductionName(
              research.production,
            ),
            parsePreflightMetadata(
              await proposedFile.text(),
            ),
          );
        } catch {
          continue;
        }
      }

      const uploadedIndexProductions:
        CuratedPreflightIndexProduction[] =
        [];

      for (
        const finalSelectionPath
        of finalSelections
      ) {
        const folder =
          finalSelectionPath.split("/")[0];

        const finalSelectionFile =
          fileByStagingPath.get(
            finalSelectionPath,
          );

        if (!finalSelectionFile) {
          throw new Error(
            `Could not build preflight index for "${folder}": final-selection.json is missing from the browser package.`,
          );
        }

        let finalSelection: {
          production?: unknown;
          source?: unknown;
          sourceBoundary?: unknown;
          hero?: unknown;
          selectedCount?: unknown;
          images?: unknown;
        };

        try {
          finalSelection =
            JSON.parse(
              await finalSelectionFile.text(),
            ) as typeof finalSelection;
        } catch (error) {
          throw new Error(
            `Could not build preflight index for "${folder}": ${
              error instanceof Error
                ? error.message
                : String(error)
            }`,
          );
        }

        const production =
          typeof finalSelection.production ===
            "string" &&
          finalSelection.production.trim()
            ? finalSelection.production.trim()
            : folder;

        const proposedFile =
          fileByStagingPath.get(
            `${folder}/metadata-proposed.txt`,
          );

        let metadata:
          Record<string, string> = {};

        if (proposedFile) {
          metadata =
            parsePreflightMetadata(
              await proposedFile.text(),
            );
        } else {
          metadata =
            metadataFallbackByProduction.get(
              normalisePreflightProductionName(
                production,
              ),
            ) ?? {};
        }

        const images =
          Array.isArray(
            finalSelection.images,
          )
            ? finalSelection.images.flatMap(
                (value) => {
                  if (
                    !value ||
                    typeof value !==
                      "object"
                  ) {
                    return [];
                  }

                  const image =
                    value as Record<
                      string,
                      unknown
                    >;

                  const compact:
                    CuratedPreflightIndexImage =
                    {};

                  if (
                    typeof image.index ===
                    "number"
                  ) {
                    compact.index =
                      image.index;
                  }

                  if (
                    typeof image.hero ===
                    "boolean"
                  ) {
                    compact.hero =
                      image.hero;
                  }

                  for (
                    const key
                    of [
                      "stagedFile",
                      "sourcePath",
                      "sourceFolder",
                      "sourceRootId",
                      "sourceRootPath",
                    ] as const
                  ) {
                    if (
                      typeof image[key] ===
                      "string"
                    ) {
                      compact[key] =
                        image[key] as string;
                    }
                  }

                  return [compact];
                },
              )
            : [];

        uploadedIndexProductions.push({
          folder,
          production,
          ...(finalSelection.source !==
          undefined
            ? {
                source:
                  finalSelection.source,
              }
            : {}),
          ...(finalSelection.sourceBoundary !==
          undefined
            ? {
                sourceBoundary:
                  finalSelection.sourceBoundary,
              }
            : {}),
          ...(typeof finalSelection.hero ===
          "number"
            ? {
                hero:
                  finalSelection.hero,
              }
            : {}),
          ...(typeof finalSelection.selectedCount ===
          "number"
            ? {
                selectedCount:
                  finalSelection.selectedCount,
              }
            : {}),
          images,
          metadata,
        });
      }

      /*
       * Start with a clean temporary staging area.
       */
      const beginForm =
        new FormData();

      beginForm.set(
        "action",
        "begin",
      );

      const beginResponse =
        await fetch(
          "/api/admin/curated-archive-import/upload",
          {
            method: "POST",
            body: beginForm,
          },
        );

      await readUploadResponse(
        beginResponse,
        "Starting curated folder upload",
      );

      /*
       * Upload only the authoritative files.
       *
       * Four requests at a time keeps the transfer
       * reasonably quick without creating one enormous
       * request or browser-generated ZIP.
       */
      const concurrency = 4;

      for (
        let index = 0;
        index < packageFiles.length;
        index += concurrency
      ) {
        const batch =
          packageFiles.slice(
            index,
            index + concurrency,
          );

        await Promise.all(
          batch.map(
            async (file) => {
              const relativePath =
                stagingRelativePath(
                  (
                    file.webkitRelativePath ||
                    `${folderName}/${file.name}`
                  ).replace(/\\/g, "/"),
                );

              const contentType =
                file.type ||
                "application/octet-stream";

              await uploadDirectToR2(
                relativePath,
                contentType,
                file,
              );
            },
          ),
        );

        setUploadProgressText(
          `Uploaded ${Math.min(index + batch.length, packageFiles.length).toLocaleString()} of ${packageFiles.length.toLocaleString()} authoritative files…`,
        );
      }

      /*
       * Commit the completed set only after every file
       * has arrived successfully.
       */
      const finalizeForm =
        new FormData();

      finalizeForm.set(
        "action",
        "finalize",
      );

      finalizeForm.set(
        "relativePaths",
        JSON.stringify(
          packagedPaths,
        ),
      );

      finalizeForm.set(
        "mode",
        isCollectionUpload
          ? "replace"
          : "additive",
      );

      finalizeForm.set(
        "expectedFinalSelectionCount",
        String(
          finalSelections.length,
        ),
      );

      const finalizeResponse =
        await fetch(
          "/api/admin/curated-archive-import/upload",
          {
            method: "POST",
            body: finalizeForm,
          },
        );

      const finalizeResult =
        await readUploadResponse(
          finalizeResponse,
          "Finalizing curated folder upload",
        ) as {
          ok: boolean;
          stagedFileCount?: number;
          finalSelectionCount?: number;
        };

      if (
        finalizeResult.finalSelectionCount !==
        finalSelections.length
      ) {
        throw new Error(
          `Finalization safety check failed: browser expected ${finalSelections.length.toLocaleString()} final selections but R2 committed ${Number(
            finalizeResult.finalSelectionCount ?? 0,
          ).toLocaleString()}. The staged collection was not accepted.`,
        );
      }

      let indexProductions =
        uploadedIndexProductions;

      if (!isCollectionUpload) {
        const signingResponse =
          await fetch(
            "/api/admin/curated-archive-import/upload?action=preflight-index-read",
            {
              method: "POST",
            },
          );

        const signingResult =
          await readUploadResponse(
            signingResponse,
            "Preparing existing preflight index read",
          ) as {
            ok: boolean;
            url?: string;
          };

        let existingProductions:
          CuratedPreflightIndexProduction[] =
          [];

        if (signingResult.url) {
          try {
            new URL(
              signingResult.url,
            );
          } catch (error) {
            throw new Error(
              `Invalid signed R2 preflight-index URL: ${
                error instanceof Error
                  ? error.message
                  : String(error)
              }`,
            );
          }

          let existingResponse:
            | Response
            | null = null;

          try {
            existingResponse =
              await fetch(
                signingResult.url,
                {
                  cache: "no-store",
                },
              );
          } catch (error) {
            throw new Error(
              `Browser could not fetch the signed R2 preflight index: ${
                error instanceof Error
                  ? `${error.name}: ${error.message}`
                  : String(error)
              }`,
            );
          }

          if (
            existingResponse.ok
          ) {
            const existingIndex =
              (await existingResponse.json()) as
                Partial<CuratedPreflightIndex>;

            if (
              existingIndex.version === 1 &&
              Array.isArray(
                existingIndex.productions,
              )
            ) {
              existingProductions =
                existingIndex.productions;
            }
          } else if (
            existingResponse.status !== 404
          ) {
            throw new Error(
              `Could not read the existing preflight index from R2 (HTTP ${existingResponse.status}).`,
            );
          }
        }

        const uploadedFolders =
          new Set(
            uploadedIndexProductions.map(
              (production) =>
                production.folder,
            ),
          );

        indexProductions = [
          ...existingProductions.filter(
            (production) =>
              !uploadedFolders.has(
                production.folder,
              ),
          ),
          ...uploadedIndexProductions,
        ];
      }

      indexProductions.sort(
        (first, second) =>
          first.folder.localeCompare(
            second.folder,
            undefined,
            {
              numeric: true,
              sensitivity: "base",
            },
          ),
      );

      const preflightIndex:
        CuratedPreflightIndex = {
          version: 1,
          generatedAt:
            new Date().toISOString(),
          productions:
            indexProductions,
        };

      if (
        preflightIndex.productions.length !==
        Number(
          finalizeResult.finalSelectionCount ??
            0,
        )
      ) {
        throw new Error(
          `Preflight index safety check failed: manifest contains ${Number(
            finalizeResult.finalSelectionCount ?? 0,
          ).toLocaleString()} final selections but the consolidated index contains ${preflightIndex.productions.length.toLocaleString()} productions.`,
        );
      }

      const indexSigningResponse =
        await fetch(
          "/api/admin/curated-archive-import/upload?action=preflight-index-upload",
          {
            method: "POST",
          },
        );

      const indexSigningResult =
        await readUploadResponse(
          indexSigningResponse,
          "Preparing preflight index upload",
        ) as {
          ok: boolean;
          url?: string;
        };

      if (!indexSigningResult.url) {
        throw new Error(
          "No R2 upload URL was returned for the consolidated preflight index.",
        );
      }

      const indexBlob =
        new Blob(
          [
            JSON.stringify(
              preflightIndex,
            ),
          ],
          {
            type:
              "application/json",
          },
        );

      const indexUploadResponse =
        await fetch(
          indexSigningResult.url,
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json",
              "Cache-Control":
                "no-store",
            },
            body:
              indexBlob,
          },
        );

      if (
        !indexUploadResponse.ok
      ) {
        throw new Error(
          `Could not upload the consolidated preflight index directly to R2 (HTTP ${indexUploadResponse.status}).`,
        );
      }

      setUploadProgressText(
        `Committed ${finalSelections.length.toLocaleString()} completed production${
          finalSelections.length === 1
            ? ""
            : "s"
        } and updated the ${preflightIndex.productions.length.toLocaleString()}-production preflight index successfully.`,
      );

      setLoading(true);

      try {
        const preflightResponse =
          await fetch(
            "/api/admin/curated-archive-import/preflight",
            {
              cache: "no-store",
            },
          );

        const preflightResult =
          (await preflightResponse.json()) as
            | PreflightResponse
            | {
                ok?: boolean;
                message?: string;
              };

        if (
          !preflightResponse.ok ||
          !preflightResult.ok ||
          !("summary" in preflightResult) ||
          !("productions" in preflightResult)
        ) {
          throw new Error(
            "message" in preflightResult &&
              preflightResult.message
              ? preflightResult.message
              : "Curated archive preflight failed.",
          );
        }

        setData(
          preflightResult,
        );
      } catch (preflightError) {
        throw new Error(
          `Preflight failed after upload: ${
            preflightError instanceof Error
              ? preflightError.message
              : String(preflightError)
          }`,
        );
      } finally {
        setLoading(false);
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The curated folder could not be staged.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function changeAccess(
    production: PreflightProduction,
    access:
      | "public"
      | "password"
      | "automatic",
  ) {
    const action =
      access === "public"
        ? "unlock"
        : access === "password"
          ? "lock"
          : "reset access for";

    if (
      !window.confirm(
        `Are you sure you want to ${action} "${production.title || production.production}"?`,
      )
    ) {
      return;
    }

    setChangingAccess(
      production.production,
    );
    setError("");

    try {
      const response =
        await fetch(
          "/api/admin/curated-archive-import/access",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              production:
                production.production,
              access,
            }),
          },
        );

      const result =
        (await response.json()) as {
          ok?: boolean;
          message?: string;
        };

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ||
            "Could not change production access.",
        );
      }

      const preflightResponse =
        await fetch(
          "/api/admin/curated-archive-import/preflight",
          {
            cache: "no-store",
          },
        );

      const preflightResult =
        (await preflightResponse.json()) as
          | PreflightResponse
          | {
              ok?: boolean;
              message?: string;
            };

      if (
        !preflightResponse.ok ||
        !preflightResult.ok ||
        !("summary" in preflightResult) ||
        !("productions" in preflightResult)
      ) {
        throw new Error(
          "message" in preflightResult &&
            preflightResult.message
            ? preflightResult.message
            : "Access changed, but preflight refresh failed.",
        );
      }

      setData(preflightResult);
    } catch (accessError) {
      setError(
        accessError instanceof Error
          ? accessError.message
          : "Could not change production access.",
      );
    } finally {
      setChangingAccess(null);
    }
  }

  async function publishCuratedProductionDirect(
    production: PreflightProduction,
    onProgress?: (
      current: number,
      total: number,
    ) => void,
  ) {
    const prepareResponse =
      await fetch(
        "/api/admin/curated-archive-import/publish",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "prepare",
            folder:
              production.folder,
          }),
        },
      );

    const prepared =
      (await prepareResponse.json()) as {
        ok?: boolean;
        message?: string;
        slug?: string;
        title?: string;
        totalImages?: number;
        jobs?: CuratedPublishJob[];
      };

    if (
      !prepareResponse.ok ||
      !prepared.ok ||
      !prepared.slug ||
      !Array.isArray(prepared.jobs) ||
      prepared.jobs.length === 0
    ) {
      throw new Error(
        prepared.message ||
          "The curated production could not be prepared for publishing.",
      );
    }

    const jobs =
      prepared.jobs;

    const assets:
      CuratedPublishedAsset[] = [];
    const concurrency = 2;
    let completed = 0;

    onProgress?.(
      completed,
      jobs.length,
    );

    for (
      let index = 0;
      index < jobs.length;
      index += concurrency
    ) {
      const batch =
        jobs.slice(
          index,
          index + concurrency,
        );

      const batchAssets =
        await Promise.all(
          batch.map(
            async (job) => {
              const signingResponse =
                await fetch(
                  "/api/admin/curated-archive-import/publish",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type":
                        "application/json",
                    },
                    body: JSON.stringify({
                      action:
                        "sign-image",
                      folder:
                        production.folder,
                      slug:
                        prepared.slug,
                      sourceRelativePath:
                        job.sourceRelativePath,
                      outputFilename:
                        job.outputFilename,
                    }),
                  },
                );

              const signed =
                (await signingResponse.json()) as {
                  ok?: boolean;
                  message?: string;
                  sourceUrl?: string;
                  uploadUrl?: string;
                };

              if (
                !signingResponse.ok ||
                !signed.ok ||
                !signed.sourceUrl ||
                !signed.uploadUrl
              ) {
                throw new Error(
                  signed.message ||
                    `Could not prepare ${job.sourceFilepath} for direct publishing.`,
                );
              }

              let sourceResponse:
                | Response
                | null = null;

              try {
                new URL(
                  signed.sourceUrl,
                );
              } catch (error) {
                throw new Error(
                  `Invalid signed R2 source URL for ${job.sourceFilepath}: ${
                    error instanceof Error
                      ? error.message
                      : String(error)
                  }`,
                );
              }

              try {
                sourceResponse =
                  await fetch(
                    signed.sourceUrl,
                  );
              } catch (error) {
                throw new Error(
                  `Browser could not fetch ${job.sourceFilepath} from its signed R2 source URL: ${
                    error instanceof Error
                      ? `${error.name}: ${error.message}`
                      : String(error)
                  }`,
                );
              }

              if (!sourceResponse.ok) {
                throw new Error(
                  `Could not download ${job.sourceFilepath} from R2 (HTTP ${sourceResponse.status}).`,
                );
              }

              const processed =
                await preparePublishedImage(
                  await sourceResponse.blob(),
                  job.sourceFilepath,
                  job.outputFilename,
                  job.editSettings,
                );

              let uploadResponse:
                | Response
                | null = null;

              let uploadError:
                unknown = null;

              for (
                let attempt = 1;
                attempt <= 4;
                attempt += 1
              ) {
                try {
                  uploadResponse =
                    await fetch(
                      signed.uploadUrl,
                      {
                        method: "PUT",
                        headers: {
                          "Content-Type":
                            "image/webp",
                          "Cache-Control":
                            "public, max-age=31536000, immutable",
                        },
                        body:
                          processed.blob,
                      },
                    );

                  if (
                    uploadResponse.ok ||
                    (
                      uploadResponse.status < 500 &&
                      uploadResponse.status !== 429
                    )
                  ) {
                    break;
                  }

                  uploadError =
                    new Error(
                      `HTTP ${uploadResponse.status}`,
                    );
                } catch (error) {
                  uploadResponse = null;
                  uploadError = error;
                }

                if (attempt < 4) {
                  await new Promise(
                    (resolve) =>
                      setTimeout(
                        resolve,
                        500 *
                          2 ** (attempt - 1),
                      ),
                  );
                }
              }

              if (
                !uploadResponse ||
                !uploadResponse.ok
              ) {
                throw new Error(
                  `Could not upload ${job.outputFilename} directly to production R2 after 4 attempts${
                    uploadResponse
                      ? ` (HTTP ${uploadResponse.status})`
                      : uploadError instanceof Error
                        ? ` (${uploadError.message})`
                        : ""
                  }.`,
                );
              }

              return processed.asset;
            },
          ),
        );

      assets.push(
        ...batchAssets,
      );
      completed += batch.length;
      onProgress?.(
        completed,
        jobs.length,
      );
    }

    const heroIndex =
      jobs.findIndex(
        (job) =>
          job.kind === "hero",
      );

    if (heroIndex < 0) {
      throw new Error(
        "The curated production has no hero image job.",
      );
    }

    const heroAsset =
      assets[heroIndex];
    const galleryAssets =
      assets.filter(
        (_asset, index) =>
          jobs[index]
            .kind === "gallery",
      );

    const finalizeResponse =
      await fetch(
        "/api/admin/curated-archive-import/publish",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "finalize",
            folder:
              production.folder,
            heroAsset,
            galleryAssets,
          }),
        },
      );

    const finalized =
      (await finalizeResponse.json()) as {
        ok?: boolean;
        message?: string;
      };

    if (
      !finalizeResponse.ok ||
      !finalized.ok
    ) {
      throw new Error(
        finalized.message ||
          "The curated production could not be finalized.",
      );
    }

    return finalized;
  }

  async function importProduction(
    production: PreflightProduction,
  ) {
    if (
      production.status !== "ready"
    ) {
      return;
    }

    if (
      !window.confirm(
        `Import "${production.title || production.production}" into the website archive now?`,
      )
    ) {
      return;
    }

    setImportingProduction(
      production.folder,
    );
    setError("");

    try {
      setImportProgressText(
        "Preparing production…",
      );

      await publishCuratedProductionDirect(
        production,
        (current, total) => {
          setImportProgressText(
            current === 0
              ? `Preparing ${total} image${total === 1 ? "" : "s"}…`
              : `Publishing ${current} of ${total} images…`,
          );
        },
      );

      setImportProgressText(
        "Refreshing archive status…",
      );

      const preflightResponse =
        await fetch(
          "/api/admin/curated-archive-import/preflight",
          {
            cache: "no-store",
          },
        );

      const preflightResult =
        (await preflightResponse.json()) as
          | PreflightResponse
          | {
              ok?: boolean;
              message?: string;
            };

      if (
        !preflightResponse.ok ||
        !preflightResult.ok ||
        !("summary" in preflightResult) ||
        !("productions" in preflightResult)
      ) {
        throw new Error(
          "message" in preflightResult &&
            preflightResult.message
            ? preflightResult.message
            : "Production imported, but preflight refresh failed.",
        );
      }

      setData(preflightResult);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "The curated production could not be imported.",
      );
    } finally {
      setImportingProduction(null);
      setImportProgressText("");
    }
  }

  async function changeExclusion(
    production: PreflightProduction,
    excluded: boolean,
  ) {
    const action =
      excluded
        ? "exclude"
        : "include";

    if (
      !window.confirm(
        excluded
          ? `Exclude "${production.title || production.production}" from this curated import?`
          : `Include "${production.title || production.production}" in this curated import?`,
      )
    ) {
      return;
    }

    setError("");

    try {
      const response =
        await fetch(
          `/api/admin/curated-archive-import/upload?action=${action}`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              production:
                production.production,
              folder:
                production.folder,
            }),
          },
        );

      const result =
        (await response.json()) as {
          ok?: boolean;
          message?: string;
        };

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ||
            `Could not ${action} production.`,
        );
      }

      const preflightResponse =
        await fetch(
          "/api/admin/curated-archive-import/preflight",
          {
            cache: "no-store",
          },
        );

      const preflightResult =
        (await preflightResponse.json()) as
          | PreflightResponse
          | {
              ok?: boolean;
              message?: string;
            };

      if (
        !preflightResponse.ok ||
        !preflightResult.ok ||
        !("summary" in preflightResult) ||
        !("productions" in preflightResult)
      ) {
        throw new Error(
          "message" in preflightResult &&
            preflightResult.message
            ? preflightResult.message
            : `Production ${action}d, but preflight refresh failed.`,
        );
      }

      setData(preflightResult);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : `Could not ${action} production.`,
      );
    }
  }

  async function deleteStagedProduction(
    production: PreflightProduction,
  ) {
    if (
      !window.confirm(
        `Delete "${production.title || production.production}" from the current curated upload? This removes its staged files from R2 but does not delete an existing live website production.`,
      )
    ) {
      return;
    }

    setError("");

    try {
      const response =
        await fetch(
          "/api/admin/curated-archive-import/upload?action=delete-folder",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              production:
                production.production,
              folder:
                production.folder,
            }),
          },
        );

      const result =
        (await response.json()) as {
          ok?: boolean;
          message?: string;
        };

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ||
            "Could not delete the staged production.",
        );
      }

      setSelectedReadyFolders(
        (current) =>
          current.filter(
            (folder) =>
              folder !==
              production.folder,
          ),
      );

      const preflightResponse =
        await fetch(
          "/api/admin/curated-archive-import/preflight",
          {
            cache: "no-store",
          },
        );

      const preflightResult =
        (await preflightResponse.json()) as
          | PreflightResponse
          | {
              ok?: boolean;
              message?: string;
            };

      if (
        !preflightResponse.ok ||
        !preflightResult.ok ||
        !("summary" in preflightResult) ||
        !("productions" in preflightResult)
      ) {
        throw new Error(
          "message" in preflightResult &&
            preflightResult.message
            ? preflightResult.message
            : "Production deleted, but preflight refresh failed.",
        );
      }

      setData(preflightResult);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete the staged production.",
      );
    }
  }

  function toggleReadySelection(
    folder: string,
  ) {
    setSelectedReadyFolders(
      (current) =>
        current.includes(folder)
          ? current.filter(
              (value) =>
                value !== folder,
            )
          : [...current, folder],
    );
  }

  async function importReadyProductions(
    readyProductions: PreflightProduction[],
    confirmation: string,
  ) {

    if (readyProductions.length === 0) {
      return;
    }

    if (
      !window.confirm(
        confirmation,
      )
    ) {
      return;
    }

    setBatchImporting(true);
    setBatchResult(null);
    setError("");

    let imported = 0;

    const failed: Array<{
      title: string;
      message: string;
    }> = [];

    try {
      for (
        let index = 0;
        index < readyProductions.length;
        index += 1
      ) {
        const production =
          readyProductions[index];

        const title =
          production.title ||
          production.production;

        setBatchProgress({
          current: index + 1,
          total:
            readyProductions.length,
          title,
        });

        try {
          await publishCuratedProductionDirect(
            production,
            (current, total) => {
              setBatchProgress({
                current: index + 1,
                total:
                  readyProductions.length,
                title:
                  current === 0
                    ? `${title} — preparing ${total} images`
                    : `${title} — image ${current} of ${total}`,
              });
            },
          );

          imported += 1;
        } catch (productionError) {
          failed.push({
            title,
            message:
              productionError instanceof
              Error
                ? productionError.message
                : "Import failed.",
          });
        }
      }

      const preflightResponse =
        await fetch(
          "/api/admin/curated-archive-import/preflight",
          {
            cache: "no-store",
          },
        );

      const preflightResult =
        (await preflightResponse.json()) as
          | PreflightResponse
          | {
              ok?: boolean;
              message?: string;
            };

      if (
        !preflightResponse.ok ||
        !preflightResult.ok ||
        !("summary" in preflightResult) ||
        !("productions" in preflightResult)
      ) {
        throw new Error(
          "message" in preflightResult &&
            preflightResult.message
            ? preflightResult.message
            : "Batch import finished, but preflight refresh failed.",
        );
      }

      setData(preflightResult);

      setBatchResult({
        imported,
        failed,
      });
    } catch (batchError) {
      setError(
        batchError instanceof Error
          ? batchError.message
          : "The batch import could not be completed.",
      );

      setBatchResult({
        imported,
        failed,
      });
    } finally {
      setBatchProgress(null);
      setBatchImporting(false);
    }
  }

  async function importSelectedReady() {
    const selected =
      data?.productions.filter(
        (production) =>
          production.status === "ready" &&
          selectedReadyFolders.includes(
            production.folder,
          ),
      ) ?? [];

    await importReadyProductions(
      selected,
      `Import the ${selected.length} selected Ready production${selected.length === 1 ? "" : "s"} into the website archive? They will be processed one at a time.`,
    );
  }

  async function importAllReady() {
    const ready =
      data?.productions.filter(
        (production) =>
          production.status === "ready",
      ) ?? [];

    await importReadyProductions(
      ready,
      `Import all ${ready.length} Ready productions into the website archive? They will be processed one at a time.`,
    );
  }

  const rows =
    useMemo(() => {
      const productions =
        data?.productions ?? [];

      if (statusFilter === "all") {
        return productions;
      }

      if (statusFilter === "locked") {
        return productions.filter(
          (production) =>
            production.locked,
        );
      }

      return productions.filter(
        (production) =>
          production.status ===
          statusFilter,
      );
    }, [data, statusFilter]);

  function selectVisibleReady() {
    const visibleReady =
      rows
        .filter(
          (production) =>
            production.status === "ready",
        )
        .map(
          (production) =>
            production.folder,
        );

    setSelectedReadyFolders(
      (current) =>
        [
          ...new Set([
            ...current,
            ...visibleReady,
          ]),
        ],
    );
  }

  return (
    <section
      style={{
        borderTop:
          "1px solid rgba(242, 238, 230, 0.14)",
        paddingTop: "2rem",
      }}
    >
      <p
        style={{
          margin: 0,
          color: "#c7a369",
          fontSize: "0.56rem",
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        Curated archive preflight
      </p>

      <h2
        style={{
          margin: "0.8rem 0 0",
          fontFamily:
            '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
          fontSize:
            "clamp(2rem, 4vw, 3.5rem)",
          fontWeight: 400,
          letterSpacing: "-0.04em",
        }}
      >
        Archive readiness
      </h2>

      <p
        style={{
          maxWidth: "46rem",
          margin: "1rem 0 0",
          color:
            "rgba(242, 238, 230, 0.62)",
          lineHeight: 1.7,
        }}
      >
        This is a read-only scan of the
        completed curated Archive output.
        No OpenAI, Dropbox or Google Drive requests are
        made by this preflight.
      </p>

      <div
        style={{
          marginTop: "2rem",
          padding: "1.25rem 1.35rem",
          border:
            "1px solid rgba(199, 163, 105, 0.28)",
          background:
            "rgba(199, 163, 105, 0.045)",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#c7a369",
            fontSize: "0.58rem",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Choose curated folder
        </p>
        <p
          style={{
            margin: "0.55rem 0 1rem",
            color:
              "rgba(242, 238, 230, 0.62)",
            fontSize: "0.75rem",
            lineHeight: 1.55,
          }}
        >
          Choose the main completed curator output folder containing all
          production folders, or choose one individual production folder.
          Backstage will automatically find each final-selection.json and its
          selected-web-staging images, and ignore all other curator files.
        </p>
        <input
          type="file"
          // @ts-expect-error - supported by Chromium/WebKit browsers
          webkitdirectory=""
          multiple
          disabled={uploading}
          onChange={(event) =>
            void uploadCuratedFolder(
              event.currentTarget.files,
            )
          }
          style={{
            display: "block",
            width: "100%",
            border:
              "1px solid rgba(242, 238, 230, 0.25)",
            padding: "1rem",
            background:
              "rgba(255, 255, 255, 0.03)",
            color: "inherit",
            opacity: uploading ? 0.55 : 1,
          }}
        />
        {uploading ? (
          <p
            style={{
              margin: "0.75rem 0 0",
              color:
                "rgba(242, 238, 230, 0.55)",
              fontSize: "0.7rem",
            }}
          >
            {uploadProgressText ||
              "Preparing and staging selected folder…"}
          </p>
        ) : null}
      </div>

      {loading ? (
        <p
          style={{
            margin: "2rem 0 0",
            color:
              "rgba(242, 238, 230, 0.55)",
          }}
        >
          Scanning curated Archive…
        </p>
      ) : null}

      {error ? (
        <div
          style={{
            marginTop: "2rem",
            padding: "1rem 1.25rem",
            border:
              "1px solid rgba(220, 100, 100, 0.35)",
            color: "#f0b2aa",
          }}
        >
          {error}
        </div>
      ) : null}

      {data ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(9rem, 1fr))",
              gap: "0.8rem",
              marginTop: "2.25rem",
            }}
          >
            {(
              [
                [
                  "Final selections",
                  data.summary.total,
                  "all",
                ],
                [
                  "Ready",
                  data.summary.ready,
                  "ready",
                ],
                [
                  "Existing",
                  data.summary.existing,
                  "existing",
                ],
                [
                  "Excluded",
                  data.summary.excluded,
                  "excluded",
                ],
                [
                  "Attention",
                  data.summary.attention,
                  "attention",
                ],
                [
                  "Locked",
                  data.summary.locked,
                  "locked",
                ],
              ] as const
            ).map(
              ([label, value, filter]) => {
                const active =
                  statusFilter === filter;

                return (
                  <button
                    type="button"
                    key={label}
                    onClick={() =>
                      setStatusFilter(filter)
                    }
                    aria-pressed={active}
                    style={{
                      minHeight: "7rem",
                      padding: "1rem 1.1rem",
                      border: active
                        ? "1px solid rgba(199, 163, 105, 0.72)"
                        : "1px solid rgba(242, 238, 230, 0.12)",
                      background: active
                        ? "rgba(199, 163, 105, 0.09)"
                        : "rgba(242, 238, 230, 0.025)",
                      color: "inherit",
                      textAlign: "left",
                      cursor: "pointer",
                      font: "inherit",
                    }}
                  >
                <p
                  style={{
                    margin: 0,
                    color: "#c7a369",
                    fontSize: "0.52rem",
                    fontWeight: 700,
                    letterSpacing:
                      "0.15em",
                    textTransform:
                      "uppercase",
                  }}
                >
                  {label}
                </p>

                <p
                  style={{
                    margin:
                      "0.7rem 0 0",
                    fontFamily:
                      '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
                    fontSize: "2.25rem",
                    lineHeight: 1,
                  }}
                >
                  {value}
                </p>
                  </button>
                );
              },
            )}
          </div>

          <p
            style={{
              margin: "1rem 0 0",
              color:
                "rgba(242, 238, 230, 0.42)",
              fontSize: "0.7rem",
            }}
          >
            Existing website productions:
            {" "}
            {existingProductions.length}
          </p>

          <div
            style={{
              marginTop: "1.5rem",
              padding: "1.25rem 1.35rem",
              border:
                "1px solid rgba(199, 163, 105, 0.28)",
              background:
                "rgba(199, 163, 105, 0.045)",
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "1.5rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  color: "#c7a369",
                  fontSize: "0.58rem",
                  fontWeight: 700,
                  letterSpacing:
                    "0.14em",
                  textTransform:
                    "uppercase",
                }}
              >
                Batch curated import
              </p>

              <p
                style={{
                  margin:
                    "0.5rem 0 0",
                  color:
                    "rgba(242, 238, 230, 0.62)",
                  fontSize: "0.75rem",
                  lineHeight: 1.5,
                }}
              >
                {batchProgress
                  ? `Importing ${batchProgress.current} of ${batchProgress.total} — ${batchProgress.title}`
                  : `${data.summary.ready} Ready production${data.summary.ready === 1 ? "" : "s"} available to import.`}
              </p>

              {batchResult ? (
                <p
                  style={{
                    margin:
                      "0.45rem 0 0",
                    color:
                      batchResult.failed
                        .length > 0
                        ? "#f0b2aa"
                        : "rgba(242, 238, 230, 0.72)",
                    fontSize:
                      "0.68rem",
                    lineHeight: 1.5,
                  }}
                >
                  Imported{" "}
                  {batchResult.imported}.
                  {" "}
                  Failed{" "}
                  {
                    batchResult.failed
                      .length
                  }.
                  {batchResult.failed
                    .length > 0
                    ? ` ${batchResult.failed
                        .map(
                          (failure) =>
                            `${failure.title}: ${failure.message}`,
                        )
                        .join(" · ")}`
                    : ""}
                </p>
              ) : null}
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.6rem",
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                className="backstage-button"
                disabled={
                  batchImporting ||
                  rows.every(
                    (production) =>
                      production.status !== "ready",
                  )
                }
                onClick={selectVisibleReady}
              >
                Select visible Ready
              </button>

              <button
                type="button"
                className="backstage-button"
                disabled={
                  batchImporting ||
                  selectedReadyFolders.length === 0
                }
                onClick={() =>
                  setSelectedReadyFolders([])
                }
              >
                Clear selection
              </button>

              <button
                type="button"
                className="backstage-button"
                disabled={
                  batchImporting ||
                  selectedReadyFolders.length === 0
                }
                onClick={() =>
                  void importSelectedReady()
                }
                style={{
                  opacity:
                    batchImporting ||
                    selectedReadyFolders.length === 0
                      ? 0.5
                      : 1,
                }}
              >
                {batchImporting
                  ? "Importing…"
                  : `Import Selected (${selectedReadyFolders.length})`}
              </button>

              <button
                type="button"
                className="backstage-button"
                disabled={
                  batchImporting ||
                  data.summary.ready === 0
                }
                onClick={() =>
                  void importAllReady()
                }
              >
                {batchImporting
                  ? "Importing…"
                  : `Import All Ready (${data.summary.ready})`}
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: "3rem",
              borderTop:
                "1px solid rgba(242, 238, 230, 0.12)",
            }}
          >
            {rows.map(
              (production) => (
                <article
                  key={production.folder}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(0, 1fr) auto",
                    gap: "1.5rem",
                    padding:
                      "1.35rem 0",
                    borderBottom:
                      "1px solid rgba(242, 238, 230, 0.1)",
                  }}
                >
                  <div>
                    <p
                      style={{
                        margin: 0,
                        color:
                          "rgba(242, 238, 230, 0.42)",
                        fontSize:
                          "0.54rem",
                        fontWeight: 700,
                        letterSpacing:
                          "0.13em",
                        textTransform:
                          "uppercase",
                      }}
                    >
                      {production.venue}
                      {production.venue &&
                      production.year
                        ? " · "
                        : ""}
                      {production.month
                        ? `${
                            MONTHS[
                              production
                                .month
                            ]
                          } `
                        : ""}
                      {production.year ??
                        ""}
                    </p>

                    <h3
                      style={{
                        margin:
                          "0.45rem 0 0",
                        fontFamily:
                          '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
                        fontSize:
                          "1.55rem",
                        fontWeight: 400,
                        letterSpacing:
                          "-0.025em",
                      }}
                    >
                      {production.title ||
                        production.production}
                    </h3>

                    <p
                      style={{
                        margin:
                          "0.55rem 0 0",
                        color:
                          "rgba(242, 238, 230, 0.46)",
                        fontSize:
                          "0.68rem",
                      }}
                    >
                      {
                        production.selectedCount
                      }{" "}
                      selected image
                      {production.selectedCount ===
                      1
                        ? ""
                        : "s"}
                      {production.heroIndex
                        ? ` · Hero #${String(
                            production.heroIndex,
                          ).padStart(
                            4,
                            "0",
                          )}`
                        : ""}
                    </p>

                    {(production.folders?.length ?? 1) > 1 ? (
                      <p style={{ margin: "0.35rem 0 0", color: "rgba(199, 163, 105, 0.72)", fontSize: "0.62rem" }}>
                        Duplicate curator entries collapsed: {production.folders?.length} source folders
                      </p>
                    ) : null}

                    {production.issues
                      .length > 0 ? (
                      <div
                        style={{
                          marginTop:
                            "0.65rem",
                        }}
                      >
                        {production.issues.map(
                          (issue) => (
                            <p
                              key={
                                issue
                              }
                              style={{
                                margin:
                                  "0.2rem 0 0",
                                color:
                                  "rgba(240, 178, 170, 0.78)",
                                fontSize:
                                  "0.68rem",
                              }}
                            >
                              {issue}
                            </p>
                          ),
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div
                    style={{
                      alignSelf:
                        "center",
                      textAlign:
                        "right",
                    }}
                  >
                    <span
                      style={{
                        display:
                          "inline-block",
                        padding:
                          "0.4rem 0.6rem",
                        border:
                          "1px solid rgba(199, 163, 105, 0.3)",
                        color:
                          production.status ===
                          "attention"
                            ? "#f0b2aa"
                            : "#c7a369",
                        fontSize:
                          "0.5rem",
                        fontWeight: 700,
                        letterSpacing:
                          "0.13em",
                        textTransform:
                          "uppercase",
                      }}
                    >
                      {statusLabel(
                        production.status,
                      )}
                    </span>

                    <div
                      style={{
                        marginTop:
                          "0.55rem",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          color:
                            production.locked
                              ? "#c7a369"
                              : "rgba(242, 238, 230, 0.48)",
                          fontSize:
                            "0.55rem",
                          fontWeight: 700,
                          letterSpacing:
                            "0.13em",
                          textTransform:
                            "uppercase",
                        }}
                      >
                        {production.locked
                          ? "Locked"
                          : "Public"}
                        {" · "}
                        {production.accessSource ===
                        "manual"
                          ? "Manual override"
                          : "Automatic"}
                      </p>

                      <div
                        style={{
                          display: "flex",
                          justifyContent:
                            "flex-end",
                          flexWrap: "wrap",
                          gap: "0.4rem",
                          marginTop:
                            "0.45rem",
                        }}
                      >
                        {production.status ===
                        "ready" ? (
                          <label
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              padding: "0.35rem 0.45rem",
                              border: "1px solid rgba(242, 238, 230, 0.16)",
                              color: "rgba(242, 238, 230, 0.72)",
                              fontSize: "0.5rem",
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={
                                selectedReadyFolders.includes(
                                  production.folder,
                                )
                              }
                              disabled={batchImporting}
                              onChange={() =>
                                toggleReadySelection(
                                  production.folder,
                                )
                              }
                            />
                            Select
                          </label>
                        ) : null}

                        {production.status ===
                        "ready" ? (
                          <button
                            type="button"
                            className="backstage-button"
                            disabled={
                              importingProduction ===
                              production.folder
                            }
                            onClick={() =>
                              void importProduction(
                                production,
                              )
                            }
                            style={{
                              cursor:
                                importingProduction ===
                                production.folder
                                  ? "wait"
                                  : "pointer",
                              opacity:
                                importingProduction ===
                                production.folder
                                  ? 0.55
                                  : 1,
                            }}
                          >
                            {importingProduction ===
                            production.folder
                              ? importProgressText ||
                                "Importing…"
                              : "Import"}
                          </button>
                        ) : null}

                        <button
                          type="button"
                          className="backstage-button"
                          onClick={() =>
                            void changeExclusion(
                              production,
                              production.status !==
                                "excluded",
                            )
                          }
                        >
                          {production.status ===
                          "excluded"
                            ? "Include"
                            : "Exclude"}
                        </button>

                        <button
                          type="button"
                          className="backstage-button"
                          onClick={() =>
                            void deleteStagedProduction(
                              production,
                            )
                          }
                          style={{
                            borderColor:
                              "rgba(220, 100, 100, 0.35)",
                            color:
                              "#f0b2aa",
                          }}
                        >
                          Delete from upload
                        </button>

                        <a
                          className="backstage-button"
                          href={`/admin/curated-archive-import/edit/${encodeURIComponent(
                            production.folder,
                          )}`}
                          style={{
                            textDecoration:
                              "none",
                          }}
                        >
                          Edit
                        </a>

                        <button
                          type="button"
                          disabled={
                            changingAccess ===
                            production.production
                          }
                          onClick={() =>
                            void changeAccess(
                              production,
                              production.locked
                                ? "public"
                                : "password",
                            )
                          }
                          style={{
                            padding:
                              "0.35rem 0.55rem",
                            border:
                              "1px solid rgba(199, 163, 105, 0.32)",
                            background:
                              "transparent",
                            color:
                              "#c7a369",
                            cursor:
                              changingAccess ===
                              production.production
                                ? "wait"
                                : "pointer",
                            font:
                              "inherit",
                            fontSize:
                              "0.5rem",
                            fontWeight: 700,
                            letterSpacing:
                              "0.1em",
                            textTransform:
                              "uppercase",
                            opacity:
                              changingAccess ===
                              production.production
                                ? 0.55
                                : 1,
                          }}
                        >
                          {changingAccess ===
                          production.production
                            ? "Changing…"
                            : production.locked
                              ? "Unlock"
                              : "Lock"}
                        </button>

                        {production.accessSource ===
                        "manual" ? (
                          <button
                            type="button"
                            disabled={
                              changingAccess ===
                              production.production
                            }
                            onClick={() =>
                              void changeAccess(
                                production,
                                "automatic",
                              )
                            }
                            style={{
                              padding:
                                "0.35rem 0.55rem",
                              border:
                                "1px solid rgba(242, 238, 230, 0.16)",
                              background:
                                "transparent",
                              color:
                                "rgba(242, 238, 230, 0.62)",
                              cursor:
                                changingAccess ===
                                production.production
                                  ? "wait"
                                  : "pointer",
                              font:
                                "inherit",
                              fontSize:
                                "0.5rem",
                              fontWeight: 700,
                              letterSpacing:
                                "0.1em",
                              textTransform:
                                "uppercase",
                              opacity:
                                changingAccess ===
                                production.production
                                  ? 0.55
                                  : 1,
                            }}
                          >
                            Reset to automatic
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {production.existingSlug ? (
                      <p
                        style={{
                          margin:
                            "0.55rem 0 0",
                          color:
                            "rgba(242, 238, 230, 0.4)",
                          fontSize:
                            "0.6rem",
                        }}
                      >
                        /
                        {
                          production.existingSlug
                        }
                      </p>
                    ) : null}
                  </div>
                </article>
              ),
            )}
          </div>
        </>
      ) : null}

      <div
        style={{
          marginTop: "2.5rem",
          padding: "1.25rem 1.5rem",
          border:
            "1px solid rgba(199, 163, 105, 0.28)",
          background:
            "rgba(199, 163, 105, 0.045)",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#c7a369",
            fontSize: "0.64rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Zero-AI import path
        </p>

        <p
          style={{
            margin: "0.65rem 0 0",
            color:
              "rgba(242, 238, 230, 0.68)",
            lineHeight: 1.65,
          }}
        >
          Curated Archive Import does not
          call the vision review or
          image-analysis endpoints used
          by general Bulk Import.
        </p>
      </div>
    </section>
  );
}
