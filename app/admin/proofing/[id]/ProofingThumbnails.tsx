"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  makeProofThumbnail,
  uploadProofThumbnail,
} from "@/lib/proofing/thumbnail-client";

/*
 * Sidebar card: makes the small, quick-loading grid thumbnails for photos
 * uploaded before thumbnails existed. Steve's browser does the work
 * (reads each proof from storage, shrinks it, uploads the thumbnail), so
 * nothing heavy runs on Vercel. New uploads get a thumbnail automatically.
 */

const BATCH = 24;
const AT_ONCE = 4;

type Phase = "checking" | "ready" | "needed" | "working" | "done" | "error";

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/admin/proofing/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string } & T;
  if (!response.ok || !data.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

export default function ProofingThumbnails({
  galleryId,
  imageCount,
}: {
  galleryId: string;
  imageCount: number;
}) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [missing, setMissing] = useState<string[]>([]);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(0);
  const [message, setMessage] = useState("");
  const running = useRef(false);

  const check = useCallback(async () => {
    try {
      const status = await post<{ total: number; missing: string[] }>({ action: "thumbs-status", galleryId });
      setMissing(status.missing);
      setPhase(status.missing.length ? "needed" : "ready");
    } catch {
      setPhase("error");
      setMessage("Couldn't check the thumbnails.");
    }
  }, [galleryId]);

  useEffect(() => {
    const timer = window.setTimeout(check, 0);
    return () => window.clearTimeout(timer);
  }, [check, imageCount]);

  async function makeAll() {
    if (running.current || !missing.length) return;
    running.current = true;
    setPhase("working");
    setDone(0);
    setFailed(0);
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    let failures = 0;

    try {
      for (let start = 0; start < missing.length; start += BATCH) {
        const { jobs } = await post<{ jobs: Array<{ webFilename: string; sourceUrl: string; thumbUploadUrl: string }> }>({
          action: "presign-thumbs",
          galleryId,
          webFilenames: missing.slice(start, start + BATCH),
        });
        let next = 0;
        const worker = async () => {
          while (next < jobs.length) {
            const job = jobs[next++];
            try {
              const source = await fetch(job.sourceUrl);
              if (!source.ok) throw new Error("HTTP " + source.status);
              const thumb = await makeProofThumbnail(await source.blob());
              await uploadProofThumbnail(job.thumbUploadUrl, thumb);
            } catch {
              failures += 1;
              setFailed(failures);
            }
            setDone((count) => count + 1);
          }
        };
        await Promise.all(Array.from({ length: AT_ONCE }, worker));
      }
      setPhase("done");
      setMessage(failures ? failures + " didn't work. Press the button again to retry them." : "");
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      window.removeEventListener("beforeunload", warn);
      running.current = false;
      if (failures) {
        await check();
        setMessage(failures + " didn't work. Press the button to retry them.");
      }
    }
  }

  if (phase === "checking" || imageCount === 0) return null;

  const percent = missing.length ? Math.round((done / missing.length) * 100) : 100;

  return (
    <div className="sp-gallery-sidebar-card sp-gallery-thumbs" aria-live="polite">
      <strong className="sp-gallery-thumbs-title">Quick-loading thumbnails</strong>

      {phase === "ready" || (phase === "done" && !failed) ? (
        <p className="sp-gallery-thumbs-good">✓ All {imageCount.toLocaleString("en-GB")} photos ready. The gallery loads light thumbnails, and full size only when a photo is opened.</p>
      ) : phase === "working" ? (
        <>
          <p>
            Making {done.toLocaleString("en-GB")} of {missing.length.toLocaleString("en-GB")}… keep this tab open.
          </p>
          <div className="sp-gallery-thumbs-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: Math.max(2, percent) + "%" }} />
          </div>
        </>
      ) : (
        <>
          <p>
            {missing.length.toLocaleString("en-GB")} of {imageCount.toLocaleString("en-GB")} photos still load at full size in the gallery, which is slow to scroll. Make small thumbnails for them (takes a few minutes; your browser does the work).
          </p>
          {message ? <p className="sp-gallery-thumbs-note">{message}</p> : null}
          <button type="button" className="sp-gallery-thumbs-button" onClick={makeAll} disabled={!missing.length}>
            Make thumbnails
          </button>
        </>
      )}
    </div>
  );
}
