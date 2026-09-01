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
      const formData = new FormData();

      formData.set("galleryId", galleryId);
      formData.set("image", file);

      try {
        const response = await fetch(
          "/api/admin/proofing/upload",
          {
            method: "POST",
            body: formData,
          },
        );

        const result =
          (await response.json()) as {
            ok: boolean;
            message?: string;
          };

        if (!response.ok || !result.ok) {
          uploadFailures.push({
            filename: file.name,
            message:
              result.message ??
              "Upload failed.",
          });
        }
      } catch {
        uploadFailures.push({
          filename: file.name,
          message:
            "Upload request failed.",
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
          Add Photos
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