"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./mac-progress.module.css";

// Upload progress from the Mac app (public/mac/agent.zsh sends it every
// ~15 seconds while uploading, and at the end of every run).

type Pair = { files: number; bytes: number };
type Status = {
  state: string;
  updated: number;
  total: Pair;
  done: Pair;
  failed: number;
  waiting: number;
  tooBig: number;
  checked?: number;
  down?: { files: number; bytes: number; doneFiles: number; doneBytes: number };
  current: string[];
  recent: Array<{ at: number; path: string }>;
  onMac: Pair;
  nextClear: number;
  offloadDays: number;
};
type Mac = { id: string; name: string; receivedAt: string; status: Status };

const STALE_MS = 15 * 60 * 1000; // the Mac checks in at least every 5 minutes when awake

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

const plural = (n: number, word: string) => n.toLocaleString("en-GB") + " " + word + (n === 1 ? "" : "s");

function ago(ms: number, now: number) {
  const seconds = Math.max(0, (now - ms) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + " min ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + " hr ago";
  return Math.floor(seconds / 86400) + " days ago";
}

function dateText(epoch: number) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(epoch * 1000));
}

function shortPath(path: string) {
  return path.split("/").slice(-2).join(" / ");
}

function describe(mac: Mac, now: number) {
  const s = mac.status;
  const stale = now - new Date(mac.receivedAt).getTime() > STALE_MS;
  const left: Pair = { files: Math.max(0, s.total.files - s.done.files), bytes: Math.max(0, s.total.bytes - s.done.bytes) };
  const uploading = !stale && s.state === "uploading" && left.files > 0;
  let headline = "Everything is uploaded";
  let tone: "busy" | "ok" | "warn" | "quiet" = "ok";
  if (stale) {
    headline = "Mac asleep or offline";
    tone = "quiet";
  } else if (s.state === "offline") {
    headline = "Mac can't reach Storage";
    tone = "warn";
  } else if (s.state === "disconnected") {
    headline = "Mac is disconnected";
    tone = "warn";
  } else if (uploading) {
    headline = "Uploading " + plural(left.files, "file") + " · " + bytes(left.bytes) + " left";
    tone = "busy";
  } else if (s.state === "downloading" && s.down && s.down.files > s.down.doneFiles) {
    headline = "Bringing back " + plural(s.down.files - s.down.doneFiles, "file") + " from Storage · " + bytes(Math.max(0, s.down.bytes - s.down.doneBytes)) + " left";
    tone = "busy";
  } else if (s.state === "checking") {
    headline = "Checking for new files" + (s.checked ? " (" + s.checked.toLocaleString("en-GB") + " so far)" : "") + "…";
    tone = "busy";
  } else if (s.state === "waiting" || s.waiting > 0) {
    headline = "Waiting for files to finish copying in";
    tone = "busy";
  } else if (s.failed > 0) {
    headline = plural(s.failed, "file") + " to retry";
    tone = "warn";
  }
  const percent = uploading && s.total.bytes > 0 ? Math.min(100, Math.round((s.done.bytes / s.total.bytes) * 100)) : null;
  return { stale, left, uploading, headline, tone, percent };
}

async function fetchProgress(): Promise<Mac[]> {
  const response = await fetch("/api/admin/storage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "mac-progress" }),
  });
  const data = await response.json().catch(() => ({ ok: false }));
  return data.ok ? (data.macs as Mac[]) : [];
}

function useMacProgress() {
  const [macs, setMacs] = useState<Mac[] | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let alive = true;
    let timer = 0;
    async function poll() {
      if (document.visibilityState === "visible") {
        try {
          const list = await fetchProgress();
          if (alive) setMacs(list);
        } catch {
          /* try again next time */
        }
      }
      if (alive) {
        setNow(Date.now()); // keeps "2 min ago" fresh
        timer = window.setTimeout(() => void poll(), 5000);
      }
    }
    void poll();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);
  return { macs, now };
}

/** One line under "Mac app" in the Storage sidebar. */
export function MacProgressLine() {
  const { macs, now } = useMacProgress();
  const mac = macs?.[0];
  if (!mac) return null;
  const d = describe(mac, now);
  return (
    <Link href="/admin/storage/mac" className={styles.line + " " + styles[d.tone]} title={d.headline}>
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.lineText}>{d.uploading ? "↑ " + plural(d.left.files, "file") + " left" : d.headline}</span>
      {d.percent !== null ? (
        <span className={styles.lineBar} aria-hidden="true"><span style={{ width: d.percent + "%" }} /></span>
      ) : null}
    </Link>
  );
}

/** The full panel on Backstage › Storage › Mac app. */
export function MacProgressPanel() {
  const { macs, now } = useMacProgress();
  if (macs === null) return <p className={styles.muted}>Checking your Mac&rsquo;s uploads…</p>;
  if (macs.length === 0) {
    return <p className={styles.muted}>Nothing reported yet. Progress appears here once your Mac has the latest version of the Storage app.</p>;
  }
  return (
    <div className={styles.panelBody}>
      {macs.map((mac) => {
        const s = mac.status;
        const d = describe(mac, now);
        return (
          <article key={mac.id} className={styles.mac}>
            <div className={styles.head}>
              <span className={styles.dot + " " + styles[d.tone]} aria-hidden="true" />
              <div>
                <strong>{d.headline}</strong>
                <small>{mac.name} · last checked in {ago(new Date(mac.receivedAt).getTime(), now)}</small>
              </div>
            </div>

            {d.percent !== null ? (
              <>
                <div className={styles.bar} role="progressbar" aria-valuenow={d.percent} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: d.percent + "%" }} />
                </div>
                <p className={styles.numbers}>
                  {s.done.files.toLocaleString("en-GB")} of {plural(s.total.files, "file")} · {bytes(s.done.bytes)} of {bytes(s.total.bytes)}
                </p>
              </>
            ) : null}

            {!d.stale && s.current.length > 0 ? (
              <div className={styles.list}>
                <h3>{s.state === "downloading" ? "Bringing back now" : "Uploading now"}</h3>
                <ul>{s.current.slice(0, 8).map((path) => <li key={path} title={path}>{shortPath(path)}</li>)}</ul>
              </div>
            ) : null}

            {s.waiting > 0 && !d.stale ? <p className={styles.note}>{plural(s.waiting, "file")} still copying in.</p> : null}
            {s.failed > 0 ? <p className={styles.note}>{plural(s.failed, "file")} didn&rsquo;t upload last time and will be retried.</p> : null}
            {s.tooBig > 0 ? <p className={styles.note}>{plural(s.tooBig, "file")} over 5 GB can&rsquo;t be uploaded yet.</p> : null}

            {s.recent.length > 0 && (d.stale || s.current.length === 0) ? (
              <div className={styles.list}>
                <h3>Last uploaded</h3>
                <ul>
                  {[...s.recent].reverse().slice(0, 5).map((item) => (
                    <li key={item.path + item.at} title={item.path}>{shortPath(item.path)} <small>{ago(item.at * 1000, now)}</small></li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className={styles.clear}>
              {s.onMac.files > 0
                ? "On the Mac and safe in Storage: " + plural(s.onMac.files, "file") + " (" + bytes(s.onMac.bytes) + "). " +
                  (s.nextClear > 0
                    ? "Next cleared from the Mac " + (s.nextClear * 1000 <= now ? "on its next check" : dateText(s.nextClear)) + "."
                    : "")
                : "Nothing waiting to be cleared from the Mac."}{" "}
              Files are cleared {plural(s.offloadDays || 2, "day")} after uploading.
            </p>
          </article>
        );
      })}
    </div>
  );
}
