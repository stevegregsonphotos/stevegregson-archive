"use client";

import {
  DragEvent,
  FormEvent,
  useEffect,
  useState,
} from "react";

import styles from "./watermarks.module.css";

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

  const [messageOk, setMessageOk] = useState(false);

  const [editingId, setEditingId] =
    useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busyId, setBusyId] =
    useState<string | null>(null);
  const [cardMessage, setCardMessage] = useState<{
    id: string;
    text: string;
  } | null>(null);

  async function manageWatermark(
    body: Record<string, string>,
  ) {
    const response = await fetch(
      "/api/admin/proofing/watermarks/manage",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    const result = (await response.json()) as {
      ok?: boolean;
      message?: string;
      watermark?: Watermark;
    };

    if (!response.ok || !result.ok) {
      throw new Error(
        result.message ?? "The watermark could not be changed.",
      );
    }

    return result;
  }

  async function saveRename(watermark: Watermark) {
    const nextName = editName.trim();

    if (!nextName || nextName === watermark.name) {
      setEditingId(null);
      return;
    }

    setBusyId(watermark.id);
    setCardMessage(null);

    try {
      const result = await manageWatermark({
        action: "rename",
        id: watermark.id,
        name: nextName,
      });

      setWatermarks((current) =>
        current.map((item) =>
          item.id === watermark.id && result.watermark
            ? result.watermark
            : item,
        ),
      );
      setEditingId(null);
    } catch (error) {
      setCardMessage({
        id: watermark.id,
        text:
          error instanceof Error
            ? error.message
            : "The watermark could not be renamed.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function removeWatermark(watermark: Watermark) {
    const confirmed = window.confirm(
      `Delete the watermark "${watermark.name}"?\n\nThis can't be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setBusyId(watermark.id);
    setCardMessage(null);

    try {
      await manageWatermark({
        action: "delete",
        id: watermark.id,
      });

      setWatermarks((current) =>
        current.filter((item) => item.id !== watermark.id),
      );
    } catch (error) {
      setCardMessage({
        id: watermark.id,
        text:
          error instanceof Error
            ? error.message
            : "The watermark could not be deleted.",
      });
    } finally {
      setBusyId(null);
    }
  }
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] =
    useState<string | null>(null);

  // Free the preview's memory when the page closes.
  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl],
  );

  function chooseFile(next: File | null) {
    setFile(next);
    setMessage(null);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function uploadWatermark(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!file || isUploading) {
      return;
    }

    setIsUploading(true);
    setMessage(null);
    setMessageOk(false);

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
      setPreviewUrl(null);

      const input =
        document.getElementById(
          "watermark-file",
        ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }

      setMessageOk(true);
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
    <>
      <section className={styles.upload} aria-label="Add a watermark">
        <div className={styles.uploadCopy}>
          <p className={styles.label}>Add a watermark</p>

          <h2>Upload a new watermark</h2>

          <p>
            It becomes available to every proofing gallery straight
            away.
          </p>

          <ul className={styles.tips}>
            <li>PNG file with a transparent background</li>
            <li>Up to 10 MB</li>
            <li>White artwork works best on most theatre photos</li>
          </ul>
        </div>

        <form onSubmit={uploadWatermark} className={styles.form}>
          <div>
            <label
              htmlFor="watermark-name"
              className={`${styles.label} ${styles.fieldLabel}`}
            >
              Name
            </label>

            <input
              id="watermark-name"
              type="text"
              className={styles.textInput}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Steve Gregson White"
            />
          </div>

          <div>
            <span className={`${styles.label} ${styles.fieldLabel}`}>
              PNG file
            </span>

            <label
              className={
                isDragging
                  ? `${styles.drop} ${styles.dropActive}`
                  : styles.drop
              }
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                id="watermark-file"
                type="file"
                accept="image/png"
                onChange={(event) =>
                  chooseFile(event.target.files?.[0] ?? null)
                }
              />

              {previewUrl ? (
                <>
                  <div className={styles.chosen}>
                    <div className={styles.swatchDark}>
                      <img src={previewUrl} alt="Chosen watermark on dark" />
                    </div>

                    <div className={styles.swatchLight}>
                      <img src={previewUrl} alt="Chosen watermark on light" />
                    </div>
                  </div>

                  <small>
                    Drop another PNG or <u>choose a different file</u>
                  </small>
                </>
              ) : (
                <>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5" />
                    <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
                  </svg>

                  <strong>
                    Drop your PNG here or <u>choose a file</u>
                  </strong>

                  <small>You&apos;ll see a preview before uploading</small>
                </>
              )}
            </label>
          </div>

          <div className={styles.formFoot}>
            <span className={styles.fileName}>
              {file ? <b>{file.name}</b> : "No file chosen yet"}
            </span>

            <button
              type="submit"
              className={styles.submit}
              disabled={!file || isUploading}
            >
              {isUploading ? "Uploading…" : "Upload watermark"}
            </button>
          </div>

          {message ? (
            <p
              className={
                messageOk
                  ? `${styles.message} ${styles.messageOk}`
                  : styles.message
              }
              role="status"
            >
              {message}
            </p>
          ) : null}
        </form>
      </section>

      <section aria-label="Your watermarks">
        <div className={styles.libHead}>
          <div>
            <p className={styles.label}>Library</p>
            <h2>Your watermarks</h2>
          </div>

          <span className={styles.label}>
            {watermarks.length} watermark
            {watermarks.length === 1 ? "" : "s"}
          </span>
        </div>

        {watermarks.length === 0 ? (
          <div className={styles.empty}>
            <p>No watermark files have been uploaded yet.</p>
          </div>
        ) : (
          <div className={styles.lib}>
            {watermarks.map((watermark) => {
              const src = `/api/admin/proofing/watermarks/image?id=${encodeURIComponent(
                watermark.id,
              )}`;

              return (
                <article key={watermark.id} className={styles.card}>
                  <div className={styles.swatches}>
                    <div className={`${styles.swatch} ${styles.swatchPhoto}`}>
                      <img className={styles.photo} src="/backstage/watermark-sample.webp" alt="" />
                      <img className={styles.mark} src={src} alt="" />
                      <em>On a photo</em>
                    </div>

                    <div className={`${styles.swatch} ${styles.swatchDark}`}>
                      <img className={styles.mark} src={src} alt="" />
                      <em>Dark</em>
                    </div>

                    <div className={`${styles.swatch} ${styles.swatchLight}`}>
                      <img className={styles.mark} src={src} alt="" />
                      <em>Light</em>
                    </div>
                  </div>

                  <div className={styles.cardCopy}>
                    {editingId === watermark.id ? (
                      <form
                        className={styles.renameForm}
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveRename(watermark);
                        }}
                      >
                        <input
                          className={styles.textInput}
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          aria-label="Watermark name"
                          maxLength={100}
                          autoFocus
                        />

                        <button
                          type="submit"
                          className={styles.smallGold}
                          disabled={busyId === watermark.id}
                        >
                          {busyId === watermark.id ? "Saving…" : "Save"}
                        </button>

                        <button
                          type="button"
                          className={styles.textButton}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <div className={styles.cardRow}>
                        <div>
                          <h3>{watermark.name}</h3>

                          <p>
                            Uploaded{" "}
                            {new Date(watermark.createdAt).toLocaleDateString(
                              "en-GB",
                              { dateStyle: "medium" },
                            )}
                          </p>
                        </div>

                        <div className={styles.cardActions}>
                          <button
                            type="button"
                            className={styles.textButton}
                            disabled={busyId === watermark.id}
                            onClick={() => {
                              setEditingId(watermark.id);
                              setEditName(watermark.name);
                              setCardMessage(null);
                            }}
                          >
                            Rename
                          </button>

                          <button
                            type="button"
                            className={`${styles.textButton} ${styles.dangerButton}`}
                            disabled={busyId === watermark.id}
                            onClick={() => void removeWatermark(watermark)}
                          >
                            {busyId === watermark.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </div>
                    )}

                    {cardMessage?.id === watermark.id ? (
                      <p className={styles.cardMessage} role="alert">
                        {cardMessage.text}
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
