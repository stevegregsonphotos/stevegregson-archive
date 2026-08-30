"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type CategoryId =
  | "production"
  | "rehearsal"
  | "campaign";

type AnalysisStatus =
  | "pending"
  | "complete";

type SelectedWorkImage = {
  filename: string;
  suggestedFilename?: string;
  alt: string;
  uploadedAt: string;
  width?: number;
  height?: number;
  analysisStatus: AnalysisStatus;
  analysedAt?: string;
};

type SelectedWorkData = Record<
  CategoryId,
  SelectedWorkImage[]
>;

type ApiResponse = {
  ok: boolean;
  data?: SelectedWorkData;
  message?: string;
};

type VisionMetadata = {
  alt: string;
  filename: string;
  layout: string;
};

type VisionResponse = {
  ok: boolean;
  image?: string;
  metadata?: VisionMetadata;
  message?: string;
};

type SaveState =
  | "clean"
  | "dirty"
  | "saving"
  | "saved"
  | "error";

const EMPTY_DATA: SelectedWorkData = {
  production: [],
  rehearsal: [],
  campaign: [],
};

const EMPTY_SAVE_STATE: Record<
  CategoryId,
  SaveState
> = {
  production: "clean",
  rehearsal: "clean",
  campaign: "clean",
};

const MAX_UPLOAD_BATCH_FILES = 3;
const MAX_UPLOAD_BATCH_BYTES =
  24 * 1024 * 1024;

const CATEGORIES: Array<{
  id: CategoryId;
  number: string;
  title: string;
  description: string;
}> = [
  {
    id: "production",
    number: "01",
    title: "Production Photography",
    description:
      "Your principal performance and production images.",
  },
  {
    id: "rehearsal",
    number: "02",
    title: "Rehearsal & Backstage",
    description:
      "The rehearsal process, preparation and work off stage.",
  },
  {
    id: "campaign",
    number: "03",
    title: "Campaign & PR",
    description:
      "Press, marketing, publicity and campaign imagery.",
  },
];

function createUploadBatches(
  files: File[],
) {
  const batches: File[][] = [];
  let batch: File[] = [];
  let batchBytes = 0;

  for (const file of files) {
    const wouldExceedFileLimit =
      batch.length >=
      MAX_UPLOAD_BATCH_FILES;

    const wouldExceedByteLimit =
      batch.length > 0 &&
      batchBytes + file.size >
        MAX_UPLOAD_BATCH_BYTES;

    if (
      wouldExceedFileLimit ||
      wouldExceedByteLimit
    ) {
      batches.push(batch);
      batch = [];
      batchBytes = 0;
    }

    batch.push(file);
    batchBytes += file.size;
  }

  if (batch.length > 0) {
    batches.push(batch);
  }

  return batches;
}

function normaliseIncomingData(
  data: SelectedWorkData,
): SelectedWorkData {
  return {
    production:
      normaliseIncomingImages(
        data.production,
      ),
    rehearsal:
      normaliseIncomingImages(
        data.rehearsal,
      ),
    campaign:
      normaliseIncomingImages(
        data.campaign,
      ),
  };
}

function normaliseIncomingImages(
  images: SelectedWorkImage[],
) {
  return images.map((image) => ({
    ...image,
    suggestedFilename:
      image.suggestedFilename ?? "",
    analysisStatus:
      image.analysisStatus ??
      (image.alt.trim()
        ? "complete"
        : "pending"),
  }));
}

function categoryLabel(
  category: CategoryId,
) {
  switch (category) {
    case "production":
      return "Production Photography";

    case "rehearsal":
      return "Rehearsal & Backstage";

    case "campaign":
      return "Campaign & PR";
  }
}

export default function SelectedWorkEditor() {
  const [data, setData] =
    useState<SelectedWorkData>(
      EMPTY_DATA,
    );

  /*
   * Keep a synchronous copy of the
   * latest data. This prevents async
   * operations from accidentally saving
   * an older React render.
   */
  const dataRef =
    useRef<SelectedWorkData>(
      EMPTY_DATA,
    );

  const [pendingFiles, setPendingFiles] =
    useState<
      Partial<
        Record<CategoryId, File[]>
      >
    >({});

  const [loading, setLoading] =
    useState(true);

  const [
    busyCategory,
    setBusyCategory,
  ] =
    useState<CategoryId | null>(
      null,
    );

  const [
    analysingCategory,
    setAnalysingCategory,
  ] =
    useState<CategoryId | null>(
      null,
    );

  const [
    analysisProgress,
    setAnalysisProgress,
  ] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const [
    uploadProgress,
    setUploadProgress,
  ] = useState<{
    category: CategoryId;
    current: number;
    total: number;
  } | null>(null);

  const [message, setMessage] =
    useState<string | null>(
      null,
    );

  const [error, setError] =
    useState<string | null>(
      null,
    );

  const [
    selectedImages,
    setSelectedImages,
  ] = useState<
    Record<
      CategoryId,
      Set<string>
    >
  >({
    production:
      new Set<string>(),
    rehearsal:
      new Set<string>(),
    campaign:
      new Set<string>(),
  });

  const [
    draggedImage,
    setDraggedImage,
  ] = useState<{
    category: CategoryId;
    filename: string;
  } | null>(null);

  const [
    activeCategory,
    setActiveCategory,
  ] =
    useState<CategoryId>(
      "production",
    );

  const [
    saveState,
    setSaveState,
  ] = useState<
    Record<CategoryId, SaveState>
  >(EMPTY_SAVE_STATE);

  const hasUnsavedChanges =
    useMemo(
      () =>
        Object.values(
          saveState,
        ).some(
          (state) =>
            state === "dirty" ||
            state === "error",
        ),
      [saveState],
    );

  const totalImages = useMemo(
    () =>
      Object.values(data).reduce(
        (total, images) =>
          total + images.length,
        0,
      ),
    [data],
  );

  function replaceData(
    nextData: SelectedWorkData,
  ) {
    const normalised =
      normaliseIncomingData(
        nextData,
      );

    dataRef.current =
      normalised;

    setData(normalised);
  }

  function replaceCategory(
    category: CategoryId,
    images: SelectedWorkImage[],
  ) {
    const nextData = {
      ...dataRef.current,
      [category]: images,
    };

    dataRef.current =
      nextData;

    setData(nextData);
  }

  function setCategorySaveState(
    category: CategoryId,
    state: SaveState,
  ) {
    setSaveState((current) => ({
      ...current,
      [category]: state,
    }));
  }

  useEffect(() => {
    void loadData();
  }, []);

  /*
   * Warn before closing or refreshing
   * the page when manually edited
   * metadata has not been saved.
   */
  useEffect(() => {
    function handleBeforeUnload(
      event: BeforeUnloadEvent,
    ) {
      if (!hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener(
      "beforeunload",
      handleBeforeUnload,
    );

    return () => {
      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload,
      );
    };
  }, [hasUnsavedChanges]);

  /*
   * Keyboard selection shortcuts.
   */
  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      const target =
        event.target as
          | HTMLElement
          | null;

      const isTyping =
        target instanceof
          HTMLInputElement ||
        target instanceof
          HTMLTextAreaElement ||
        target?.isContentEditable;

      if (event.key === "Escape") {
        setSelectedImages(
          (current) => ({
            ...current,
            [activeCategory]:
              new Set<string>(),
          }),
        );

        return;
      }

      if (
        !isTyping &&
        event.key.toLowerCase() ===
          "a" &&
        (event.metaKey ||
          event.ctrlKey)
      ) {
        event.preventDefault();

        setSelectedImages(
          (current) => ({
            ...current,
            [activeCategory]:
              new Set(
                data[
                  activeCategory
                ].map(
                  (image) =>
                    image.filename,
                ),
              ),
          }),
        );
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [activeCategory, data]);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/admin/selected-work",
          {
            cache: "no-store",
          },
        );

      const result =
        (await response.json()) as
          ApiResponse;

      if (
        !response.ok ||
        !result.ok ||
        !result.data
      ) {
        throw new Error(
          result.message ??
            "Selected Work could not be loaded.",
        );
      }

      const normalised =
  normaliseIncomingData(
    result.data,
  );

replaceData(normalised);

setSaveState({
  production:
    normalised.production.some(
      (image) =>
        Boolean(
          image.suggestedFilename?.trim(),
        ),
    )
      ? "dirty"
      : "clean",
  rehearsal:
    normalised.rehearsal.some(
      (image) =>
        Boolean(
          image.suggestedFilename?.trim(),
        ),
    )
      ? "dirty"
      : "clean",
  campaign:
    normalised.campaign.some(
      (image) =>
        Boolean(
          image.suggestedFilename?.trim(),
        ),
    )
      ? "dirty"
      : "clean",
});
    } catch (caughtError) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Selected Work could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleImageSelection(
    category: CategoryId,
    filename: string,
  ) {
    setSelectedImages(
      (current) => {
        const next = {
          production:
            new Set(
              current.production,
            ),
          rehearsal:
            new Set(
              current.rehearsal,
            ),
          campaign:
            new Set(
              current.campaign,
            ),
        };

        const selection =
          next[category];

        if (
          selection.has(filename)
        ) {
          selection.delete(
            filename,
          );
        } else {
          selection.add(
            filename,
          );
        }

        return next;
      },
    );
  }

  function updateImage(
    category: CategoryId,
    index: number,
    changes: Partial<SelectedWorkImage>,
  ) {
    const nextImages =
      dataRef.current[
        category
      ].map(
        (image, imageIndex) =>
          imageIndex === index
            ? {
                ...image,
                ...changes,
              }
            : image,
      );

    replaceCategory(
      category,
      nextImages,
    );

    setCategorySaveState(
      category,
      "dirty",
    );

    setMessage(null);
    setError(null);
  }

  /*
   * Persist an exact category snapshot.
   *
   * This is used for explicit metadata
   * saves, automatic reorder saves and
   * automatic AI-result saves.
   */
  async function persistCategory(
  category: CategoryId,
  images: SelectedWorkImage[],
  applyFilenameChanges = true,
) {
    const response =
      await fetch(
        "/api/admin/selected-work",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
  category,
  images,
  applyFilenameChanges,
}),
        },
      );

    let result:
      | ApiResponse
      | null = null;

    try {
      result =
        (await response.json()) as
          ApiResponse;
    } catch {
      result = null;
    }

    if (
      !response.ok ||
      !result?.ok ||
      !result.data
    ) {
      throw new Error(
        result?.message ??
          "The collection could not be saved.",
      );
    }

    return normaliseIncomingData(
      result.data,
    );
  }

  async function saveCategory(
    category: CategoryId,
  ) {
    if (
      busyCategory ||
      analysingCategory
    ) {
      return;
    }

    const snapshot =
      dataRef.current[
        category
      ].map((image) => ({
        ...image,
      }));

    setBusyCategory(category);
    setCategorySaveState(
      category,
      "saving",
    );
    setError(null);
    setMessage(null);

    try {
      const savedData =
        await persistCategory(
          category,
          snapshot,
        );

      replaceCategory(
  category,
  normaliseIncomingImages(
    savedData[category],
  ),
);

      setCategorySaveState(
        category,
        "saved",
      );

      setMessage(
        `${categoryLabel(
          category,
        )} saved successfully.`,
      );
    } catch (caughtError) {
      setCategorySaveState(
        category,
        "error",
      );

      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "The collection could not be saved.",
      );
    } finally {
      setBusyCategory(null);
    }
  }

  /*
   * Reordering is a discrete action, so
   * persist it immediately.
   */
  async function saveReorderedImages(
    category: CategoryId,
    nextImages: SelectedWorkImage[],
  ) {
    if (
      busyCategory ||
      analysingCategory
    ) {
      return;
    }

    const previousImages =
      dataRef.current[
        category
      ].map((image) => ({
        ...image,
      }));

    replaceCategory(
      category,
      nextImages,
    );

    setBusyCategory(category);
    setCategorySaveState(
      category,
      "saving",
    );
    setError(null);

    setMessage(
      `${categoryLabel(
        category,
      )} order changed. Saving…`,
    );

    try {
      const savedData =
  await persistCategory(
    category,
    nextImages,
    false,
  );

      replaceCategory(
  category,
  normaliseIncomingImages(
    savedData[category],
  ),
);

      const stillHasPendingMetadata =
  savedData[category].some(
    (image) =>
      Boolean(
        image.suggestedFilename?.trim(),
      ),
  );

setCategorySaveState(
  category,
  stillHasPendingMetadata
    ? "dirty"
    : "saved",
);

      setMessage(
        `${categoryLabel(
          category,
        )} order saved.`,
      );
    } catch (caughtError) {
      /*
       * Put the browser back to the last
       * known order if persistence failed.
       */
      replaceCategory(
        category,
        previousImages,
      );

      setCategorySaveState(
        category,
        "error",
      );

      setError(
        caughtError instanceof
          Error
          ? `${caughtError.message} The previous order has been restored.`
          : "The new order could not be saved. The previous order has been restored.",
      );
    } finally {
      setBusyCategory(null);
      setDraggedImage(null);
    }
  }

  function moveImage(
    category: CategoryId,
    index: number,
    direction: -1 | 1,
  ) {
    if (
      busyCategory ||
      analysingCategory
    ) {
      return;
    }

    const images =
      dataRef.current[
        category
      ];

    const nextIndex =
      index + direction;

    if (
      nextIndex < 0 ||
      nextIndex >=
        images.length
    ) {
      return;
    }

    const nextImages =
      [...images];

    const [image] =
      nextImages.splice(
        index,
        1,
      );

    nextImages.splice(
      nextIndex,
      0,
      image,
    );

    void saveReorderedImages(
      category,
      nextImages,
    );
  }

  function reorderImagesByDrag(
    category: CategoryId,
    targetFilename: string,
  ) {
    if (
      !draggedImage ||
      draggedImage.category !==
        category ||
      draggedImage.filename ===
        targetFilename ||
      busyCategory ||
      analysingCategory
    ) {
      return;
    }

    const images = [
      ...dataRef.current[
        category
      ],
    ];

    const fromIndex =
      images.findIndex(
        (image) =>
          image.filename ===
          draggedImage.filename,
      );

    const toIndex =
      images.findIndex(
        (image) =>
          image.filename ===
          targetFilename,
      );

    if (
      fromIndex === -1 ||
      toIndex === -1
    ) {
      setDraggedImage(null);
      return;
    }

    const [movedImage] =
      images.splice(
        fromIndex,
        1,
      );

    images.splice(
      toIndex,
      0,
      movedImage,
    );

    void saveReorderedImages(
      category,
      images,
    );
  }

  async function uploadImages(
    category: CategoryId,
  ) {
    const files =
      pendingFiles[category];

    if (
      !files ||
      files.length === 0 ||
      busyCategory ||
      analysingCategory
    ) {
      return;
    }

    const batches =
      createUploadBatches(files);

    const total = files.length;
    let uploadedCount = 0;

    setBusyCategory(category);

    setUploadProgress({
      category,
      current: 0,
      total,
    });

    setError(null);
    setMessage(null);

    try {
      for (
        const batch of batches
      ) {
        const formData =
          new FormData();

        formData.set(
          "category",
          category,
        );

        batch.forEach(
          (file) => {
            formData.append(
              "images",
              file,
            );
          },
        );

        const response =
          await fetch(
            "/api/admin/selected-work",
            {
              method: "POST",
              body: formData,
            },
          );

        let result:
          | ApiResponse
          | null = null;

        try {
          result =
            (await response.json()) as
              ApiResponse;
        } catch {
          result = null;
        }

        if (
          !response.ok ||
          !result?.ok ||
          !result.data
        ) {
          if (
            response.status ===
            413
          ) {
            throw new Error(
              "An upload batch was too large. The remaining photographs are still selected so you can retry them.",
            );
          }

          throw new Error(
            result?.message ??
              `The upload stopped after ${uploadedCount} of ${total} photographs. The remaining photographs are still selected so you can retry them.`,
          );
        }

        uploadedCount +=
          batch.length;

        const serverImages =
  normaliseIncomingImages(
    result.data[category],
  );

const currentImages =
  dataRef.current[category];

const currentByFilename =
  new Map(
    currentImages.map((image) => [
      image.filename,
      image,
    ]),
  );

const mergedImages =
  serverImages.map(
    (serverImage) => {
      const currentImage =
        currentByFilename.get(
          serverImage.filename,
        );

      return currentImage
        ? {
            ...serverImage,
            alt: currentImage.alt,
            suggestedFilename:
              currentImage.suggestedFilename,
            analysisStatus:
              currentImage.analysisStatus,
            analysedAt:
              currentImage.analysedAt,
          }
        : serverImage;
    },
  );

replaceCategory(
  category,
  mergedImages,
);

        const remainingFiles =
          files.slice(
            uploadedCount,
          );

        setPendingFiles(
          (current) => ({
            ...current,
            [category]:
              remainingFiles.length >
              0
                ? remainingFiles
                : undefined,
          }),
        );

        setUploadProgress({
          category,
          current:
            uploadedCount,
          total,
        });
      }

      const stillHasPendingMetadata =
  dataRef.current[category].some(
    (image) =>
      Boolean(
        image.suggestedFilename?.trim(),
      ),
  );

setCategorySaveState(
  category,
  stillHasPendingMetadata
    ? "dirty"
    : "saved",
);

      setMessage(
        `${total} ${
          total === 1
            ? "photograph"
            : "photographs"
        } uploaded successfully.`,
      );

      const input =
        document.getElementById(
          `selected-work-upload-${category}`,
        ) as
          | HTMLInputElement
          | null;

      if (input) {
        input.value = "";
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : `The upload stopped after ${uploadedCount} of ${total} photographs. The remaining photographs are still selected so you can retry them.`,
      );
    } finally {
      setBusyCategory(null);
      setUploadProgress(null);
    }
  }

  /*
   * AI analysis now uses the explicit
   * persisted status rather than guessing
   * from whether alt text is blank.
   *
   * Each successful image is persisted
   * immediately before moving on.
   */
  async function analyseNewImages(
    category: CategoryId,
  ) {
    if (
      busyCategory ||
      analysingCategory
    ) {
      return;
    }

    const imagesToAnalyse =
      dataRef.current[
        category
      ]
        .map(
          (image) => ({
            filename:
              image.filename,
          }),
        )
        .filter(
          ({ filename }) => {
            const image =
              dataRef.current[
                category
              ].find(
                (candidate) =>
                  candidate.filename ===
                  filename,
              );

            return (
              image?.analysisStatus ===
              "pending"
            );
          },
        );

    if (
      imagesToAnalyse.length ===
      0
    ) {
      setMessage(
        `${categoryLabel(
          category,
        )} has no photographs awaiting AI analysis.`,
      );

      setError(null);
      return;
    }

    setAnalysingCategory(
      category,
    );

    setAnalysisProgress({
      current: 0,
      total:
        imagesToAnalyse.length,
    });

    setError(null);
    setMessage(null);

    try {
      for (
        let itemIndex = 0;
        itemIndex <
        imagesToAnalyse.length;
        itemIndex += 1
      ) {
        const {
          filename,
        } =
          imagesToAnalyse[
            itemIndex
          ];

        setAnalysisProgress({
          current:
            itemIndex + 1,
          total:
            imagesToAnalyse.length,
        });

        const currentImage =
          dataRef.current[
            category
          ].find(
            (image) =>
              image.filename ===
              filename,
          );

        if (!currentImage) {
          throw new Error(
            `${filename} could not be found in the collection.`,
          );
        }

        const response =
          await fetch(
            "/api/admin/vision/analyse-image",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                selectedWorkCategory:
                  category,
                image:
                  currentImage.filename,
              }),
            },
          );

        let result:
          | VisionResponse
          | null = null;

        try {
          result =
            (await response.json()) as
              VisionResponse;
        } catch {
          result = null;
        }

        if (
          !response.ok ||
          !result?.ok ||
          !result.metadata
        ) {
          throw new Error(
            result?.message ??
              `Vision AI could not analyse ${currentImage.filename}.`,
          );
        }

        const analysedAt =
          new Date().toISOString();

        const updatedImages =
          dataRef.current[
            category
          ].map(
            (image) =>
              image.filename ===
              currentImage.filename
                ? {
                    ...image,
                    alt:
                      result
                        ?.metadata
                        ?.alt ??
                      "",
                    suggestedFilename:
                      result
                        ?.metadata
                        ?.filename ??
                      "",
                    analysisStatus:
                      "complete" as const,
                    analysedAt,
                  }
                : image,
          );

        /*
         * Show the result immediately.
         */
        replaceCategory(
          category,
          updatedImages,
        );

        setCategorySaveState(
          category,
          "saving",
        );

        /*
         * Then make that individual
         * successful analysis durable.
         */
        const savedData =
  await persistCategory(
    category,
    updatedImages,
    false,
  );

        replaceCategory(
  category,
  normaliseIncomingImages(
    savedData[category],
  ),
);

                setCategorySaveState(
          category,
          "dirty",
        );
      }

            setMessage(
        `${categoryLabel(
          category,
        )} AI analysis completed. Review the AI metadata, then save the collection to apply the suggested filenames.`,
      );
    } catch (caughtError) {
      setCategorySaveState(
        category,
        "error",
      );

      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Vision AI analysis failed.",
      );
    } finally {
      setAnalysingCategory(
        null,
      );

      setAnalysisProgress(
        null,
      );
    }
  }
    async function analyseSingleImage(
    category: CategoryId,
    filename: string,
  ) {
    if (
      busyCategory ||
      analysingCategory
    ) {
      return;
    }

    const currentImage =
      dataRef.current[
        category
      ].find(
        (image) =>
          image.filename ===
          filename,
      );

    if (!currentImage) {
      setError(
        `${filename} could not be found in the collection.`,
      );
      return;
    }

    setAnalysingCategory(
      category,
    );

    setAnalysisProgress({
      current: 1,
      total: 1,
    });

    setError(null);
    setMessage(
      `Analysing ${filename}…`,
    );

    try {
      const response =
        await fetch(
          "/api/admin/vision/analyse-image",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              selectedWorkCategory:
                category,
              image:
                currentImage.filename,
            }),
          },
        );

      let result:
        | VisionResponse
        | null = null;

      try {
        result =
          (await response.json()) as
            VisionResponse;
      } catch {
        result = null;
      }

      if (
        !response.ok ||
        !result?.ok ||
        !result.metadata
      ) {
        throw new Error(
          result?.message ??
            `Vision AI could not analyse ${currentImage.filename}.`,
        );
      }
      const metadata =
        result.metadata;
      const analysedAt =
        new Date().toISOString();

      const updatedImages =
        dataRef.current[
          category
        ].map(
          (image) =>
            image.filename ===
            currentImage.filename
              ? {
                  ...image,
                                    alt:
                    metadata.alt,
                  suggestedFilename:
                    metadata.filename,
                  analysisStatus:
                    "complete" as const,
                  analysedAt,
                }
              : image,
        );

      /*
       * Show the AI result immediately.
       */
      replaceCategory(
        category,
        updatedImages,
      );

      setCategorySaveState(
        category,
        "saving",
      );

      /*
       * Persist it before declaring the
       * analysis complete.
       */
      const savedData =
  await persistCategory(
    category,
    updatedImages,
    false,
  );

      replaceCategory(
  category,
  normaliseIncomingImages(
    savedData[category],
  ),
);

            setCategorySaveState(
        category,
        "dirty",
      );

      setMessage(
        `${currentImage.filename} analysed. Review the AI metadata, then save the collection to apply the suggested filename.`,
      );
    } catch (caughtError) {
      setCategorySaveState(
        category,
        "error",
      );

      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : `Vision AI could not analyse ${currentImage.filename}.`,
      );
    } finally {
      setAnalysingCategory(
        null,
      );

      setAnalysisProgress(
        null,
      );
    }
  }

  async function deleteImage(
    category: CategoryId,
    filename: string,
  ) {
    const confirmed =
      window.confirm(
        `Permanently remove ${filename} from Selected Work?`,
      );

    if (
      !confirmed ||
      busyCategory ||
      analysingCategory
    ) {
      return;
    }

    setBusyCategory(category);
    setError(null);
    setMessage(null);

    try {
      const response =
        await fetch(
          "/api/admin/selected-work",
          {
            method: "DELETE",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              category,
              filename,
            }),
          },
        );

      const result =
        (await response.json()) as
          ApiResponse;

      if (
        !response.ok ||
        !result.ok ||
        !result.data
      ) {
        throw new Error(
          result.message ??
            "The photograph could not be removed.",
        );
      }

      replaceCategory(
  category,
  normaliseIncomingImages(
    result.data[category],
  ),
);

      setSelectedImages(
        (current) => {
          const next =
            new Set(
              current[
                category
              ],
            );

          next.delete(
            filename,
          );

          return {
            ...current,
            [category]: next,
          };
        },
      );

      setCategorySaveState(
        category,
        "saved",
      );

      setMessage(
        "Photograph removed successfully.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "The photograph could not be removed.",
      );
    } finally {
      setBusyCategory(null);
    }
  }

  async function deleteSelectedImages(
    category: CategoryId,
  ) {
    const filenames =
      Array.from(
        selectedImages[
          category
        ],
      );

    if (
      filenames.length === 0 ||
      busyCategory ||
      analysingCategory
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Permanently remove ${
          filenames.length
        } ${
          filenames.length === 1
            ? "photograph"
            : "photographs"
        } from Selected Work?`,
      );

    if (!confirmed) {
      return;
    }

    setBusyCategory(category);
    setError(null);
    setMessage(null);

    let deletedCount = 0;

    try {
      for (
        const filename of
        filenames
      ) {
        const response =
          await fetch(
            "/api/admin/selected-work",
            {
              method: "DELETE",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  category,
                  filename,
                }),
            },
          );

        const result =
          (await response.json()) as
            ApiResponse;

        if (
          !response.ok ||
          !result.ok ||
          !result.data
        ) {
          throw new Error(
            result.message ??
              `Bulk removal stopped after ${deletedCount} of ${filenames.length} photographs.`,
          );
        }

        deletedCount += 1;

        replaceCategory(
  category,
  normaliseIncomingImages(
    result.data[category],
  ),
);
      }

      setSelectedImages(
        (current) => ({
          ...current,
          [category]:
            new Set<string>(),
        }),
      );

      setCategorySaveState(
        category,
        "saved",
      );

      setMessage(
        `${deletedCount} ${
          deletedCount === 1
            ? "photograph"
            : "photographs"
        } removed successfully.`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : `Bulk removal stopped after ${deletedCount} of ${filenames.length} photographs.`,
      );
    } finally {
      setBusyCategory(null);
    }
  }

  function saveStateLabel(
    state: SaveState,
  ) {
    switch (state) {
      case "dirty":
        return "Unsaved changes";

      case "saving":
        return "Saving…";

      case "saved":
        return "Saved";

      case "error":
        return "Not saved";

      default:
        return null;
    }
  }

  if (loading) {
    return (
      <p
        style={{
          marginTop: "4rem",
        }}
      >
        Loading Selected Work…
      </p>
    );
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          gap: "2rem",
          alignItems: "baseline",
          marginTop: "5rem",
          borderBottom:
            "1px solid rgba(242, 238, 230, 0.18)",
          paddingBottom: "1rem",
        }}
      >
        <p
          className="backstage-eyebrow"
          style={{ margin: 0 }}
        >
          Portfolio collections
        </p>

        <p
          style={{
            margin: 0,
            color:
              "rgba(242, 238, 230, 0.48)",
            fontSize: "0.55rem",
            letterSpacing:
              "0.14em",
            textTransform:
              "uppercase",
          }}
        >
          {totalImages} images
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          style={{
            color: "#ffb3a7",
            marginTop: "1.5rem",
          }}
        >
          {error}
        </p>
      ) : null}

      {message ? (
        <p
          role="status"
          style={{
            color: "#c7a369",
            marginTop: "1.5rem",
          }}
        >
          {message}
        </p>
      ) : null}

      {CATEGORIES.map(
        (category) => {
          const images =
            data[category.id];

          const isBusy =
            busyCategory ===
            category.id;

          const isAnalysing =
            analysingCategory ===
            category.id;

          const selectedFiles =
            pendingFiles[
              category.id
            ];

          const selectedCount =
            selectedImages[
              category.id
            ].size;

          const pendingAnalysisCount =
            images.filter(
              (image) =>
                image.analysisStatus ===
                "pending",
            ).length;

          const controlsDisabled =
            Boolean(
              busyCategory,
            ) ||
            Boolean(
              analysingCategory,
            );

          const currentSaveState =
            saveState[
              category.id
            ];

          const stateLabel =
            saveStateLabel(
              currentSaveState,
            );

          return (
            <section
              key={category.id}
              onMouseEnter={() =>
                setActiveCategory(
                  category.id,
                )
              }
              onFocusCapture={() =>
                setActiveCategory(
                  category.id,
                )
              }
            >
              <header
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "3rem minmax(0, 1fr)",
                  gap: "2rem",
                }}
              >
                <p
                  className="backstage-eyebrow"
                  style={{
                    marginTop:
                      "0.75rem",
                  }}
                >
                  {category.number}
                </p>

                <div>
                  <div
                    style={{
                      display:
                        "flex",
                      flexWrap:
                        "wrap",
                      alignItems:
                        "baseline",
                      justifyContent:
                        "space-between",
                      gap: "1rem",
                    }}
                  >
                    <h2
                      style={{
                        margin: 0,
                        fontFamily:
                          '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
                        fontSize:
                          "clamp(2.4rem, 5vw, 5rem)",
                        fontWeight:
                          400,
                        lineHeight:
                          0.95,
                      }}
                    >
                      {
                        category.title
                      }
                    </h2>

                    {stateLabel ? (
                      <span
                        role="status"
                        style={{
                          color:
                            currentSaveState ===
                            "error"
                              ? "#ffb3a7"
                              : currentSaveState ===
                                  "dirty"
                                ? "#c7a369"
                                : "rgba(242, 238, 230, 0.52)",
                          fontSize:
                            "0.62rem",
                          letterSpacing:
                            "0.12em",
                          textTransform:
                            "uppercase",
                        }}
                      >
                        {
                          stateLabel
                        }
                      </span>
                    ) : null}
                  </div>

                  <p
                    style={{
                      maxWidth:
                        "42rem",
                      margin:
                        "1rem 0 0",
                      color:
                        "rgba(242, 238, 230, 0.58)",
                      lineHeight:
                        1.7,
                    }}
                  >
                    {
                      category.description
                    }
                  </p>
                </div>
              </header>

              <div
                className="backstage-panel"
                style={{
                  padding:
                    "1.5rem",
                  marginTop:
                    "2.5rem",
                }}
              >
                <label className="backstage-field">
                  <span className="backstage-field-label">
                    Add JPEG
                    photographs
                  </span>

                  <input
                    id={`selected-work-upload-${category.id}`}
                    type="file"
                    accept="image/jpeg,.jpg,.jpeg"
                    multiple
                    disabled={
                      controlsDisabled
                    }
                    onChange={(
                      event: ChangeEvent<HTMLInputElement>,
                    ) => {
                      if (
                        event.target
                          .files
                      ) {
                        setPendingFiles(
                          (
                            current,
                          ) => ({
                            ...current,
                            [category.id]:
                              event
                                .target
                                .files
                                ? Array.from(
                                    event
                                      .target
                                      .files,
                                  )
                                : undefined,
                          }),
                        );
                      }
                    }}
                    style={{
                      display:
                        "block",
                      width: "100%",
                      border:
                        "1px solid rgba(242, 238, 230, 0.2)",
                      padding: "1rem",
                      background:
                        "rgba(255, 255, 255, 0.025)",
                      color:
                        "inherit",
                    }}
                  />
                </label>

                <div
                  style={{
                    display: "flex",
                    flexWrap:
                      "wrap",
                    gap: "0.75rem",
                    marginTop:
                      "1rem",
                  }}
                >
                  <button
                    type="button"
                    className="backstage-button"
                    disabled={
                      !selectedFiles?.length ||
                      controlsDisabled
                    }
                    onClick={() =>
                      void uploadImages(
                        category.id,
                      )
                    }
                  >
                    {isBusy &&
                    uploadProgress?.category ===
                      category.id
                      ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}…`
                      : "Upload photographs"}
                  </button>

                  <button
                    type="button"
                    className="backstage-button"
                    disabled={
                      pendingAnalysisCount ===
                        0 ||
                      controlsDisabled
                    }
                    onClick={() =>
                      void analyseNewImages(
                        category.id,
                      )
                    }
                  >
                    {isAnalysing &&
                    analysisProgress
                      ? `Analysing ${analysisProgress.current} of ${analysisProgress.total}…`
                      : `Analyse new images (${pendingAnalysisCount})`}
                  </button>
                </div>

                {selectedFiles?.length ? (
                  <p
                    role="status"
                    style={{
                      margin:
                        "0.9rem 0 0",
                      color:
                        "#c7a369",
                      fontSize:
                        "0.72rem",
                      lineHeight:
                        1.6,
                    }}
                  >
                    {uploadProgress?.category ===
                    category.id
                      ? `Uploading ${uploadProgress.current} of ${uploadProgress.total} photographs…`
                      : `${selectedFiles.length} ${
                          selectedFiles.length ===
                          1
                            ? "photograph"
                            : "photographs"
                        } selected. Large selections are uploaded automatically in safe batches.`}
                  </p>
                ) : null}

                <p
                  style={{
                    margin:
                      "0.9rem 0 0",
                    color:
                      "rgba(242, 238, 230, 0.45)",
                    fontSize:
                      "0.72rem",
                    lineHeight:
                      1.6,
                  }}
                >
                  Vision AI analyses
                  photographs that
                  have not yet been
                  analysed. Successful
                  results are saved
                  automatically.
                </p>
              </div>

              {images.length >
              0 ? (
                <>
                  <div
                    style={{
                      display:
                        "flex",
                      flexWrap:
                        "wrap",
                      alignItems:
                        "center",
                      gap: "0.75rem",
                      marginTop:
                        "2rem",
                    }}
                  >
                    <button
                      type="button"
                      className="backstage-button"
                      disabled={
                        controlsDisabled
                      }
                      onClick={() =>
                        setSelectedImages(
                          (
                            current,
                          ) => ({
                            ...current,
                            [category.id]:
                              new Set(
                                images.map(
                                  (
                                    image,
                                  ) =>
                                    image.filename,
                                ),
                              ),
                          }),
                        )
                      }
                    >
                      Select all
                    </button>

                    <button
                      type="button"
                      className="backstage-button"
                      disabled={
                        selectedCount ===
                          0 ||
                        controlsDisabled
                      }
                      onClick={() =>
                        setSelectedImages(
                          (
                            current,
                          ) => ({
                            ...current,
                            [category.id]:
                              new Set<string>(),
                          }),
                        )
                      }
                    >
                      Clear selection
                    </button>

                    <span
                      style={{
                        color:
                          selectedCount >
                          0
                            ? "#c7a369"
                            : "rgba(242, 238, 230, 0.45)",
                        fontSize:
                          "0.65rem",
                        letterSpacing:
                          "0.08em",
                        textTransform:
                          "uppercase",
                      }}
                    >
                      {
                        selectedCount
                      }{" "}
                      selected
                    </span>

                    <button
                      type="button"
                      className="backstage-button"
                      disabled={
                        selectedCount ===
                          0 ||
                        controlsDisabled
                      }
                      onClick={() =>
                        void deleteSelectedImages(
                          category.id,
                        )
                      }
                    >
                      Remove selected
                    </button>

                    <span
                      style={{
                        marginLeft:
                          "auto",
                        color:
                          "rgba(242, 238, 230, 0.42)",
                        fontSize:
                          "0.62rem",
                        letterSpacing:
                          "0.08em",
                        textTransform:
                          "uppercase",
                      }}
                    >
                      ⋮⋮ Drag
                      photographs to
                      reorder
                    </span>
                  </div>
                </>
              ) : null}

              {images.length ===
              0 ? (
                <p
                  style={{
                    margin:
                      "2rem 0 0",
                    color:
                      "rgba(242, 238, 230, 0.45)",
                  }}
                >
                  No photographs
                  uploaded to this
                  collection yet.
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(min(100%, 20rem), 1fr))",
                    gap: "1rem",
                    marginTop:
                      "2rem",
                  }}
                >
                  {images.map(
                    (
                      image,
                      index,
                    ) => (
                      <article
                        key={
                          image.filename
                        }
                        draggable={
                          !controlsDisabled
                        }
                        onDragStart={() =>
                          setDraggedImage(
                            {
                              category:
                                category.id,
                              filename:
                                image.filename,
                            },
                          )
                        }
                        onDragOver={(
                          event,
                        ) => {
                          event.preventDefault();
                        }}
                        onDrop={(
                          event,
                        ) => {
                          event.preventDefault();

                          reorderImagesByDrag(
                            category.id,
                            image.filename,
                          );
                        }}
                        onDragEnd={() => {
                          setDraggedImage(
                            null,
                          );
                        }}
                        style={{
                          overflow:
                            "hidden",
                          border:
                            draggedImage?.category ===
                              category.id &&
                            draggedImage.filename ===
                              image.filename
                              ? "1px solid #c7a369"
                              : "1px solid rgba(242, 238, 230, 0.14)",
                          background:
                            "rgba(255, 255, 255, 0.02)",
                          opacity:
                            draggedImage?.category ===
                              category.id &&
                            draggedImage.filename ===
                              image.filename
                              ? 0.55
                              : 1,
                        }}
                      >
                        <div
                          title="Drag this photograph to reorder"
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "space-between",
                            gap: "1rem",
                            padding:
                              "0.7rem 1rem",
                            borderBottom:
                              "1px solid rgba(242, 238, 230, 0.12)",
                            cursor:
                              controlsDisabled
                                ? "default"
                                : "grab",
                          }}
                        >
                          <span
                            style={{
                              color:
                                "#c7a369",
                              fontSize:
                                "1rem",
                              letterSpacing:
                                "0.08em",
                            }}
                            aria-hidden="true"
                          >
                            ⋮⋮
                          </span>

                          <span
                            style={{
                              color:
                                "rgba(242, 238, 230, 0.48)",
                              fontSize:
                                "0.58rem",
                              letterSpacing:
                                "0.1em",
                              textTransform:
                                "uppercase",
                            }}
                          >
                            Drag to
                            reorder
                          </span>

                          <span
                            style={{
                              color:
                                "rgba(242, 238, 230, 0.38)",
                              fontSize:
                                "0.58rem",
                              letterSpacing:
                                "0.08em",
                              textTransform:
                                "uppercase",
                            }}
                          >
                            {index + 1} /{" "}
                            {
                              images.length
                            }
                          </span>
                        </div>

                        <label
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            gap: "0.65rem",
                            padding:
                              "0.8rem 1rem",
                            borderBottom:
                              "1px solid rgba(242, 238, 230, 0.12)",
                            cursor:
                              "pointer",
                            fontSize:
                              "0.65rem",
                            letterSpacing:
                              "0.08em",
                            textTransform:
                              "uppercase",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedImages[
                              category
                                .id
                            ].has(
                              image.filename,
                            )}
                            onChange={() =>
                              toggleImageSelection(
                                category.id,
                                image.filename,
                              )
                            }
                          />

                          <span>
                            Select
                            photograph
                          </span>
                        </label>

                        <div
                          style={{
                            aspectRatio:
                              "4 / 3",
                            background:
                              "#080808",
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/images/selected-work/${category.id}/${image.filename}`}
                            alt={
                              image.alt
                            }
                            loading="lazy"
                            style={{
                              display:
                                "block",
                              width:
                                "100%",
                              height:
                                "100%",
                              objectFit:
                                "contain",
                            }}
                          />
                        </div>

                        <div
                          style={{
                            padding:
                              "1rem",
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              alignItems:
                                "baseline",
                              gap: "1rem",
                            }}
                          >
                            <p className="backstage-field-label">
                              Filename
                            </p>

                            <span
                              style={{
                                color:
                                  image.analysisStatus ===
                                  "complete"
                                    ? "rgba(242, 238, 230, 0.42)"
                                    : "#c7a369",
                                fontSize:
                                  "0.55rem",
                                letterSpacing:
                                  "0.1em",
                                textTransform:
                                  "uppercase",
                              }}
                            >
                              {image.analysisStatus ===
                              "complete"
                                ? "AI analysed"
                                : "Awaiting AI"}
                            </span>
                            {image.analysisStatus === "pending" ? (
  <button
    type="button"
    className="backstage-button"
    disabled={controlsDisabled}
    onClick={() =>
      void analyseSingleImage(
        category.id,
        image.filename,
      )
    }
    style={{
      marginTop: "0.75rem",
      width: "100%",
    }}
  >
    Analyse image
  </button>
) : null}
                          </div>

                          <p
                            title={
                              image.filename
                            }
                            style={{
                              overflow:
                                "hidden",
                              margin:
                                "0.4rem 0 0",
                              textOverflow:
                                "ellipsis",
                              whiteSpace:
                                "nowrap",
                              fontSize:
                                "0.68rem",
                            }}
                          >
                            {
                              image.filename
                            }
                          </p>

                          <label
                            className="backstage-field"
                            style={{
                              marginTop:
                                "1rem",
                            }}
                          >
                            <span className="backstage-field-label">
                              Suggested
                              filename
                            </span>

                            <input
                              className="backstage-input"
                              value={
                                image.suggestedFilename ??
                                ""
                              }
                              placeholder="AI filename"
                              onChange={(
                                event,
                              ) =>
                                updateImage(
                                  category.id,
                                  index,
                                  {
                                    suggestedFilename:
                                      event
                                        .target
                                        .value,
                                  },
                                )
                              }
                            />
                          </label>

                          <label
                            className="backstage-field"
                            style={{
                              marginTop:
                                "1rem",
                            }}
                          >
                            <span className="backstage-field-label">
                              Alt text
                            </span>

                            <textarea
                              className="backstage-textarea"
                              rows={4}
                              value={
                                image.alt
                              }
                              onChange={(
                                event,
                              ) =>
                                updateImage(
                                  category.id,
                                  index,
                                  {
                                    alt:
                                      event
                                        .target
                                        .value,
                                  },
                                )
                              }
                            />
                          </label>

                          <div
                            style={{
                              display:
                                "grid",
                              gridTemplateColumns:
                                "repeat(2, minmax(0, 1fr))",
                              gap: "0.6rem",
                              marginTop:
                                "1rem",
                            }}
                          >
                            <button
                              type="button"
                              className="backstage-button"
                              disabled={
                                index ===
                                  0 ||
                                controlsDisabled
                              }
                              onClick={() =>
                                moveImage(
                                  category.id,
                                  index,
                                  -1,
                                )
                              }
                            >
                              Move earlier
                            </button>

                            <button
                              type="button"
                              className="backstage-button"
                              disabled={
                                index ===
                                  images.length -
                                    1 ||
                                controlsDisabled
                              }
                              onClick={() =>
                                moveImage(
                                  category.id,
                                  index,
                                  1,
                                )
                              }
                            >
                              Move later
                            </button>
                          </div>

                          <button
                            type="button"
                            className="backstage-button"
                            disabled={
                              controlsDisabled
                            }
                            onClick={() =>
                              void deleteImage(
                                category.id,
                                image.filename,
                              )
                            }
                            style={{
                              width:
                                "100%",
                              marginTop:
                                "0.6rem",
                            }}
                          >
                            Remove image
                          </button>
                        </div>
                      </article>
                    ),
                  )}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  flexWrap: "wrap",
                  gap: "1rem",
                  marginTop: "2rem",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color:
                      currentSaveState ===
                      "dirty"
                        ? "#c7a369"
                        : currentSaveState ===
                            "error"
                          ? "#ffb3a7"
                          : "rgba(242, 238, 230, 0.42)",
                    fontSize:
                      "0.62rem",
                    letterSpacing:
                      "0.08em",
                    textTransform:
                      "uppercase",
                  }}
                >
                  {currentSaveState ===
                  "dirty"
                    ? "You have unsaved metadata changes"
                    : currentSaveState ===
                        "saving"
                      ? "Saving changes…"
                      : currentSaveState ===
                          "saved"
                        ? "All changes saved"
                        : currentSaveState ===
                            "error"
                          ? "Changes have not been saved"
                          : ""}
                </p>

                <button
                  type="button"
                  className="backstage-button backstage-button-primary"
                  disabled={
                    controlsDisabled ||
                    currentSaveState ===
                      "clean" ||
                    currentSaveState ===
                      "saved"
                  }
                  onClick={() =>
                    void saveCategory(
                      category.id,
                    )
                  }
                >
                  {isBusy
                    ? "Saving…"
                    : currentSaveState ===
                        "dirty" ||
                        currentSaveState ===
                          "error"
                      ? `Save ${category.title}`
                      : "Saved"}
                </button>
              </div>
            </section>
          );
        },
      )}
    </>
  );
}