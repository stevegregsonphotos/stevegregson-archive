"use client";

import { useState } from "react";

type TestResult = {
  ok: boolean;
  message: string;
  model?: string;
};

export default function TestOpenAIConnection() {
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] =
    useState<TestResult | null>(null);

  async function testConnection() {
    setIsTesting(true);
    setResult(null);

    try {
      const response = await fetch(
        "/api/admin/openai-test",
        {
          method: "POST",
        },
      );

      const data =
        (await response.json()) as TestResult;

      setResult(data);
    } catch {
      setResult({
        ok: false,
        message:
          "Backstage could not reach the connection-test route.",
      });
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <div
      className="backstage-panel"
      style={{ padding: "1.75rem" }}
    >
      <p
        style={{
          margin: 0,
          color: "rgba(242, 238, 230, 0.68)",
          lineHeight: 1.7,
        }}
      >
        Send a small server-side request to confirm that
        the API key, model and billing configuration are
        working. Your key is never sent to the browser.
      </p>

      <button
        type="button"
        className="backstage-button backstage-button-primary"
        disabled={isTesting}
        onClick={testConnection}
        style={{ marginTop: "1.5rem" }}
      >
        {isTesting
          ? "Testing connection…"
          : "Test OpenAI connection"}
      </button>

      {result ? (
        <div
          role="status"
          style={{
            marginTop: "1.5rem",
            borderTop:
              "1px solid rgba(242, 238, 230, 0.14)",
            paddingTop: "1.25rem",
          }}
        >
          <p
            style={{
              margin: 0,
              color: result.ok
                ? "#c7a369"
                : "#d5a49a",
              fontFamily:
                '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
              fontSize: "1.25rem",
              lineHeight: 1.4,
            }}
          >
            {result.message}
          </p>

          {result.ok && result.model ? (
            <p
              style={{
                margin: "0.6rem 0 0",
                color:
                  "rgba(242, 238, 230, 0.5)",
                fontSize: "0.75rem",
              }}
            >
              Model: {result.model}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}