"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./backgrounds.module.css";
import { MAX_BACKGROUNDS, TRANSFER_BRAND_BACKGROUNDS } from "@/lib/transfers/backgrounds";
import { canMakeBackdrop, uploadBrandBackground } from "@/lib/transfers/backdrop-client";
import { postTransferAction } from "@/lib/transfers/upload-client";
import { useFileDrop } from "@/lib/transfers/use-file-drop";

type Background = { id: string; url: string; width: number; height: number };

export default function BrandBackgroundsClient() {
  const [items, setItems] = useState<Background[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await postTransferAction<{ backgrounds: Background[] }>({ action: "brand-list" });
      setItems(data.backgrounds);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't load your backgrounds.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function add(files: File[]) {
    const photos = files.filter((file) => canMakeBackdrop(file));
    const skipped = files.length - photos.length;
    const room = MAX_BACKGROUNDS - items.length;
    if (!photos.length) {
      setMessage("Please choose JPEG, PNG or WebP photographs.");
      return;
    }
    if (room <= 0) {
      setMessage("You already have " + MAX_BACKGROUNDS + " backgrounds. Remove one to add another.");
      return;
    }
    const chosen = photos.slice(0, room);
    setBusy(true);
    try {
      for (let i = 0; i < chosen.length; i += 1) {
        setMessage("Preparing and uploading " + (i + 1) + " of " + chosen.length + "…");
        await uploadBrandBackground(chosen[i]);
      }
      const notes = [];
      if (skipped) notes.push(skipped + " file" + (skipped === 1 ? " wasn't a" : "s weren't") + " JPEG/PNG/WebP");
      if (photos.length > room) notes.push("only the first " + room + " fitted (maximum " + MAX_BACKGROUNDS + ")");
      setMessage("Added " + chosen.length + " background" + (chosen.length === 1 ? "" : "s") + "." + (notes.length ? " (" + notes.join("; ") + ".)" : ""));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this background?")) return;
    setBusy(true);
    try {
      await postTransferAction({ action: "brand-delete", id });
      setItems((current) => current.filter((item) => item.id !== id));
      setMessage("Removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't remove it.");
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, by: number) {
    const target = index + by;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    try {
      await postTransferAction({ action: "brand-reorder", ids: next.map((item) => item.id) });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't save the new order.");
      await load();
    }
  }

  const { dragging, dropProps } = useFileDrop((queued) => void add(queued.map((item) => item.file)), !busy);

  return (
    <main className={styles.page}>
      <Link className={styles.back} href="/admin/transfers">← Back to Transfers</Link>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Transfers · Client page</p>
          <h1>Backgrounds</h1>
          <p className={styles.intro}>
            These photographs fill the screen behind your logo when a client opens a transfer. They play as a slow
            slideshow, in this order. For any single transfer you can instead pick photos from the files being sent.
          </p>
        </div>
        <a className={styles.previewButton} href="/transfer/preview" target="_blank" rel="noopener">
          Preview client page ↗
        </a>
      </header>

      <section
        className={styles.drop + (dragging ? " " + styles.dropActive : "")}
        {...dropProps}
      >
        <input
          ref={inputRef}
          className={styles.hidden}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(event) => { void add(Array.from(event.target.files || [])); event.target.value = ""; }}
        />
        <button type="button" className={styles.addButton} disabled={busy || items.length >= MAX_BACKGROUNDS} onClick={() => inputRef.current?.click()}>
          + Add photographs
        </button>
        <p>
          or drag them here · up to {MAX_BACKGROUNDS}{" "}· landscape works best · they&rsquo;re resized automatically so the page stays fast
        </p>
        {message ? <p className={styles.message} aria-live="polite">{message}</p> : null}
      </section>

      {loading ? <p className={styles.muted}>Loading…</p> : null}

      {!loading && items.length === 0 ? (
        <>
          <h2 className={styles.subhead}>Currently showing the built-in collection</h2>
          <p className={styles.muted}>Add your own photographs above and they&rsquo;ll be used instead.</p>
          <div className={styles.grid}>
            {TRANSFER_BRAND_BACKGROUNDS.map((url) => (
              <figure className={styles.card + " " + styles.builtIn} key={url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" loading="lazy" />
              </figure>
            ))}
          </div>
        </>
      ) : null}

      {items.length > 0 ? (
        <>
          <h2 className={styles.subhead}>Your backgrounds · {items.length} of {MAX_BACKGROUNDS}</h2>
          <div className={styles.grid}>
            {items.map((item, index) => (
              <figure className={styles.card} key={item.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" loading="lazy" />
                <figcaption>
                  <span>{index === 0 ? "Shown first" : "#" + (index + 1)}</span>
                  <div>
                    <button type="button" disabled={busy || index === 0} onClick={() => void move(index, -1)} aria-label="Move earlier">←</button>
                    <button type="button" disabled={busy || index === items.length - 1} onClick={() => void move(index, 1)} aria-label="Move later">→</button>
                    <button type="button" disabled={busy} onClick={() => void remove(item.id)}>Remove</button>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}
