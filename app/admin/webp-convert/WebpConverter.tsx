"use client";

import { useEffect, useRef, useState } from "react";

import { canvasToWebP } from "@/lib/webp-client";

// Backstage › Settings › Convert photos to WebP.
// Works through every production: finds photos that were stored as PNG/JPEG
// under .webp names (Safari uploads), makes a real WebP of each in this
// browser and replaces the file in place. Same size and name, so the site
// needs no other change. Progress is remembered, so it can be stopped and
// started again.

type Production = { slug: string; title: string; imageCount: number };
type FileInfo = { path: string; size: number };

const IMAGE_BASE = (process.env.NEXT_PUBLIC_PRODUCTION_IMAGE_BASE_URL || "https://images.stevegregson.com").replace(/\/+$/, "");
const DONE_KEY = "webp-convert-done-v1";
const PARALLEL = 3;

function fileUrl(slug: string, path: string) {
  return [IMAGE_BASE, encodeURIComponent(slug), ...path.split("/").map(encodeURIComponent)].join("/");
}

async function api<T>(body: Record<string, unknown>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch("/api/admin/webp-convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as T & { ok?: boolean; message?: string };
      if (!response.ok || !data.ok) throw new Error(data.message || `Backstage said ${response.status}`);
      return data;
    } catch (error) {
      if (attempt >= 4) throw error;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function readKind(url: string): Promise<"webp" | "png" | "jpeg" | "other"> {
  // A fresh query string skips any copy Cloudflare has cached.
  const response = await fetch(`${url}?webpcheck=${Date.now()}`, { headers: { Range: "bytes=0-15" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Couldn't read the file (${response.status}).`);
  const b = new Uint8Array(await response.arrayBuffer());
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return "webp";
  if (b[0] === 0x89 && b[1] === 0x50) return "png";
  if (b[0] === 0xff && b[1] === 0xd8) return "jpeg";
  return "other";
}

async function convertOne(url: string, quality: number) {
  const response = await fetch(`${url}?webpconvert=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Couldn't download the photo (${response.status}).`);
  const source = await response.blob();
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Couldn't prepare the photo.");
    context.drawImage(bitmap, 0, 0);
    const webp = await canvasToWebP(canvas, quality);
    return { webp, before: source.size };
  } finally {
    bitmap.close();
  }
}

function loadDone(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveDone(done: Set<string>) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...done]));
  } catch {
    /* progress just won't be remembered */
  }
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes > 1024 ** 3 ? 0 : 1)} MB`;

export default function WebpConverter() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Not started.");
  const [stats, setStats] = useState({ productionsDone: 0, productionsTotal: 0, converted: 0, alreadyWebp: 0, failed: 0, before: 0, after: 0 });
  const [log, setLog] = useState<string[]>([]);
  const stopRef = useRef(false);
  const autoRetriesRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // Read remembered progress after the first render (localStorage is browser-only).
    void Promise.resolve().then(() => setStats((s) => ({ ...s, productionsDone: loadDone().size })));
  }, []);

  function note(line: string) {
    setLog((lines) => [line, ...lines].slice(0, 200));
  }

  async function start() {
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    stopRef.current = false;
    setRunning(true);
    const done = loadDone();

    try {
      setStatus("Getting the list of productions…");
      const { productions } = await api<{ productions: Production[] }>({ action: "productions" });
      setStats((s) => ({ ...s, productionsTotal: productions.length, productionsDone: productions.filter((p) => done.has(p.slug)).length }));

      for (const production of productions) {
        if (stopRef.current) break;
        if (done.has(production.slug)) continue;

        setStatus(`Checking ${production.title}…`);
        const { files } = await api<{ files: FileInfo[] }>({ action: "files", slug: production.slug });

        // Find which files aren't real WebP yet.
        const toConvert: FileInfo[] = [];
        let alreadyWebp = 0;
        for (let i = 0; i < files.length; i += 8) {
          const kinds = await Promise.all(
            files.slice(i, i + 8).map((f) => readKind(fileUrl(production.slug, f.path)).catch(() => "other" as const)),
          );
          kinds.forEach((kind, k) => {
            if (kind === "webp") alreadyWebp += 1;
            else if (kind === "png" || kind === "jpeg") toConvert.push(files[i + k]);
          });
        }
        setStats((s) => ({ ...s, alreadyWebp: s.alreadyWebp + alreadyWebp }));

        let failedHere = 0;
        for (let i = 0; i < toConvert.length && !stopRef.current; i += PARALLEL) {
          const batch = toConvert.slice(i, i + PARALLEL);
          setStatus(`${production.title}: converting ${Math.min(i + batch.length, toConvert.length)} of ${toConvert.length}…`);
          const { urls } = await api<{ urls: Record<string, string> }>({ action: "sign", slug: production.slug, paths: batch.map((f) => f.path) });

          await Promise.all(
            batch.map(async (file) => {
              const url = fileUrl(production.slug, file.path);
              try {
                const quality = file.path.startsWith("__cards/") ? 0.75 : 0.82;
                const { webp, before } = await convertOne(url, quality);
                let put: Response | null = null;
                for (let attempt = 1; attempt <= 3; attempt += 1) {
                  try {
                    put = await fetch(urls[file.path], { method: "PUT", headers: { "Content-Type": "image/webp" }, body: webp });
                    if (put.ok) break;
                  } catch {
                    put = null;
                  }
                  await new Promise((r) => setTimeout(r, 1500 * attempt));
                }
                if (!put?.ok) throw new Error(`upload failed (${put?.status ?? "no connection"})`);
                if ((await readKind(url)) !== "webp") throw new Error("still not WebP after upload");
                setStats((s) => ({ ...s, converted: s.converted + 1, before: s.before + before, after: s.after + webp.size }));
              } catch (error) {
                failedHere += 1;
                setStats((s) => ({ ...s, failed: s.failed + 1 }));
                note(`✗ ${production.title} › ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
              }
            }),
          );
        }

        if (stopRef.current) break;
        if (failedHere === 0) {
          done.add(production.slug);
          saveDone(done);
          setStats((s) => ({ ...s, productionsDone: s.productionsDone + 1 }));
        }
        note(
          toConvert.length === 0
            ? `✓ ${production.title}: already all WebP`
            : `✓ ${production.title}: ${toConvert.length - failedHere} of ${toConvert.length} converted`,
        );
      }

      setStatus(stopRef.current ? "Stopped. Press Start to carry on where it left off." : "Finished.");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      // Overnight runs: a dropped connection shouldn't end the job. Wait a
      // minute and carry on by itself (finished productions are skipped).
      if (!stopRef.current && autoRetriesRef.current < 60) {
        autoRetriesRef.current += 1;
        setStatus(`Connection dropped (${reason}). Carrying on by itself in 1 minute… (retry ${autoRetriesRef.current})`);
        note(`… connection dropped: ${reason}; retrying in 1 minute`);
        setRunning(false);
        retryTimerRef.current = window.setTimeout(() => {
          if (!stopRef.current) void start();
        }, 60_000);
        return;
      }
      setStatus(`Stopped: ${reason} — press Start to carry on.`);
    } finally {
      setRunning(false);
    }
  }

  const saved = stats.before - stats.after;

  return (
    <div className="webp-convert">
      <p className="webp-convert-status">{status}</p>

      <dl className="webp-convert-stats">
        <div><dt>Productions done</dt><dd>{stats.productionsDone} / {stats.productionsTotal || "…"}</dd></div>
        <div><dt>Photos converted</dt><dd>{stats.converted}</dd></div>
        <div><dt>Already WebP</dt><dd>{stats.alreadyWebp}</dd></div>
        <div><dt>Problems</dt><dd>{stats.failed}</dd></div>
        <div><dt>Space saved</dt><dd>{stats.converted ? `${mb(saved)} (${mb(stats.before)} → ${mb(stats.after)})` : "—"}</dd></div>
      </dl>

      <div className="webp-convert-actions">
        {running ? (
          <button type="button" className="backstage-button" onClick={() => { stopRef.current = true; if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current); setStatus("Stopping after the current photos…"); }}>
            Stop
          </button>
        ) : (
          <button type="button" className="backstage-button backstage-button-primary" onClick={start}>
            {stats.productionsDone > 0 ? "Start (carry on)" : "Start converting"}
          </button>
        )}
        {!running && stats.productionsDone > 0 ? (
          <button
            type="button"
            className="backstage-button"
            onClick={() => {
              if (window.confirm("Forget progress and check every production again?")) {
                saveDone(new Set());
                setStats((s) => ({ ...s, productionsDone: 0 }));
              }
            }}
          >
            Check everything again
          </button>
        ) : null}
      </div>

      <p className="webp-convert-hint">Keep this tab open. It&rsquo;s safe to stop and start again: finished productions are skipped.</p>

      {log.length > 0 ? (
        <ol className="webp-convert-log">
          {log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
