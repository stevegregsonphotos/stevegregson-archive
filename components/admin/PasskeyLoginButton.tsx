"use client";

import { useEffect, useState } from "react";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";

/** "Sign in with Touch ID / Face ID" on the Backstage login page. */
export default function PasskeyLoginButton({ next, only }: { next?: string; only: boolean }) {
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSupported(browserSupportsWebAuthn()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function signIn() {
    setBusy(true);
    setMessage("");
    try {
      const post = async (body: Record<string, unknown>) => {
        const response = await fetch("/api/admin/passkey/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await response.json().catch(() => ({ ok: false }));
        if (!data.ok) throw new Error(data.message || "Couldn't sign in.");
        return data;
      };
      const { options } = await post({ step: "options" });
      const response = await startAuthentication({ optionsJSON: options });
      const result = await post({ step: "verify", response, next });
      window.location.assign(result.next || "/admin");
    } catch (error) {
      const text = error instanceof Error ? error.message : "";
      setMessage(/NotAllowed|cancel|abort/i.test(text) ? "" : text || "Couldn't sign in.");
      setBusy(false);
    }
  }

  if (!supported) {
    return only ? <p className="backstage-login-error" role="alert">This browser can&rsquo;t use Touch ID / Face ID. Please use Safari or Chrome on your Mac or iPhone.</p> : null;
  }

  return (
    <div className="backstage-passkey">
      <button type="button" className="backstage-passkey-button" disabled={busy} onClick={() => void signIn()}>
        <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M12 11v3M8.5 9.5a3.5 3.5 0 0 1 7 0V14a5 5 0 0 1-1 3M6 14V9.5a6 6 0 0 1 12 0V12M9 13.5v1a6 6 0 0 0 1.2 3.6M12 17.5V20" />
        </svg>
        {busy ? "Waiting for Touch ID / Face ID…" : "Sign in with Touch ID / Face ID"}
      </button>
      {message ? <p className="backstage-login-error" role="alert">{message}</p> : null}
      {!only ? <p className="backstage-passkey-or"><span>or use your password</span></p> : null}
    </div>
  );
}
