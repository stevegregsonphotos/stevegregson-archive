"use client";

import { useEffect, useState } from "react";

import {
  DEFAULT_PUBLISHING_SETTINGS,
  type PublishingSettings,
} from "../../lib/publishing-settings";

type LoadResult = {
  ok: boolean;
  settings?: PublishingSettings;
  message?: string;
};

export default function PublishingSettingsForm() {
  const [settings, setSettings] =
    useState<PublishingSettings>(
      DEFAULT_PUBLISHING_SETTINGS,
    );
  const [savedSettings, setSavedSettings] =
    useState<PublishingSettings>(
      DEFAULT_PUBLISHING_SETTINGS,
    );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const response = await fetch(
          "/api/admin/publishing-settings",
        );
        const data = (await response.json()) as LoadResult;

        if (!response.ok || !data.ok || !data.settings) {
          throw new Error(
            data.message ??
              "Publishing settings could not be loaded.",
          );
        }

        if (!cancelled) {
          setSettings(data.settings);
          setSavedSettings(data.settings);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Publishing settings could not be loaded.",
          );
          setIsError(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasChanges =
    JSON.stringify(settings) !== JSON.stringify(savedSettings);

  function updateSetting<K extends keyof PublishingSettings>(
    key: K,
    value: PublishingSettings[K],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
    setMessage(null);
    setIsError(false);
  }

  async function saveSettings() {
    if (!hasChanges || isSaving) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch(
        "/api/admin/publishing-settings",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(settings),
        },
      );

      const data = (await response.json()) as LoadResult;

      if (!response.ok || !data.ok || !data.settings) {
        throw new Error(
          data.message ??
            "Publishing settings could not be saved.",
        );
      }

      setSettings(data.settings);
      setSavedSettings(data.settings);
      setMessage(data.message ?? "Publishing settings saved.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Publishing settings could not be saved.",
      );
      setIsError(true);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="backstage-panel" style={{ padding: "1.75rem" }}>
        <p style={{ margin: 0 }}>Loading publishing settings…</p>
      </div>
    );
  }

  return (
    <div className="backstage-panel" style={{ padding: "1.75rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(16rem, 1fr))",
          gap: "1.25rem",
        }}
      >
        <label className="backstage-field">
          <span className="backstage-field-label">
            Maximum image size
          </span>
          <input
            className="backstage-input"
            type="number"
            min={800}
            max={4096}
            step={1}
            value={settings.maxImageSize}
            onChange={(event) =>
              updateSetting(
                "maxImageSize",
                Number.parseInt(event.target.value, 10) || 2048,
              )
            }
          />
          <small style={{ color: "rgba(242, 238, 230, 0.48)" }}>
            Pixels on the longest edge. Smaller uploads will not be enlarged.
          </small>
        </label>

        <label className="backstage-field">
          <span className="backstage-field-label">Output format</span>
          <select
            className="backstage-input"
            value={settings.outputFormat}
            onChange={() => updateSetting("outputFormat", "webp")}
          >
            <option value="webp">WebP</option>
          </select>
        </label>

        <label className="backstage-field">
          <span className="backstage-field-label">WebP quality</span>
          <input
            className="backstage-input"
            type="number"
            min={50}
            max={100}
            step={1}
            value={settings.quality}
            onChange={(event) =>
              updateSetting(
                "quality",
                Number.parseInt(event.target.value, 10) || 85,
              )
            }
          />
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gap: "0.9rem",
          marginTop: "2rem",
          borderTop: "1px solid rgba(242, 238, 230, 0.14)",
          paddingTop: "1.5rem",
        }}
      >
        {(
          [
            [
              "optimiseImages",
              "Optimise images",
              "Generate compact public WebP files while leaving uploaded JPEGs untouched.",
            ],
            [
              "preserveCopyright",
              "Preserve copyright metadata",
              "Retain copyright information when supported by the output pipeline.",
            ],
            [
              "preservePhotographer",
              "Preserve photographer metadata",
              "Retain photographer attribution when supported by the output pipeline.",
            ],
            [
              "generateSitemap",
              "Generate sitemap",
              "Include published production pages in the website sitemap.",
            ],
            [
              "generateStructuredData",
              "Generate structured data",
              "Include production and image metadata for search engines.",
            ],
          ] as const
        ).map(([key, label, description]) => (
          <label
            key={key}
            style={{
              display: "grid",
              gridTemplateColumns: "auto minmax(0, 1fr)",
              gap: "0.9rem",
              alignItems: "start",
            }}
          >
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(event) =>
                updateSetting(key, event.target.checked)
              }
              style={{ marginTop: "0.25rem" }}
            />
            <span>
              <strong
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                }}
              >
                {label}
              </strong>
              <span
                style={{
                  display: "block",
                  marginTop: "0.25rem",
                  color: "rgba(242, 238, 230, 0.52)",
                  fontSize: "0.78rem",
                  lineHeight: 1.55,
                }}
              >
                {description}
              </span>
            </span>
          </label>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
          marginTop: "2rem",
          borderTop: "1px solid rgba(242, 238, 230, 0.14)",
          paddingTop: "1.25rem",
        }}
      >
        <p
          role="status"
          style={{
            margin: 0,
            color: isError
              ? "#ffb3a7"
              : message
                ? "#c7a369"
                : "rgba(242, 238, 230, 0.48)",
          }}
        >
          {message ??
            (hasChanges
              ? "Publishing settings have unsaved changes."
              : "Publishing settings are up to date.")}
        </p>

        <button
          type="button"
          className="backstage-button backstage-button-primary"
          disabled={!hasChanges || isSaving}
          onClick={saveSettings}
        >
          {isSaving ? "Saving…" : "Save publishing settings"}
        </button>
      </div>
    </div>
  );
}
