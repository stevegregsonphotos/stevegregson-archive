"use client";

import {
  ChangeEvent,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type ProofingUploadProps = {
  galleryId: string;
};

type UploadFailure = {
  filename: string;
  message: string;
};

const MAX_PROOF_DIMENSION = 2400;
const MAX_UPLOAD_BYTES = 3.75 * 1024 * 1024;

type PreparedProofUpload = {
  file: File;
  width: number;
  height: number;
};

async function prepareProofUpload(
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

export default function ProofingUpload({
  galleryId,
}: ProofingUploadProps) {
  const router = useRouter();
  const inputRef =
    useRef<HTMLInputElement | null>(null);

  const [files, setFiles] =
    useState<File[]>([]);

  const [isUploading, setIsUploading] =
    useState(false);

  const [completed, setCompleted] =
    useState(0);

  const [failures, setFailures] =
    useState<UploadFailure[]>([]);

  function handleFiles(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFiles = Array.from(
      event.target.files ?? [],
    ).filter((file) =>
      file.type.startsWith("image/"),
    );

    setFiles(selectedFiles);
    setCompleted(0);
    setFailures([]);
  }

  async function uploadOne(
    file: File,
  ) {
    const prepared =
      await prepareProofUpload(
        file,
      );

    const signingResponse =
      await fetch(
        "/api/admin/proofing/upload",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "presign",
            galleryId,
            originalFilename:
              file.name,
          }),
        },
      );

    const signingResult =
      (await signingResponse.json()) as {
        ok?: boolean;
        message?: string;
        imageId?: string;
        webFilename?: string;
        uploadUrl?: string;
      };

    if (
      !signingResponse.ok ||
      !signingResult.ok ||
      !signingResult.imageId ||
      !signingResult.webFilename ||
      !signingResult.uploadUrl
    ) {
      throw new Error(
        signingResult.message ||
          "Could not prepare direct R2 upload.",
      );
    }

    const r2Response =
      await fetch(
        signingResult.uploadUrl,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "image/webp",
          },
          body: prepared.file,
        },
      );

    if (!r2Response.ok) {
      throw new Error(
        `Direct R2 upload failed (HTTP ${r2Response.status}).`,
      );
    }

    const commitResponse =
      await fetch(
        "/api/admin/proofing/upload",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "commit",
            galleryId,
            imageId:
              signingResult.imageId,
            originalFilename:
              file.name,
            webFilename:
              signingResult.webFilename,
            width:
              prepared.width,
            height:
              prepared.height,
            createdAt:
              new Date(
                file.lastModified ||
                  Date.now(),
              ).toISOString(),
          }),
        },
      );

    const commitResult =
      (await commitResponse.json()) as {
        ok?: boolean;
        message?: string;
      };

    if (
      !commitResponse.ok ||
      !commitResult.ok
    ) {
      throw new Error(
        commitResult.message ||
          "Proofing image metadata could not be saved.",
      );
    }
  }

  async function uploadFiles() {
    if (
      files.length === 0 ||
      isUploading
    ) {
      return;
    }

    setIsUploading(true);
    setCompleted(0);
    setFailures([]);

    const uploadFailures:
      UploadFailure[] = [];

    /*
     * Four parallel workers gives substantially
     * better throughput without loading hundreds
     * of full-resolution photographs into browser
     * memory at once.
     */
    const concurrency = 4;

    for (
      let index = 0;
      index < files.length;
      index += concurrency
    ) {
      const batch =
        files.slice(
          index,
          index + concurrency,
        );

      await Promise.all(
        batch.map(
          async (file) => {
            try {
              await uploadOne(
                file,
              );
            } catch (error) {
              uploadFailures.push({
                filename:
                  file.name,
                message:
                  error instanceof Error
                    ? error.message
                    : "Upload request failed.",
              });
            } finally {
              setCompleted(
                (current) =>
                  current + 1,
              );
            }
          },
        ),
      );
    }

    setFailures(
      uploadFailures,
    );

    setIsUploading(false);

    if (
      uploadFailures.length === 0
    ) {
      setFiles([]);

      if (inputRef.current) {
        inputRef.current.value =
          "";
      }
    }

    router.refresh();
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
          onClick={() =>
            inputRef.current?.click()
          }
        >
          Upload Media
        </button>

        {files.length > 0 ? (
          <>
            <p className="proofing-upload-selection">
              {files.length} photograph
              {files.length === 1
                ? ""
                : "s"}{" "}
              selected
            </p>

            <button
              type="button"
              className="proofing-upload-submit"
              onClick={uploadFiles}
              disabled={isUploading}
            >
              {isUploading
                ? `Uploading ${completed} of ${files.length}…`
                : `Upload ${files.length}`}
            </button>
          </>
        ) : (
          <p className="proofing-upload-hint">
            JPEG, PNG or WebP
          </p>
        )}
      </div>

      {isUploading ? (
        <div className="proofing-upload-progress">
          <progress
            value={completed}
            max={files.length}
          />

          <span>
            {completed} of {files.length}
          </span>
        </div>
      ) : null}

      {failures.length > 0 ? (
        <div className="proofing-upload-failures">
          <p>
            {failures.length} upload
            {failures.length === 1
              ? ""
              : "s"}{" "}
            failed
          </p>

          <ul>
            {failures.map((failure) => (
              <li key={failure.filename}>
                {failure.filename}:{" "}
                {failure.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}