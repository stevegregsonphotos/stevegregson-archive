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

const MAX_WATERMARK_BYTES = 10 * 1024 * 1024;

async function validateWatermarkFile(
  file: File,
) {
  if (
    file.type !== "image/png" ||
    !/\.png$/i.test(file.name)
  ) {
    throw new Error(
      "Watermarks must be uploaded as PNG files.",
    );
  }

  if (
    file.size === 0 ||
    file.size > MAX_WATERMARK_BYTES
  ) {
    throw new Error(
      file.size > MAX_WATERMARK_BYTES
        ? "Watermark files must be smaller than 10 MB."
        : "The watermark file is empty.",
    );
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(
          new Error(
            "The selected file is not a valid PNG image.",
          ),
        );
      image.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (!context) {
      throw new Error(
        "The watermark could not be validated.",
      );
    }

    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    ).data;

    let hasTransparency = false;

    for (
      let index = 3;
      index < pixels.length;
      index += 4
    ) {
      if (pixels[index] < 255) {
        hasTransparency = true;
        break;
      }
    }

    if (!hasTransparency) {
      throw new Error(
        "The PNG must contain transparency.",
      );
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

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
      await validateWatermarkFile(file);

      const signingResponse = await fetch(
        "/api/admin/proofing/watermarks/upload",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "presign",
            originalFilename: file.name,
          }),
        },
      );

      const signed =
        (await signingResponse.json()) as {
          ok?: boolean;
          message?: string;
          id?: string;
          filename?: string;
          uploadUrl?: string;
        };

      if (
        !signingResponse.ok ||
        !signed.ok ||
        !signed.id ||
        !signed.filename ||
        !signed.uploadUrl
      ) {
        throw new Error(
          signed.message ??
            "Watermark upload could not be prepared.",
        );
      }

      const r2Response = await fetch(
        signed.uploadUrl,
        {
          method: "PUT",
          headers: {
            "Content-Type": "image/png",
          },
          body: file,
        },
      );

      if (!r2Response.ok) {
        throw new Error(
          `Direct R2 upload failed (HTTP ${r2Response.status}).`,
        );
      }

      const commitResponse = await fetch(
        "/api/admin/proofing/watermarks/upload",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "commit",
            id: signed.id,
            filename: signed.filename,
            originalFilename: file.name,
            name: name.trim(),
          }),
        },
      );

      const result =
        await commitResponse.json();

      if (
        !commitResponse.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ??
            "Watermark could not be saved.",
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
