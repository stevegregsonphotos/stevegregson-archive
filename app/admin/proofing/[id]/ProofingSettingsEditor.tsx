"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type GalleryStatus =
  | "draft"
  | "live"
  | "expired"
  | "archived";

type DownloadPermission =
  | "none"
  | "web"
  | "selected";

type WatermarkPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

type Watermark = {
  id: string;
  name: string;
};

type ProofingSettingsEditorProps = {
  galleryId: string;
  initialStatus: GalleryStatus;
  initialDownloadPermission: DownloadPermission;
  initialWatermarkEnabled: boolean;
  initialWatermarkId?: string;
  initialWatermarkPosition?: WatermarkPosition;
  initialWatermarkSize?: number;
  initialWatermarkOpacity?: number;
  previewImageUrl: string;
  initialExpiresAt?: string;
  watermarks: Watermark[];
};

const watermarkPositions: {
  value: WatermarkPosition;
  label: string;
}[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top centre" },
  { value: "top-right", label: "Top right" },
  { value: "center-left", label: "Centre left" },
  { value: "center", label: "Centre" },
  { value: "center-right", label: "Centre right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom centre" },
  { value: "bottom-right", label: "Bottom right" },
];

function dateInputValue(value?: string) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

export default function ProofingSettingsEditor({
  galleryId,
  initialStatus,
  initialDownloadPermission,
  initialWatermarkEnabled,
  initialWatermarkId,
  initialWatermarkPosition = "bottom-right",
  initialWatermarkSize = 30,
  initialWatermarkOpacity = 65,
  previewImageUrl,
  initialExpiresAt,
  watermarks,
}: ProofingSettingsEditorProps) {
  const router = useRouter();

  const [status, setStatus] =
    useState<GalleryStatus>(initialStatus);

  const [downloadPermission, setDownloadPermission] =
    useState<DownloadPermission>(
      initialDownloadPermission,
    );

  const [watermarkId, setWatermarkId] = useState(
    initialWatermarkEnabled
      ? initialWatermarkId ?? ""
      : "",
  );

  const watermarkEnabled =
    watermarkId.length > 0;

  const [watermarkPosition, setWatermarkPosition] =
    useState<WatermarkPosition>(
      initialWatermarkPosition,
    );

  const [watermarkSize, setWatermarkSize] = useState(
    initialWatermarkSize,
  );

  const [watermarkOpacity, setWatermarkOpacity] =
    useState(initialWatermarkOpacity);

  const [expiresAt, setExpiresAt] = useState(
    dateInputValue(initialExpiresAt),
  );

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function saveSettings() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/proofing/settings",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            galleryId,
            status,
            downloadPermission,
            watermarkEnabled,
            watermarkId,
            watermarkPosition,
            watermarkSize,
            watermarkOpacity,
            expiresAt,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(
          result.error ??
            "The gallery settings could not be saved.",
        );
        return;
      }

      setMessage("Gallery settings saved.");
      router.refresh();
    } catch {
      setMessage(
        "The gallery settings could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="proofing-settings-editor">
      <div className="proofing-settings-grid">
        <div className="proofing-settings-field">
          <label htmlFor="proofing-status">
            Gallery status
          </label>

          <select
            id="proofing-status"
            value={status}
            onChange={(event) => {
              setStatus(
                event.target.value as GalleryStatus,
              );
              setMessage("");
            }}
          >
            <option value="draft">Draft</option>
            <option value="live">Live</option>
            <option value="expired">Expired</option>
            <option value="archived">Archived</option>
          </select>

          <p>
            Set to Live when the gallery is ready for
            your client.
          </p>
        </div>

        <div className="proofing-settings-field">
          <label htmlFor="proofing-expiry">
            Expiry date
          </label>

          <input
            id="proofing-expiry"
            type="date"
            value={expiresAt}
            onChange={(event) => {
              setExpiresAt(event.target.value);
              setMessage("");
            }}
          />

          <p>
            Optional. Leave blank for no expiry date.
          </p>
        </div>

        <div className="proofing-settings-field">
          <label htmlFor="proofing-downloads">
            Downloads
          </label>

          <select
            id="proofing-downloads"
            value={downloadPermission}
            onChange={(event) => {
              setDownloadPermission(
                event.target
                  .value as DownloadPermission,
              );
              setMessage("");
            }}
          >
            <option value="none">
              No downloads
            </option>

            <option value="web">
              Web-size downloads
            </option>

            <option value="selected">
              Selected photographs only
            </option>
          </select>

          <p>
            Choose what the client is permitted to
            download.
          </p>
        </div>

        <div className="proofing-settings-field">
          <label htmlFor="proofing-watermark">
            Watermark
          </label>

          <select
            id="proofing-watermark"
            value={watermarkId}
            onChange={(event) => {
              setWatermarkId(event.target.value);
              setMessage("");
            }}
          >
            <option value="">
              None — no watermark
            </option>

            {watermarks.map((watermark) => (
              <option
                key={watermark.id}
                value={watermark.id}
              >
                {watermark.name}
              </option>
            ))}
          </select>

          <p>
            Choose the watermark applied to client
            proofing photographs.
          </p>
        </div>
      </div>

      {watermarkEnabled ? (
        <div className="proofing-watermark-settings">
          <div className="proofing-watermark-settings-heading">
            <div>
              <span className="proofing-settings-field-label">
                Watermark settings
              </span>

              <h3>Gallery watermark</h3>
            </div>

            <p>
              Choose the watermark and how it should
              appear on this gallery.
            </p>
          </div>

          {watermarks.length === 0 ? (
            <p className="proofing-watermark-empty">
              No watermarks have been uploaded yet.
            </p>
          ) : (
            <>
              <div className="proofing-watermark-controls">
                <div className="proofing-watermark-preview-field">
                  <span className="proofing-settings-field-label">
                    Preview &amp; placement
                  </span>

                  <div className="proofing-watermark-preview">
                    <img
                      src={previewImageUrl}
                      alt="Watermark preview"
                      className="proofing-watermark-preview-photo"
                    />

                    {watermarkId ? (
                      <img
                        src={`/api/admin/proofing/watermarks/image?id=${encodeURIComponent(
                          watermarkId,
                        )}`}
                        alt=""
                        className={`proofing-watermark-preview-mark proofing-watermark-preview-mark-${watermarkPosition}`}
                        style={{
                          width: `${watermarkSize}%`,
                          opacity:
                            watermarkOpacity / 100,
                        }}
                      />
                    ) : null}

                    <div
                      className="proofing-watermark-preview-grid"
                      aria-label="Watermark placement"
                    >
                      {watermarkPositions.map(
                        (position) => (
                          <button
                            key={position.value}
                            type="button"
                            className={
                              watermarkPosition ===
                              position.value
                                ? "is-active"
                                : ""
                            }
                            aria-label={
                              position.label
                            }
                            title={
                              position.label
                            }
                            onClick={() => {
                              setWatermarkPosition(
                                position.value,
                              );
                              setMessage("");
                            }}
                          >
                            <span />
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  <p className="proofing-watermark-preview-help">
                    Click an area of the photograph to position
                    the watermark.
                  </p>
                </div>

                <div className="proofing-settings-field proofing-watermark-range">
                  <label htmlFor="proofing-watermark-size">
                    Size
                    <span>{watermarkSize}%</span>
                  </label>

                  <input
                    id="proofing-watermark-size"
                    type="range"
                    min="5"
                    max="100"
                    step="1"
                    value={watermarkSize}
                    onChange={(event) => {
                      setWatermarkSize(
                        Number(event.target.value),
                      );
                      setMessage("");
                    }}
                  />
                </div>

                <div className="proofing-settings-field proofing-watermark-range">
                  <label htmlFor="proofing-watermark-opacity">
                    Opacity
                    <span>
                      {watermarkOpacity}%
                    </span>
                  </label>

                  <input
                    id="proofing-watermark-opacity"
                    type="range"
                    min="5"
                    max="100"
                    step="1"
                    value={watermarkOpacity}
                    onChange={(event) => {
                      setWatermarkOpacity(
                        Number(event.target.value),
                      );
                      setMessage("");
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

      <div className="proofing-settings-footer">
        <p>
          Client access is currently by email address.
        </p>

        <div className="proofing-settings-save">
          {message ? <span>{message}</span> : null}

          <button
            type="button"
            onClick={saveSettings}
            disabled={isSaving}
          >
            {isSaving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
