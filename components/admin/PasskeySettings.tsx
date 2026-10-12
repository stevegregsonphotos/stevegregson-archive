"use client";

import { useCallback, useEffect, useState } from "react";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import styles from "./passkey-settings.module.css";

type Passkey = { id: string; name: string; createdAt: string; lastUsedAt?: string };
type Overview = { passkeys: Passkey[]; passkeyOnly: boolean; overridden: boolean };

function when(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(new Date(value));
}

async function call(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/passkey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({ ok: false, message: "Unexpected response." }));
  if (!data.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

function deviceName() {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone (Face ID)";
  if (/iPad/.test(ua)) return "iPad";
  if (/Macintosh/.test(ua)) return "MacBook (Touch ID)";
  return "This device";
}

/** Backstage › Settings › Sign-in: Touch ID / Face ID. */
export default function PasskeySettings() {
  const [data, setData] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [supported, setSupported] = useState(true);

  const load = useCallback(async () => {
    try { setData(await call({ action: "list" })); } catch (error) { setMessage(error instanceof Error ? error.message : "Couldn't load."); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { setSupported(browserSupportsWebAuthn()); void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function add() {
    setBusy(true);
    setMessage("");
    try {
      const { options } = await call({ action: "register-options" });
      const response = await startRegistration({ optionsJSON: options });
      setData(await call({ action: "register-verify", response, name: deviceName() }));
      setMessage("Done. You can now sign in with Touch ID / Face ID. It's shared with your other Apple devices through iCloud Keychain.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "";
      setMessage(/NotAllowed|cancel|abort/i.test(text) ? "Cancelled." : text || "Couldn't set it up.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(passkey: Passkey) {
    if (!window.confirm("Remove “" + passkey.name + "”? You'll no longer be able to sign in with it.")) return;
    setBusy(true);
    try { setData(await call({ action: "delete", id: passkey.id })); } catch (error) { setMessage(error instanceof Error ? error.message : "Couldn't remove."); } finally { setBusy(false); }
  }

  async function toggleOnly(on: boolean) {
    if (on && !window.confirm("Turn off password sign-in? From now on Backstage will only open with Touch ID / Face ID. (If you ever lose access, I can switch passwords back on for you.)")) return;
    setBusy(true);
    try { setData(await call({ action: "set-only", on })); } catch (error) { setMessage(error instanceof Error ? error.message : "Couldn't change that."); } finally { setBusy(false); }
  }

  return (
    <div className={styles.box}>
      <div className={styles.head}>
        <div>
          <h2>Touch ID &amp; Face ID</h2>
          <p>Sign in to Backstage with your fingerprint on the MacBook or your face on the iPhone, instead of typing a password.</p>
        </div>
        <button type="button" className={styles.primary} disabled={busy || !supported} onClick={() => void add()}>
          {data?.passkeys.length ? "Add another device" : "Set up Touch ID / Face ID"}
        </button>
      </div>

      {!supported ? <p className={styles.note}>This browser can&rsquo;t use Touch ID / Face ID. Try Safari or Chrome on your Mac or iPhone.</p> : null}

      {data?.passkeys.length ? (
        <ul className={styles.list}>
          {data.passkeys.map((passkey) => (
            <li key={passkey.id}>
              <span><strong>{passkey.name}</strong><small>Added {when(passkey.createdAt)}{passkey.lastUsedAt ? " · last used " + when(passkey.lastUsedAt) : ""}</small></span>
              <button type="button" disabled={busy} onClick={() => void remove(passkey)}>Remove</button>
            </li>
          ))}
        </ul>
      ) : null}

      {data?.passkeys.length ? (
        <label className={styles.toggle}>
          <input type="checkbox" checked={data.passkeyOnly} disabled={busy} onChange={(event) => void toggleOnly(event.target.checked)} />
          <span>
            <strong>Only allow Touch ID / Face ID</strong>
            <small>Switches off password sign-in, so nobody can get in with just your password.{data.overridden ? " (Passwords are currently switched back on by a Vercel setting.)" : ""}</small>
          </span>
        </label>
      ) : null}

      {message ? <p className={styles.note} aria-live="polite">{message}</p> : null}
    </div>
  );
}
