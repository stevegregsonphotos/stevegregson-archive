import type { Metadata } from "next";

import PublishingSettingsForm from "../../../components/admin/PublishingSettingsForm";
import TestOpenAIConnection from "../../../components/admin/TestOpenAIConnection";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings | Backstage",
  robots: {
    index: false,
    follow: false,
  },
};

function StatusBadge({
  enabled,
  enabledText,
  disabledText,
}: {
  enabled: boolean;
  enabledText: string;
  disabledText: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.55rem",
        color: enabled ? "#c7a369" : "#d5a49a",
        fontSize: "0.55rem",
        fontWeight: 700,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "0.5rem",
          height: "0.5rem",
          borderRadius: "999px",
          background: enabled ? "#c7a369" : "#d5a49a",
        }}
      />
      {enabled ? enabledText : disabledText}
    </span>
  );
}

export default function SettingsPage() {
  const hasOpenAiKey = Boolean(
    process.env.OPENAI_API_KEY?.trim(),
  );

  const visionEnabled =
    process.env.BACKSTAGE_VISION_ENABLED === "true";

  const visionModel =
    process.env.OPENAI_VISION_MODEL?.trim() ||
    "Not configured";

  const ready =
    hasOpenAiKey &&
    visionEnabled &&
    visionModel !== "Not configured";

  const settings = [
    {
      label: "OpenAI",
      value: hasOpenAiKey
        ? "API key securely configured"
        : "API key not configured",
      enabled: hasOpenAiKey,
    },
    {
      label: "Vision AI",
      value: visionEnabled ? "Enabled" : "Disabled",
      enabled: visionEnabled,
    },
    {
      label: "Vision model",
      value: visionModel,
      enabled: visionModel !== "Not configured",
    },
    {
      label: "Publishing",
      value: "Local project publishing",
      enabled: true,
    },
    {
      label: "Storage",
      value: "Local filesystem",
      enabled: true,
    },
    {
      label: "Production images",
      value: "public/images/productions",
      enabled: true,
    },
    {
      label: "Production data",
      value: "content/productions",
      enabled: true,
    },
  ];

  return (
    <main className="backstage-page">
      <div className="backstage-shell">
        <header>
          <p className="backstage-eyebrow">
            Backstage configuration
          </p>

          <h1 className="backstage-title">Settings</h1>

          <p className="backstage-lead">
            Review the private configuration used by
            Vision AI and local production publishing.
            Secret values are never shown in the browser.
          </p>
        </header>

        <section className="backstage-section">
          <div className="backstage-section-heading">
            <h2>System status</h2>

            <StatusBadge
              enabled={ready}
              enabledText="Vision AI ready"
              disabledText="Setup incomplete"
            />
          </div>

          <div
            style={{
              borderTop:
                "1px solid rgba(242, 238, 230, 0.18)",
            }}
          >
            {settings.map((setting) => (
              <article
                key={setting.label}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(10rem, 0.6fr) minmax(0, 1fr) auto",
                  gap: "2rem",
                  alignItems: "center",
                  minHeight: "7rem",
                  borderBottom:
                    "1px solid rgba(242, 238, 230, 0.14)",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    color: "#c7a369",
                    fontSize: "0.53rem",
                    fontWeight: 700,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                  }}
                >
                  {setting.label}
                </h2>

                <p
                  style={{
                    margin: 0,
                    fontFamily:
                      '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
                    fontSize: "1.35rem",
                    lineHeight: 1.3,
                  }}
                >
                  {setting.value}
                </p>

                <StatusBadge
                  enabled={setting.enabled}
                  enabledText="Ready"
                  disabledText="Required"
                />
              </article>
            ))}
          </div>
        </section>

        <section className="backstage-section">
          <div className="backstage-section-heading">
            <h2>Publishing</h2>
            <p>Website image profile</p>
          </div>

          <PublishingSettingsForm />
        </section>

        <section className="backstage-section">
          <div className="backstage-section-heading">
            <h2>Connection test</h2>
            <p>Server-side only</p>
          </div>

          <TestOpenAIConnection />
        </section>

        <section className="backstage-section">
          <div className="backstage-section-heading">
            <h2>Private configuration</h2>
            <p>Project root</p>
          </div>

          <div
            className="backstage-panel"
            style={{ padding: "1.75rem" }}
          >
            <p
              style={{
                margin: 0,
                color: "rgba(242, 238, 230, 0.68)",
                lineHeight: 1.75,
              }}
            >
              Open{" "}
              <code>
                /Users/stevegregson/Documents/stevegregson-archive/.env.local
              </code>{" "}
              to change the private AI settings.
            </p>

            <pre
              style={{
                overflowX: "auto",
                margin: "1.5rem 0 0",
                border:
                  "1px solid rgba(242, 238, 230, 0.14)",
                padding: "1.25rem",
                background: "#080808",
                color: "#f2eee6",
                fontSize: "0.78rem",
                lineHeight: 1.7,
              }}
            >
{`OPENAI_API_KEY=your_actual_api_key_here
OPENAI_VISION_MODEL=gpt-5
BACKSTAGE_VISION_ENABLED=true`}
            </pre>

            <p
              style={{
                margin: "1.25rem 0 0",
                color: "rgba(242, 238, 230, 0.5)",
                fontSize: "0.78rem",
                lineHeight: 1.65,
              }}
            >
              Backstage reads these values only on the
              server. Restart the development server after
              changing them.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}