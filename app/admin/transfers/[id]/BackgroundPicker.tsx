"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TransferRecord } from "@/lib/transfers/types";
import { MAX_BACKGROUNDS } from "@/lib/transfers/backgrounds";
import { postTransferAction } from "@/lib/transfers/upload-client";
import { uploadTransferBackdropFromUrl } from "@/lib/transfers/backdrop-client";
import styles from "../transfers.module.css";

type Preview = { fileId: string; name: string; url: string; hasBackdrop: boolean };

/** Lets Steve pick which of a transfer's photographs fill the client page. */
export default function BackgroundPicker({ transfer, onChange }: {
  transfer: TransferRecord;
  onChange: (transfer: TransferRecord) => void;
}) {
  const [previews, setPreviews] = useState<Preview[] | null>(null);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    postTransferAction<{ previews: Preview[]; total: number }>({ action: "background-previews", transferId: transfer.id })
      .then((data) => {
        if (cancelled) return;
        setPreviews(data.previews);
        setTotal(data.total);
      })
      .catch((error) => !cancelled && setMessage(error instanceof Error ? error.message : "Couldn't load the photos."));
    return () => { cancelled = true; };
  }, [transfer.id]);

  const selected = transfer.backgroundFileIds;

  async function save(fileIds: string[]) {
    setSaving(true);
    setMessage("");
    try {
      const result = await postTransferAction<{ transfer: TransferRecord }>({ action: "set-backgrounds", transferId: transfer.id, fileIds });
      onChange(result.transfer);
      return result.transfer;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(preview: Preview) {
    if (selected.includes(preview.fileId)) {
      await save(selected.filter((id) => id !== preview.fileId));
      return;
    }
    if (selected.length >= MAX_BACKGROUNDS) {
      setMessage("You can choose up to " + MAX_BACKGROUNDS + " photographs.");
      return;
    }
    const updated = await save([...selected, preview.fileId]);
    if (!updated || preview.hasBackdrop) return;
    // Make a light, web-sized copy so the client page loads quickly.
    // If the storage can't be read from the browser, the original is used instead.
    try {
      setMessage("Preparing a web-sized copy of " + preview.name + "…");
      await uploadTransferBackdropFromUrl(transfer.id, preview.fileId, preview.url);
      setPreviews((current) => current?.map((p) => (p.fileId === preview.fileId ? { ...p, hasBackdrop: true } : p)) ?? current);
      setMessage("");
    } catch {
      setMessage("");
    }
  }

  return (
    <section className={styles.coverEditor}>
      <div className={styles.coverHead}>
        <div>
          <strong>Client page backgrounds</strong>
          <p>
            Pick photographs from this transfer to fill the client&rsquo;s screen (up to {MAX_BACKGROUNDS}, shown in the order you pick them).
            With none picked, your <Link href="/admin/transfers/backgrounds">default backgrounds</Link> are used.
          </p>
        </div>
        <span>{selected.length ? selected.length + " picked" : "Using your defaults"}</span>
      </div>

      {previews === null && !message ? <p className={styles.muted}>Loading photographs…</p> : null}
      {previews && previews.length === 0 ? (
        <p className={styles.muted}>
          {total ? "This transfer's photographs are in a format browsers can't show (e.g. TIFF or RAW), so your defaults will be used." : "There are no photographs in this transfer, so your default backgrounds will be used."}
        </p>
      ) : null}
      {previews && previews.length > 0 ? (
        <div className={styles.coverGrid}>
          {previews.map((preview) => {
            const position = selected.indexOf(preview.fileId);
            return (
              <button
                type="button"
                key={preview.fileId}
                className={position >= 0 ? styles.coverSelected : styles.coverChoice}
                disabled={saving}
                onClick={() => void toggle(preview)}
                aria-pressed={position >= 0}
                title={preview.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.url} alt="" loading="lazy" />
                {position >= 0 ? <em className={styles.coverBadge}>{position + 1}</em> : null}
                <small>{preview.name.split("/").pop()}</small>
              </button>
            );
          })}
        </div>
      ) : null}
      <div className={styles.coverFoot}>
        {selected.length > 0 ? (
          <button type="button" disabled={saving} onClick={() => void save([])}>Use my default backgrounds instead</button>
        ) : <span />}
        <a href={"/transfer/preview?id=" + encodeURIComponent(transfer.id)} target="_blank" rel="noopener">Preview what the client sees ↗</a>
      </div>
      {message ? <p className={styles.editMessage} aria-live="polite">{message}</p> : null}
    </section>
  );
}
