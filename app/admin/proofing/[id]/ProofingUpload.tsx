"use client";

import {
  ChangeEvent,
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  makeProofThumbnail,
  uploadProofThumbnail,
} from "@/lib/proofing/thumbnail-client";

const MAX_PROOF_DIMENSION = 2400;
const MAX_UPLOAD_BYTES = 3.75 * 1024 * 1024;

type PreparedProofUpload = {
  file: File;
  width: number;
  height: number;
};

export async function prepareProofUpload(
  file: File,
): Promise<PreparedProofUpload> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(
          new Error(
            `Could not prepare ${file.name}.`,
          ),
        );

      image.src = objectUrl;
    });

    let width = image.naturalWidth;
    let height = image.naturalHeight;

    if (
      file.type === "image/webp" &&
      width <= MAX_PROOF_DIMENSION &&
      height <= MAX_PROOF_DIMENSION &&
      file.size <= MAX_UPLOAD_BYTES
    ) {
      return {
        file,
        width,
        height,
      };
    }

    const initialScale = Math.min(
      1,
      MAX_PROOF_DIMENSION / width,
      MAX_PROOF_DIMENSION / height,
    );

    width = Math.max(
      1,
      Math.round(width * initialScale),
    );

    height = Math.max(
      1,
      Math.round(height * initialScale),
    );

    const canvas =
      document.createElement("canvas");

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error(
        `Could not prepare ${file.name}.`,
      );
    }

    let quality = 0.82;

    while (true) {
      canvas.width = width;
      canvas.height = height;

      context.clearRect(
        0,
        0,
        width,
        height,
      );

      context.drawImage(
        image,
        0,
        0,
        width,
        height,
      );

      const blob = await new Promise<Blob>(
        (resolve, reject) => {
          canvas.toBlob(
            (result) => {
              if (result) {
                resolve(result);
              } else {
                reject(
                  new Error(
                    `Could not prepare ${file.name}.`,
                  ),
                );
              }
            },
            "image/webp",
            quality,
          );
        },
      );

      if (
        blob.size <= MAX_UPLOAD_BYTES ||
        (width <= 1200 && height <= 1200)
      ) {
        return {
          file: new File(
            [blob],
            file.name,
            {
              type: "image/webp",
              lastModified: file.lastModified,
            },
          ),
          width,
          height,
        };
      }

      if (quality > 0.58) {
        quality -= 0.08;
      } else {
        width = Math.max(
          1,
          Math.round(width * 0.85),
        );

        height = Math.max(
          1,
          Math.round(height * 0.85),
        );

        quality = 0.74;
      }
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/*
 * Uploads run from one place for the whole gallery page, so progress stays
 * on screen (under the Media / Settings / Branding menu) whichever tab is
 * open, and duplicates are caught before anything is uploaded.
 */

type ExistingImage = {
  id: string;
  originalFilename: string;
};

type UploadJob = {
  file: File;
  replaceImageId?: string;
};

type UploadFailure = {
  job: UploadJob;
  message: string;
};

type DuplicateQuestion = {
  fresh: File[];
  duplicates: UploadJob[];
};

type UploadSummary = {
  uploaded: number;
  replaced: number;
  skipped: number;
  repeated: number;
};

type UploadState = {
  phase: "idle" | "uploading" | "finished";
  total: number;
  completed: number;
  failures: UploadFailure[];
  summary: UploadSummary;
};

type UploadContextValue = {
  state: UploadState;
  isUploading: boolean;
  chooseFiles: (files: File[]) => void;
  retryFailed: () => void;
  dismiss: () => void;
};

const EMPTY_SUMMARY: UploadSummary = {
  uploaded: 0,
  replaced: 0,
  skipped: 0,
  repeated: 0,
};

const IDLE: UploadState = {
  phase: "idle",
  total: 0,
  completed: 0,
  failures: [],
  summary: EMPTY_SUMMARY,
};

const UploadContext =
  createContext<UploadContextValue | null>(null);

function useUploads() {
  const value = useContext(UploadContext);

  if (!value) {
    throw new Error(
      "Proofing uploads need ProofingUploadProvider.",
    );
  }

  return value;
}

const plural = (count: number, word: string) =>
  `${count.toLocaleString("en-GB")} ${word}${count === 1 ? "" : "s"}`;

const nameKey = (name: string) =>
  name.trim().toLowerCase();

type UploadedProofMetadata = {
  imageId: string;
  originalFilename: string;
  webFilename: string;
  width: number;
  height: number;
  createdAt: string;
  replaceImageId?: string;
};

type SignedUploadJob = {
  originalFilename: string;
  imageId: string;
  webFilename: string;
  uploadUrl: string;
  thumbUploadUrl?: string;
};

async function uploadOne(
  job: UploadJob,
  signed: SignedUploadJob,
): Promise<UploadedProofMetadata> {
  const prepared =
    await prepareProofUpload(job.file);

  const r2Response = await fetch(
    signed.uploadUrl,
    {
      method: "PUT",
      headers: {
        "Content-Type": "image/webp",
      },
      body: prepared.file,
    },
  );

  if (!r2Response.ok) {
    throw new Error(
      `Upload failed (HTTP ${r2Response.status}).`,
    );
  }

  // The small grid thumbnail. Not fatal: without it the gallery just
  // shows the full proof, and "Make thumbnails" can fill it in later.
  if (signed.thumbUploadUrl) {
    await makeProofThumbnail(prepared.file)
      .then((thumb) =>
        uploadProofThumbnail(signed.thumbUploadUrl as string, thumb),
      )
      .catch(() => undefined);
  }

  return {
    imageId: signed.imageId,
    originalFilename: job.file.name,
    webFilename: signed.webFilename,
    width: prepared.width,
    height: prepared.height,
    createdAt: new Date(
      job.file.lastModified || Date.now(),
    ).toISOString(),
    ...(job.replaceImageId
      ? { replaceImageId: job.replaceImageId }
      : {}),
  };
}

async function postUpload<T>(
  body: Record<string, unknown>,
  fallback: string,
): Promise<T> {
  const response = await fetch(
    "/api/admin/proofing/upload",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const result = (await response
    .json()
    .catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
  } & T;

  if (!response.ok || !result.ok) {
    throw new Error(result.message || fallback);
  }

  return result;
}

export function ProofingUploadProvider({
  galleryId,
  existingImages,
  children,
}: {
  galleryId: string;
  existingImages: ExistingImage[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [state, setState] =
    useState<UploadState>(IDLE);
  const [question, setQuestion] =
    useState<DuplicateQuestion | null>(null);
  const [repeated, setRepeated] = useState(0);
  const running = useRef(false);
  const existingRef = useRef(existingImages);
  useEffect(() => {
    existingRef.current = existingImages;
  }, [existingImages]);

  const isUploading = state.phase === "uploading";

  // Warn before closing the tab mid-upload.
  useEffect(() => {
    if (!isUploading) {
      return;
    }

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    window.addEventListener("beforeunload", warn);
    return () =>
      window.removeEventListener("beforeunload", warn);
  }, [isUploading]);

  const run = useCallback(
    async (jobs: UploadJob[], repeatedCount: number) => {
      if (running.current) {
        return;
      }

      running.current = true;

      const summary: UploadSummary = {
        ...EMPTY_SUMMARY,
        repeated: repeatedCount,
      };

      if (jobs.length === 0) {
        setState({
          ...IDLE,
          phase: "finished",
          summary,
        });
        running.current = false;
        return;
      }

      setState({
        phase: "uploading",
        total: jobs.length,
        completed: 0,
        failures: [],
        summary,
      });

      const failures: UploadFailure[] = [];
      let lastRefresh = Date.now();

      /*
       * Several browser -> R2 transfers at once give good speed while
       * keeping browser memory in check. Details are saved once per
       * batch, after that batch's photos are safely in storage.
       */
      const concurrency = jobs.every(
        (job) => job.file.type === "image/webp",
      )
        ? 12
        : 6;

      for (
        let index = 0;
        index < jobs.length;
        index += concurrency
      ) {
        const batch = jobs.slice(
          index,
          index + concurrency,
        );

        try {
          const { jobs: signedJobs } = await postUpload<{
            jobs: SignedUploadJob[];
          }>(
            {
              action: "presign-batch",
              galleryId,
              originalFilenames: batch.map(
                (job) => job.file.name,
              ),
            },
            "Couldn't get ready to upload.",
          );

          if (
            !Array.isArray(signedJobs) ||
            signedJobs.length !== batch.length
          ) {
            throw new Error(
              "Couldn't get ready to upload.",
            );
          }

          const results = await Promise.all(
            batch.map(async (job, batchIndex) => {
              try {
                return {
                  job,
                  uploaded: await uploadOne(
                    job,
                    signedJobs[batchIndex],
                  ),
                  error: null as string | null,
                };
              } catch (error) {
                return {
                  job,
                  uploaded: null,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Upload failed.",
                };
              }
            }),
          );

          const uploaded = results.flatMap(
            (result) =>
              result.uploaded ? [result.uploaded] : [],
          );

          for (const result of results) {
            if (result.error) {
              failures.push({
                job: result.job,
                message: result.error,
              });
            }
          }

          if (uploaded.length > 0) {
            try {
              const saved = await postUpload<{
                committed?: number;
                replaced?: number;
                skipped?: string[];
              }>(
                {
                  action: "commit-batch",
                  galleryId,
                  images: uploaded,
                },
                "The photos uploaded but couldn't be added to the gallery.",
              );

              summary.uploaded += saved.committed ?? 0;
              summary.replaced += saved.replaced ?? 0;
              summary.skipped += saved.skipped?.length ?? 0;
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : "Couldn't add the photos to the gallery.";

              for (const result of results) {
                if (result.uploaded) {
                  failures.push({
                    job: result.job,
                    message,
                  });
                }
              }
            }
          }
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Couldn't get ready to upload.";

          for (const job of batch) {
            failures.push({ job, message });
          }
        }

        setState((current) => ({
          ...current,
          completed: Math.min(
            jobs.length,
            index + batch.length,
          ),
          failures: [...failures],
          summary: { ...summary },
        }));

        // Show new photos as they arrive, without reloading constantly.
        if (Date.now() - lastRefresh > 20000) {
          lastRefresh = Date.now();
          router.refresh();
        }
      }

      setState((current) => ({
        ...current,
        phase: "finished",
        completed: jobs.length,
        failures,
        summary: { ...summary },
      }));

      running.current = false;
      router.refresh();
    },
    [galleryId, router],
  );

  const chooseFiles = useCallback(
    (picked: File[]) => {
      if (running.current) {
        return;
      }

      const images = picked.filter((file) =>
        file.type.startsWith("image/"),
      );

      // The same file name twice in one selection: keep the first.
      const seen = new Set<string>();
      const unique: File[] = [];
      for (const file of images) {
        const key = nameKey(file.name);
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(file);
        }
      }
      const repeatedCount =
        images.length - unique.length;

      const existing = new Map(
        existingRef.current.map((image) => [
          nameKey(image.originalFilename),
          image.id,
        ]),
      );

      const fresh: File[] = [];
      const duplicates: UploadJob[] = [];
      for (const file of unique) {
        const existingId = existing.get(
          nameKey(file.name),
        );
        if (existingId) {
          duplicates.push({
            file,
            replaceImageId: existingId,
          });
        } else {
          fresh.push(file);
        }
      }

      if (duplicates.length > 0) {
        setRepeated(repeatedCount);
        setQuestion({ fresh, duplicates });
        return;
      }

      void run(
        fresh.map((file) => ({ file })),
        repeatedCount,
      );
    },
    [run],
  );

  function answer(choice: "replace" | "skip" | "cancel") {
    const current = question;
    setQuestion(null);

    if (!current || choice === "cancel") {
      return;
    }

    const jobs: UploadJob[] =
      current.fresh.map((file) => ({ file }));

    if (choice === "replace") {
      jobs.push(...current.duplicates);
    }

    void run(jobs, repeated).then(() => {
      if (choice === "skip") {
        setState((state) => ({
          ...state,
          summary: {
            ...state.summary,
            skipped:
              state.summary.skipped +
              current.duplicates.length,
          },
        }));
      }
    });
  }

  const retryFailed = useCallback(() => {
    const jobs = state.failures.map(
      (failure) => failure.job,
    );
    void run(jobs, 0);
  }, [run, state.failures]);

  const dismiss = useCallback(() => {
    if (!running.current) {
      setState(IDLE);
    }
  }, []);

  const value = useMemo(
    () => ({
      state,
      isUploading,
      chooseFiles,
      retryFailed,
      dismiss,
    }),
    [state, isUploading, chooseFiles, retryFailed, dismiss],
  );

  return (
    <UploadContext.Provider value={value}>
      {children}

      {question ? (
        <div
          className="proofing-dup-backdrop"
          role="presentation"
        >
          <div
            className="proofing-dup-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="proofing-dup-title"
          >
            <h2 id="proofing-dup-title">
              {question.duplicates.length ===
              question.fresh.length +
                question.duplicates.length
                ? `${question.duplicates.length === 1 ? "This photo is" : `All ${question.duplicates.length} photos are`} already in this gallery`
                : `${plural(question.duplicates.length, "photo")} already in this gallery`}
            </h2>

            <p>
              {question.duplicates.length === 1
                ? "A photo with this file name is already here:"
                : "Photos with these file names are already here:"}
            </p>

            <ul className="proofing-dup-names">
              {question.duplicates
                .slice(0, 6)
                .map((job) => (
                  <li key={job.file.name}>
                    {job.file.name}
                  </li>
                ))}
              {question.duplicates.length > 6 ? (
                <li className="proofing-dup-more">
                  and {question.duplicates.length - 6} more
                </li>
              ) : null}
            </ul>

            {question.fresh.length > 0 ? (
              <p>
                The other{" "}
                {plural(question.fresh.length, "photo")}{" "}
                {question.fresh.length === 1 ? "is" : "are"} new
                and will upload either way.
              </p>
            ) : null}

            <div className="proofing-dup-actions">
              <button
                type="button"
                className="proofing-dup-primary"
                onClick={() => answer("replace")}
              >
                Replace {question.duplicates.length === 1 ? "it" : "them"}
              </button>

              <button
                type="button"
                className="proofing-dup-secondary"
                onClick={() => answer("skip")}
              >
                Skip {question.duplicates.length === 1 ? "it" : "them"}
              </button>

              <button
                type="button"
                className="proofing-dup-cancel"
                onClick={() => answer("cancel")}
              >
                Cancel
              </button>
            </div>

            <p className="proofing-dup-note">
              Replacing swaps in the new picture and keeps the
              photo&rsquo;s place, favourites and notes.
            </p>
          </div>
        </div>
      ) : null}
    </UploadContext.Provider>
  );
}

/** The "Upload Media" button. Picking photos starts the upload. */
export default function ProofingUpload() {
  const { isUploading, chooseFiles } = useUploads();
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleFiles(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    chooseFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  return (
    <div className="proofing-upload-control">
      <input
        ref={inputRef}
        className="proofing-upload-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={isUploading}
        onChange={handleFiles}
      />

      <div className="proofing-upload-actions">
        <button
          type="button"
          className="proofing-upload-choose"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? "Uploading…" : "Upload Media"}
        </button>
      </div>
    </div>
  );
}

/**
 * The progress bar under the gallery menu. Stays put while you move
 * between tabs, and sticks to the top of the screen as you scroll.
 */
export function ProofingUploadStatus() {
  const { state, retryFailed, dismiss } = useUploads();
  const [showDetails, setShowDetails] = useState(false);

  if (state.phase === "idle") {
    return null;
  }

  const { summary, failures } = state;
  const percent =
    state.total > 0
      ? Math.round((state.completed / state.total) * 100)
      : 100;

  const extras = [
    summary.replaced
      ? `${plural(summary.replaced, "photo")} replaced`
      : "",
    summary.skipped
      ? `${summary.skipped.toLocaleString("en-GB")} already here, skipped`
      : "",
    summary.repeated
      ? `${summary.repeated.toLocaleString("en-GB")} picked twice, uploaded once`
      : "",
  ].filter(Boolean);

  if (state.phase === "uploading") {
    return (
      <div
        className="proofing-upload-status is-busy"
        role="status"
        aria-live="polite"
      >
        <div className="proofing-upload-status-text">
          <strong>
            Uploading {state.completed.toLocaleString("en-GB")} of{" "}
            {plural(state.total, "photo")}
          </strong>
          <span>
            {failures.length
              ? `${failures.length} didn't go through, you can retry at the end · `
              : ""}
            Keep this tab open until it finishes
          </span>
        </div>
        <span className="proofing-upload-status-percent">{percent}%</span>
        <div
          className="proofing-upload-status-bar"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${Math.max(2, percent)}%` }} />
        </div>
      </div>
    );
  }

  const nothingNew =
    summary.uploaded === 0 &&
    summary.replaced === 0 &&
    failures.length === 0;

  return (
    <div
      className={`proofing-upload-status ${failures.length ? "is-warn" : "is-done"}`}
      role="status"
    >
      <div className="proofing-upload-status-text">
        <strong>
          {failures.length
            ? `${plural(failures.length, "photo")} didn't upload`
            : nothingNew
              ? "Nothing new to upload"
              : `${plural(summary.uploaded + summary.replaced, "photo")} uploaded`}
        </strong>
        <span>
          {[
            failures.length && summary.uploaded
              ? `${summary.uploaded.toLocaleString("en-GB")} did`
              : "",
            ...extras,
          ]
            .filter(Boolean)
            .join(" · ") || "All done"}
        </span>
      </div>

      <div className="proofing-upload-status-actions">
        {failures.length ? (
          <>
            <button
              type="button"
              className="proofing-upload-status-link"
              onClick={() => setShowDetails((value) => !value)}
            >
              {showDetails ? "Hide" : "Which ones?"}
            </button>
            <button
              type="button"
              className="proofing-upload-status-retry"
              onClick={retryFailed}
            >
              Retry {failures.length}
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="proofing-upload-status-close"
          aria-label="Close"
          onClick={dismiss}
        >
          ×
        </button>
      </div>

      {failures.length && showDetails ? (
        <ul className="proofing-upload-status-failures">
          {failures.map((failure) => (
            <li key={failure.job.file.name}>
              {failure.job.file.name}: {failure.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
