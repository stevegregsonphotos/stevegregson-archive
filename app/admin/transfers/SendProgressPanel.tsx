"use client";

import { useState } from "react";
import styles from "./workspace.module.css";

/**
 * Takes over the Send files card while a transfer is going and after it
 * finishes (like WeTransfer): a big ring with the percentage, then a tick
 * with the link. The form comes back with "Send another".
 */
export type SendPanelState = "sending" | "done" | "warn";

const RING = 2 * Math.PI * 54;

export default function SendProgressPanel({
  state,
  percent,
  headline,
  detail,
  title,
  recipients,
  resultUrl,
  onReset,
}: {
  state: SendPanelState;
  /** null = still getting ready (ring spins). */
  percent: number | null;
  headline: string;
  detail: string;
  title: string;
  recipients: string;
  resultUrl: string;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const shown = Math.max(0, Math.min(100, percent ?? 0));
  const spinning = state === "sending" && percent === null;

  return (
    <div className={styles.panel + " " + (state === "sending" ? styles.panelBusy : state === "warn" ? styles.panelWarn : styles.panelDone)} role="status" aria-live="polite">
      <div className={styles.ring + (spinning ? " " + styles.ringSpin : "")}>
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className={styles.ringTrack} cx="60" cy="60" r="54" />
          <circle
            className={styles.ringFill}
            cx="60"
            cy="60"
            r="54"
            strokeDasharray={RING}
            strokeDashoffset={state === "sending" ? (spinning ? RING * 0.75 : RING * (1 - shown / 100)) : 0}
          />
        </svg>
        <span className={styles.ringCentre}>
          {state === "sending" ? (
            spinning ? <small>Starting…</small> : <>{shown}<small>%</small></>
          ) : state === "done" ? (
            <svg className={styles.ringIcon} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          ) : (
            <b className={styles.ringBang} aria-hidden="true">!</b>
          )}
        </span>
      </div>

      <h2 className={styles.panelHeadline}>{headline}</h2>
      {detail ? <p className={styles.panelDetail}>{detail}</p> : null}

      <dl className={styles.panelFacts}>
        {title ? <><dt>Title</dt><dd>{title}</dd></> : null}
        {recipients ? <><dt>{state === "done" ? "Emailed to" : "To"}</dt><dd>{recipients}</dd></> : null}
      </dl>

      {state === "sending" ? (
        <p className={styles.panelKeepOpen}>Keep this tab open until it finishes.</p>
      ) : null}

      {state !== "sending" && resultUrl ? (
        <div className={styles.result + " " + styles.panelResult}>
          <input readOnly value={resultUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Transfer link" />
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(resultUrl).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); }).catch(() => {})}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <a href={resultUrl} target="_blank" rel="noopener">Open ↗</a>
        </div>
      ) : null}

      {state !== "sending" ? (
        <button type="button" className={styles.sendButton + " " + styles.panelAgain} onClick={onReset}>
          {state === "done" ? "Send another" : resultUrl ? "Back to Send files" : "Back to try again"}
        </button>
      ) : null}
    </div>
  );
}
