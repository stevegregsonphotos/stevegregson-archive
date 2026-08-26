"use client";

import {
  ChangeEvent,
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

  const [files, setFiles] = useState<File[]>([]);
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

        const result = (await response.json()) as {
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
          message: "Upload request failed.",
        });
      }

      setCompleted(
        (current) => current + 1,
      );
    }

    setFailures(uploadFailures);
    setIsUploading(false);

    router.refresh();
  }

  return (
  <div className="proofing-upload">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={isUploading}
        onChange={handleFiles}
      />

      {files.length > 0 ? (
        <div>
          <p>
            {files.length} photograph
            {files.length === 1 ? "" : "s"} selected
          </p>

          <button
            type="button"
            onClick={uploadFiles}
            disabled={isUploading}
          >
            {isUploading
              ? `Uploading ${completed} of ${files.length}…`
              : `Upload ${files.length} photographs`}
          </button>
        </div>
      ) : null}

      {isUploading ? (
        <progress
          value={completed}
          max={files.length}
        />
      ) : null}

      {failures.length > 0 ? (
        <div>
          <p>
            {failures.length} upload
            {failures.length === 1 ? "" : "s"} failed:
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