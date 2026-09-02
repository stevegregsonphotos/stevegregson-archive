"use client";

import {
  FormEvent,
  useState,
} from "react";

type Watermark = {
  id: string;
  name: string;
  filename: string;
  createdAt: string;
  updatedAt: string;
};

type WatermarkLibraryClientProps = {
  initialWatermarks: Watermark[];
};

export default function WatermarkLibraryClient({
  initialWatermarks,
}: WatermarkLibraryClientProps) {
  const [watermarks, setWatermarks] =
    useState(initialWatermarks);

  const [name, setName] = useState("");
  const [file, setFile] =
    useState<File | null>(null);

  const [isUploading, setIsUploading] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  async function uploadWatermark(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!file || isUploading) {
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();

      formData.set("file", file);

      if (name.trim()) {
        formData.set(
          "name",
          name.trim(),
        );
      }

      const response = await fetch(
        "/api/admin/proofing/watermarks/upload",
        {
          method: "POST",
          body: formData,
        },
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ??
            "Watermark could not be uploaded.",
        );
      }

      setWatermarks((current) => [
        ...current,
        result.watermark,
      ]);

      setName("");
      setFile(null);

      const input =
        document.getElementById(
          "watermark-file",
        ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }

      setMessage("Watermark uploaded.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Watermark could not be uploaded.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="watermark-library">
      <section className="watermark-library-upload">
        <div>
          <p className="proofing-section-label">
            Add watermark
          </p>

          <h2>Upload watermark</h2>

          <p>
            Upload a transparent PNG to make it
            available across your proofing galleries.
          </p>
        </div>

        <form
          onSubmit={uploadWatermark}
          className="watermark-upload-form"
        >
          <div>
            <label htmlFor="watermark-name">
              Name
            </label>

            <input
              id="watermark-name"
              type="text"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="e.g. Steve Gregson White"
            />
          </div>

          <div>
            <label htmlFor="watermark-file">
              PNG file
            </label>

            <input
              id="watermark-file"
              type="file"
              accept="image/png"
              required
              onChange={(event) =>
                setFile(
                  event.target.files?.[0] ??
                    null,
                )
              }
            />
          </div>

          <button
            type="submit"
            disabled={
              !file || isUploading
            }
          >
            {isUploading
              ? "Uploading…"
              : "Upload watermark"}
          </button>

          {message ? (
            <p className="watermark-upload-message">
              {message}
            </p>
          ) : null}
        </form>
      </section>

      <section className="watermark-library-list">
        <div className="watermark-library-heading">
          <div>
            <p className="proofing-section-label">
              Library
            </p>

            <h2>Your watermarks</h2>
          </div>

          <span>
            {watermarks.length} watermark
            {watermarks.length === 1
              ? ""
              : "s"}
          </span>
        </div>

        {watermarks.length === 0 ? (
          <div className="watermark-library-empty">
            <p>
              No watermark files have been uploaded
              yet.
            </p>
          </div>
        ) : (
          <div className="watermark-library-grid">
            {watermarks.map(
              (watermark) => (
                <article
                  key={watermark.id}
                  className="watermark-library-card"
                >
                  <div className="watermark-library-preview">
                    <div className="watermark-library-preview-dark">
                      <img
                        src={`/api/admin/proofing/watermarks/image?id=${encodeURIComponent(
                          watermark.id,
                        )}`}
                        alt=""
                      />
                    </div>

                    <div className="watermark-library-preview-light">
                      <img
                        src={`/api/admin/proofing/watermarks/image?id=${encodeURIComponent(
                          watermark.id,
                        )}`}
                        alt=""
                      />
                    </div>
                  </div>

                  <div className="watermark-library-card-copy">
                    <h3>{watermark.name}</h3>

                    <p>
                      Uploaded{" "}
                      {new Date(
                        watermark.createdAt,
                      ).toLocaleDateString(
                        "en-GB",
                        {
                          dateStyle:
                            "medium",
                        },
                      )}
                    </p>
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}
