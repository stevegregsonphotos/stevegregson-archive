"use client";

import { FormEvent, useState } from "react";

type UploadResult = {
  ok: boolean;
  message: string;
  archive?: {
    name: string;
    size: number;
    type: string;
    suggestedSlug: string;
  };
  contents?: {
    imageCount: number;
    images: string[];
    detailsFiles: string[];
    otherFiles: string[];
  };
};

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function filenameOnly(filepath: string) {
  return filepath.split("/").at(-1) ?? filepath;
}

export default function ProductionUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsUploading(true);
    setResult(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(
        "/api/admin/production-preview",
        {
          method: "POST",
          body: formData,
        },
      );

      const data = (await response.json()) as UploadResult;
      setResult(data);
    } catch {
      setResult({
        ok: false,
        message: "The upload request failed.",
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section
      style={{
        borderTop: "1px solid rgba(242, 238, 230, 0.22)",
        paddingTop: "2rem",
      }}
    >
      <form onSubmit={handleSubmit}>
        <label
          htmlFor="productionArchive"
          style={{
            display: "block",
            marginBottom: "1rem",
            color: "#c7a369",
            fontSize: "0.55rem",
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          Production ZIP
        </label>

        <input
          id="productionArchive"
          name="productionArchive"
          type="file"
          accept=".zip,application/zip"
          required
          style={{
            display: "block",
            width: "100%",
            border: "1px solid rgba(242, 238, 230, 0.25)",
            padding: "1.25rem",
            background: "rgba(255, 255, 255, 0.03)",
            color: "inherit",
          }}
        />

        <button
          type="submit"
          disabled={isUploading}
          style={{
            marginTop: "1.5rem",
            border: "1px solid rgba(242, 238, 230, 0.5)",
            padding: "1rem 1.4rem",
            background: "transparent",
            color: "inherit",
            cursor: isUploading ? "wait" : "pointer",
            fontSize: "0.58rem",
            fontWeight: 700,
            letterSpacing: "0.17em",
            textTransform: "uppercase",
            opacity: isUploading ? 0.55 : 1,
          }}
        >
          {isUploading ? "Inspecting archive…" : "Create preview"}
        </button>
      </form>

      {result ? (
        <div
          role="status"
          style={{
            marginTop: "3rem",
            borderTop: "1px solid rgba(242, 238, 230, 0.18)",
            paddingTop: "2rem",
          }}
        >
          <p
            style={{
              margin: 0,
              color: result.ok ? "#c7a369" : "#ffb3a7",
            }}
          >
            {result.message}
          </p>

          {result.archive && result.contents ? (
            <>
              <dl
                style={{
                  display: "grid",
                  gridTemplateColumns: "11rem 1fr",
                  gap: "0.8rem 1.5rem",
                  marginTop: "2rem",
                }}
              >
                <dt>Filename</dt>
                <dd style={{ margin: 0 }}>
                  {result.archive.name}
                </dd>

                <dt>Size</dt>
                <dd style={{ margin: 0 }}>
                  {formatBytes(result.archive.size)}
                </dd>

                <dt>Suggested slug</dt>
                <dd style={{ margin: 0 }}>
                  {result.archive.suggestedSlug}
                </dd>

                <dt>Photographs found</dt>
                <dd style={{ margin: 0 }}>
                  {result.contents.imageCount}
                </dd>

                <dt>Details files found</dt>
                <dd style={{ margin: 0 }}>
                  {result.contents.detailsFiles.length}
                </dd>

                <dt>Archive status</dt>
                <dd style={{ margin: 0 }}>
                  Preview only — nothing has been published
                </dd>
              </dl>

              <section
                style={{
                  marginTop: "3rem",
                  borderTop:
                    "1px solid rgba(242, 238, 230, 0.18)",
                  paddingTop: "2rem",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontFamily:
                      '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
                    fontSize: "clamp(2rem, 4vw, 4rem)",
                    fontWeight: 400,
                  }}
                >
                  Details files
                </h2>

                {result.contents.detailsFiles.length > 0 ? (
                  <ul>
                    {result.contents.detailsFiles.map((filepath) => (
                      <li key={filepath}>
                        {filenameOnly(filepath)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No text, RTF, Word or PDF details file was found.</p>
                )}
              </section>

              <section
                style={{
                  marginTop: "3rem",
                  borderTop:
                    "1px solid rgba(242, 238, 230, 0.18)",
                  paddingTop: "2rem",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontFamily:
                      '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
                    fontSize: "clamp(2rem, 4vw, 4rem)",
                    fontWeight: 400,
                  }}
                >
                  Photographs
                </h2>

                <ol
                  style={{
                    columns: "18rem",
                    gap: "3rem",
                    marginTop: "2rem",
                    paddingLeft: "1.25rem",
                    color: "rgba(242, 238, 230, 0.68)",
                    lineHeight: 1.8,
                  }}
                >
                  {result.contents.images.map((filepath) => (
                    <li key={filepath}>
                      {filenameOnly(filepath)}
                    </li>
                  ))}
                </ol>
              </section>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}