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

async function prepareProofUpload(
  file: File,
): Promise<File> {
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
        return new File(
          [blob],
          file.name,
          {
            type: "image/webp",
            lastModified: file.lastModified,
          },
        );
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

  async function uploadFiles() {
    if (files.length === 0 || isUploading) {
      return;
    }

    setIsUploading(true);
    setCompleted(0);
    setFailures([]);

    const uploadFailures: UploadFailure[] = [];

    for (const file of files) {
      try {
        const preparedFile =
          await prepareProofUpload(file);

        const formData = new FormData();

        formData.set("galleryId", galleryId);
        formData.set("image", preparedFile);

        const response = await fetch(
          "/api/admin/proofing/upload",
          {
            method: "POST",
            body: formData,
          },
        );

        const responseText =
          await response.text();

        let result: {
          ok?: boolean;
          message?: string;
        };

        try {
          result = JSON.parse(responseText) as {
            ok?: boolean;
            message?: string;
          };
        } catch {
          throw new Error(
            `Upload returned HTTP ${response.status}: ${responseText
              .replace(/\s+/g, " ")
              .slice(0, 160)}`,
          );
        }

        if (!response.ok || !result.ok) {
          uploadFailures.push({
            filename: file.name,
            message:
              result.message ??
              `Upload failed (HTTP ${response.status}).`,
          });
        }
      } catch (error) {
        uploadFailures.push({
          filename: file.name,
          message:
            error instanceof Error
              ? error.message
              : "Upload request failed.",
        });
      }

      setCompleted(
        (current) => current + 1,
      );
    }

    setFailures(uploadFailures);
    setIsUploading(false);

    if (uploadFailures.length === 0) {
      setFiles([]);

      if (inputRef.current) {
        inputRef.current.value = "";
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