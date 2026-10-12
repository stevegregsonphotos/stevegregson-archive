"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import styles from "./mac.module.css";
import { LaptopIcon } from "../StorageIcons";

type Device = { id: string; name: string; createdAt: string; lastSeenAt?: string; connected: boolean; uploads: number };
type Recent = { path: string; sizeBytes: number; uploadedAt: string; device: string };
type Cors = { ok: boolean; canEdit: boolean; origins: Array<{ origin: string; upload: boolean; download: boolean }> };

function bytes(value: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return (size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)) + " " + units[unit];
}

function when(value?: string) {
  if (!value) return "Waiting to connect";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(value));
}

async function api<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/admin/storage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({ ok: false, message: "Unexpected response (HTTP " + response.status + ")." }));
  if (!data.ok) throw new Error(data.message || "Something went wrong.");
  return data as T;
}

export default function MacAppClient() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [command, setCommand] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cors, setCors] = useState<Cors | null>(null);
  const [corsMessage, setCorsMessage] = useState("Checking…");

  const load = useCallback(async () => {
    try {
      const data = await api<{ devices: Device[]; recent: Recent[] }>({ action: "mac-overview" });
      setDevices(data.devices);
      setRecent(data.recent);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't load.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
      api<{ cors: Cors }>({ action: "cors-check" })
        .then((data) => { setCors(data.cors); setCorsMessage(""); })
        .catch((error) => setCorsMessage(error instanceof Error ? error.message : "Couldn't check."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function fixCors() {
    setBusy(true);
    setCorsMessage("Updating…");
    try {
      const data = await api<{ cors: Cors }>({ action: "cors-fix" });
      setCors(data.cors);
      setCorsMessage(data.cors.ok ? "Done — browsers can now upload and download directly." : "Updated, but something still isn't right.");
    } catch (error) {
      setCorsMessage(error instanceof Error ? error.message : "Couldn't update.");
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    setBusy(true);
    setMessage("");
    try {
      const data = await api<{ command: string }>({ action: "mac-connect" });
      setCommand(data.command);
      setCopied(false);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't create a connection code.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(device: Device) {
    if (!window.confirm("Disconnect " + device.name + "? It will stop uploading until you connect it again. Nothing in Storage or on the Mac is deleted.")) return;
    setBusy(true);
    try {
      await api({ action: "mac-disconnect", id: device.id });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't disconnect.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      setMessage("Couldn't copy automatically — select the text and copy it.");
    }
  }

  return (
    <main className={styles.page}>
      <Link className={styles.back} href="/admin/storage">← Storage</Link>

      <header className={styles.hero}>
        <div className={styles.heroIcon}><LaptopIcon /></div>
        <div>
          <h1>Storage on your Mac</h1>
          <p>
            A <strong>Steve Gregson Storage</strong>{" "}folder on your Mac, plus an icon in your Dock. Anything you put in
            the folder, or drop on the Dock icon, uploads to Storage by itself. Seven days later, once it&rsquo;s been
            checked as an exact match in Storage, the copy on your Mac is removed to free up space.
          </p>
        </div>
      </header>

      <section className={styles.how}>
        <article>
          <span>1</span>
          <h2>Drop it in</h2>
          <p>Drag files or folders into the Steve Gregson Storage folder, or onto the Dock icon.</p>
        </article>
        <article>
          <span>2</span>
          <h2>It uploads</h2>
          <p>Uploads start within a few seconds, keeping your folder structure. You&rsquo;ll get a notification when they&rsquo;re done.</p>
        </article>
        <article>
          <span>3</span>
          <h2>Space freed after 7 days</h2>
          <p>Each file is checked against Storage fingerprint-for-fingerprint before the Mac copy is removed. It stays safe in Storage.</p>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2>Connect a Mac</h2>
            <p>Takes about a minute. Free: nothing to buy and no App Store.</p>
          </div>
          <button type="button" className={styles.primary} disabled={busy} onClick={() => void connect()}>
            {command ? "Make a new code" : "Connect this Mac"}
          </button>
        </div>

        {command ? (
          <ol className={styles.steps}>
            <li>
              <strong>Copy this line</strong>
              <div className={styles.command}>
                <code>{command}</code>
                <button type="button" onClick={() => void copy()}>{copied ? "Copied ✓" : "Copy"}</button>
              </div>
              <small>It contains a private code for this Mac, so don&rsquo;t share it.</small>
            </li>
            <li>
              <strong>Open Terminal</strong>{" "}— press <kbd>⌘</kbd> <kbd>Space</kbd>, type <em>Terminal</em> and press Return.
            </li>
            <li>
              <strong>Paste and press Return.</strong>{" "}Your Mac may ask once to allow notifications or to add the icon to your Dock.
            </li>
            <li>
              <strong>Done.</strong>{" "}The folder is in your Home folder and Finder&rsquo;s sidebar, and the icon is in your Dock. (If the folder isn&rsquo;t in the sidebar, drag it into Favourites once.)
            </li>
          </ol>
        ) : null}
        {message ? <p className={styles.message}>{message}</p> : null}
      </section>

      <section className={styles.panel}>
        <h2>Connected Macs</h2>
        {devices.length === 0 ? <p className={styles.muted}>No Macs connected yet.</p> : null}
        <ul className={styles.devices}>
          {devices.map((device) => (
            <li key={device.id}>
              <LaptopIcon />
              <div>
                <strong>{device.name}</strong>
                <small>{device.connected ? "Last checked in " + when(device.lastSeenAt) + " · " + device.uploads + " files uploaded" : "Waiting for the install to finish"}</small>
              </div>
              <button type="button" disabled={busy} onClick={() => void disconnect(device)}>Disconnect</button>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.panel}>
        <h2>Recently uploaded from your Mac</h2>
        {recent.length === 0 ? <p className={styles.muted}>Nothing yet.</p> : null}
        <ul className={styles.recent}>
          {recent.map((item) => (
            <li key={item.path + item.uploadedAt}>
              <span title={item.path}>{item.path}</span>
              <small>{bytes(item.sizeBytes)} · {when(item.uploadedAt)}</small>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2>Storage connection</h2>
            <p>Lets browsers upload to Storage, and lets clients download a whole transfer as one zip.</p>
          </div>
          {cors && !cors.ok ? (
            <button type="button" className={styles.primary} disabled={busy || !cors.canEdit} onClick={() => void fixCors()}>Fix this</button>
          ) : null}
        </div>
        {cors ? (
          <ul className={styles.recent}>
            {cors.origins.map((item) => (
              <li key={item.origin}>
                <span>{item.origin.replace("https://", "")}</span>
                <small>{item.upload ? "✓ uploads" : "✗ uploads"} · {item.download ? "✓ downloads" : "✗ downloads"}</small>
              </li>
            ))}
          </ul>
        ) : null}
        {corsMessage ? <p className={styles.muted}>{corsMessage}</p> : null}
      </section>

      <section className={styles.notes}>
        <h2>Good to know</h2>
        <ul>
          <li>Deleting something from the Mac folder never deletes it from Storage.</li>
          <li>If you change a file within the 7 days, the new version is uploaded and its 7 days start again.</li>
          <li>If you delete or move a file in Storage before the 7 days are up, the Mac keeps its copy rather than risk losing it.</li>
          <li>Single files over 5 GB aren&rsquo;t uploaded yet; you&rsquo;ll get a notification if there is one.</li>
          <li>Your Mac needs to be awake and online to upload. Anything waiting carries on next time.</li>
          <li>Plain icon in the Dock? Paste <code>curl -fsSL https://www.stevegregson.com/mac/install.sh | bash -s -- --icon</code> into Terminal to refresh it.</li>
          <li>To remove the app, paste <code>curl -fsSL https://www.stevegregson.com/mac/install.sh | bash -s -- --uninstall</code> into Terminal. Your folder and files are left in place.</li>
        </ul>
      </section>
    </main>
  );
}
