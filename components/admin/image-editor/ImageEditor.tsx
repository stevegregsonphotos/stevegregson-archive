"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  clamp,
  drawEditedImage,
  renderEditedImage,
  type EditedImageResult,
  type ImageEditorAspect,
  type ImageEditorSettings,
} from "@/lib/client-image-editor";

type ImageEditorProps = {
  source: string | File | Blob;
  filename?: string;
  onCancel: () => void;
  onApply: (
    result: EditedImageResult & {
      filename: string;
    },
  ) => void | Promise<void>;
};

const DEFAULT_SETTINGS: ImageEditorSettings = {
  aspect: "original",
  zoom: 1,
  panX: 0,
  panY: 0,
  brightness: 100,
};

const ASPECT_OPTIONS: Array<{
  value: ImageEditorAspect;
  label: string;
}> = [
  {
    value: "original",
    label: "Original",
  },
  {
    value: "3:2",
    label: "3:2",
  },
  {
    value: "4:5",
    label: "4:5",
  },
  {
    value: "1:1",
    label: "Square",
  },
  {
    value: "16:9",
    label: "16:9",
  },
];

function outputFilename(
  filename?: string,
) {
  const source =
    filename?.trim() ||
    "edited-image";

  const stem =
    source.replace(
      /\.[^.]+$/,
      "",
    );

  return `${stem}-edited.webp`;
}

export default function ImageEditor({
  source,
  filename,
  onCancel,
  onApply,
}: ImageEditorProps) {
  const canvasRef =
    useRef<HTMLCanvasElement | null>(
      null,
    );

  const imageRef =
    useRef<HTMLImageElement | null>(
      null,
    );

  const dragRef =
    useRef<{
      pointerId: number;
      x: number;
      y: number;
      startPanX: number;
      startPanY: number;
    } | null>(null);

  const [settings, setSettings] =
    useState<ImageEditorSettings>(
      DEFAULT_SETTINGS,
    );

  const [isReady, setIsReady] =
    useState(false);

  const [isApplying, setIsApplying] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const image = new Image();

    image.decoding = "async";

    image.onload = () => {
      if (cancelled) {
        return;
      }

      imageRef.current = image;
      setIsReady(true);
    };

    image.onerror = () => {
      if (cancelled) {
        return;
      }

      setError(
        "The photograph could not be opened in the editor.",
      );
    };

    if (
      typeof source === "string"
    ) {
      image.src = source;
    } else {
      objectUrl =
        URL.createObjectURL(source);
      image.src = objectUrl;
    }

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(
          objectUrl,
        );
      }
    };
  }, [source]);

  useEffect(() => {
    const image =
      imageRef.current;

    const canvas =
      canvasRef.current;

    if (
      !image ||
      !canvas ||
      !isReady
    ) {
      return;
    }

    const availableWidth = Math.min(
      1000,
      Math.max(
        320,
        canvas.parentElement
          ?.clientWidth ?? 800,
      ),
    );

    const aspect =
      settings.aspect === "original"
        ? image.naturalWidth /
          image.naturalHeight
        : settings.aspect === "3:2"
          ? 3 / 2
          : settings.aspect === "4:5"
            ? 4 / 5
            : settings.aspect === "1:1"
              ? 1
              : 16 / 9;

    canvas.width =
      Math.round(
        availableWidth,
      );

    canvas.height =
      Math.max(
        220,
        Math.round(
          availableWidth / aspect,
        ),
      );

    const context =
      canvas.getContext("2d");

    if (!context) {
      return;
    }

    drawEditedImage(
      context,
      image,
      image.naturalWidth,
      image.naturalHeight,
      canvas.width,
      canvas.height,
      settings,
    );
  }, [
    settings,
    isReady,
  ]);

  function updateSetting<
    K extends keyof ImageEditorSettings,
  >(
    key: K,
    value: ImageEditorSettings[K],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));

    setError(null);
  }

  function handlePointerDown(
    event: React.PointerEvent<HTMLCanvasElement>,
  ) {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    canvas.setPointerCapture(
      event.pointerId,
    );

    dragRef.current = {
      pointerId:
        event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startPanX:
        settings.panX,
      startPanY:
        settings.panY,
    };
  }

  function handlePointerMove(
    event: React.PointerEvent<HTMLCanvasElement>,
  ) {
    const drag =
      dragRef.current;

    const canvas =
      canvasRef.current;

    if (
      !drag ||
      !canvas ||
      drag.pointerId !==
        event.pointerId
    ) {
      return;
    }

    const deltaX =
      event.clientX -
      drag.x;

    const deltaY =
      event.clientY -
      drag.y;

    const panScale =
      Math.max(
        0.3,
        settings.zoom - 0.65,
      );

    setSettings((current) => ({
      ...current,
      panX: clamp(
        drag.startPanX -
          (deltaX /
            canvas.clientWidth) *
            2 /
            panScale,
        -1,
        1,
      ),
      panY: clamp(
        drag.startPanY -
          (deltaY /
            canvas.clientHeight) *
            2 /
            panScale,
        -1,
        1,
      ),
    }));
  }

  function handlePointerEnd(
    event: React.PointerEvent<HTMLCanvasElement>,
  ) {
    const canvas =
      canvasRef.current;

    if (
      canvas?.hasPointerCapture(
        event.pointerId,
      )
    ) {
      canvas.releasePointerCapture(
        event.pointerId,
      );
    }

    dragRef.current = null;
  }

  async function applyEdit() {
    const image =
      imageRef.current;

    if (
      !image ||
      isApplying
    ) {
      return;
    }

    setIsApplying(true);
    setError(null);

    try {
      const result =
        await renderEditedImage(
          image,
          settings,
        );

      await onApply({
        ...result,
        filename:
          outputFilename(
            filename,
          ),
      });
    } catch (applyError) {
      setError(
        applyError instanceof Error
          ? applyError.message
          : "The image could not be edited.",
      );
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit photograph"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
        background:
          "rgba(8, 8, 8, 0.92)",
        backdropFilter:
          "blur(12px)",
      }}
    >
      <section
        style={{
          width:
            "min(100%, 74rem)",
          maxHeight:
            "calc(100vh - 3rem)",
          overflow: "auto",
          border:
            "1px solid rgba(242, 238, 230, 0.16)",
          background: "#11100f",
          color: "#f2eee6",
          padding:
            "clamp(1rem, 3vw, 2rem)",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "1rem",
            marginBottom:
              "1.5rem",
          }}
        >
          <div>
            <p className="backstage-eyebrow">
              Image editor
            </p>

            <h2
              style={{
                margin:
                  "0.35rem 0 0",
                fontSize:
                  "clamp(1.7rem, 3vw, 2.5rem)",
                fontWeight: 400,
              }}
            >
              Crop and adjust
            </h2>
          </div>

          <button
            type="button"
            className="backstage-button"
            onClick={onCancel}
            disabled={isApplying}
          >
            Close
          </button>
        </header>

        <div
          style={{
            background: "#080808",
            overflow: "hidden",
          }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={
              handlePointerDown
            }
            onPointerMove={
              handlePointerMove
            }
            onPointerUp={
              handlePointerEnd
            }
            onPointerCancel={
              handlePointerEnd
            }
            style={{
              display: "block",
              width: "100%",
              maxHeight:
                "60vh",
              objectFit:
                "contain",
              cursor:
                settings.zoom > 1
                  ? "grab"
                  : "move",
              touchAction: "none",
            }}
          />
        </div>

        <p
          style={{
            margin:
              "0.65rem 0 0",
            color:
              "rgba(242, 238, 230, 0.5)",
            fontSize:
              "0.72rem",
          }}
        >
          Drag the photograph
          to reposition the crop.
        </p>

        <div
          style={{
            display: "grid",
            gap: "1.5rem",
            marginTop:
              "1.75rem",
          }}
        >
          <div>
            <p className="backstage-field-label">
              Crop
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.6rem",
              }}
            >
              {ASPECT_OPTIONS.map(
                (option) => (
                  <button
                    key={
                      option.value
                    }
                    type="button"
                    className={
                      settings.aspect ===
                      option.value
                        ? "backstage-button backstage-button-primary"
                        : "backstage-button"
                    }
                    onClick={() =>
                      updateSetting(
                        "aspect",
                        option.value,
                      )
                    }
                  >
                    {option.label}
                  </button>
                ),
              )}
            </div>
          </div>

          <label className="backstage-field">
            <span className="backstage-field-label">
              Zoom —{" "}
              {settings.zoom.toFixed(
                2,
              )}
              ×
            </span>

            <input
              type="range"
              min="1"
              max="4"
              step="0.01"
              value={
                settings.zoom
              }
              onChange={(event) =>
                updateSetting(
                  "zoom",
                  Number(
                    event.target
                      .value,
                  ),
                )
              }
            />
          </label>

          <label className="backstage-field">
            <span className="backstage-field-label">
              Brightness —{" "}
              {settings.brightness}%
            </span>

            <input
              type="range"
              min="50"
              max="150"
              step="1"
              value={
                settings.brightness
              }
              onChange={(event) =>
                updateSetting(
                  "brightness",
                  Number(
                    event.target
                      .value,
                  ),
                )
              }
            />
          </label>
        </div>

        {error ? (
          <p
            role="alert"
            style={{
              margin:
                "1rem 0 0",
              color: "#ef9a9a",
            }}
          >
            {error}
          </p>
        ) : null}

        <footer
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
            marginTop:
              "2rem",
            paddingTop:
              "1.25rem",
            borderTop:
              "1px solid rgba(242, 238, 230, 0.12)",
          }}
        >
          <button
            type="button"
            className="backstage-button"
            onClick={() =>
              setSettings(
                DEFAULT_SETTINGS,
              )
            }
            disabled={isApplying}
          >
            Reset
          </button>

          <div
            style={{
              display: "flex",
              gap: "0.75rem",
            }}
          >
            <button
              type="button"
              className="backstage-button"
              onClick={onCancel}
              disabled={isApplying}
            >
              Cancel
            </button>

            <button
              type="button"
              className="backstage-button backstage-button-primary"
              onClick={() =>
                void applyEdit()
              }
              disabled={
                !isReady ||
                isApplying
              }
            >
              {isApplying
                ? "Applying..."
                : "Apply edit"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
