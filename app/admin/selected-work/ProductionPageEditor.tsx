"use client";

/* eslint-disable @next/next/no-img-element -- thumbnails come from our own image hosts at fixed sizes */

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  COMMISSIONS_SLOTS,
  SHOWCASE_SIZE_LABELS,
  SHOWCASE_SIZES,
  type CommissionsImages,
  type CommissionsPicture,
  type CommissionsSlot,
  type ShowcaseItem,
  type ShowcaseSize,
} from "../../../lib/selected-work-page";

import styles from "./production-page-editor.module.css";

const API = "/api/admin/selected-work-page";

type ProductionOption = { slug: string; title: string; venue: string; year: number };
type PickedImage = {
  src: string;
  smallSrc?: string;
  alt: string;
  width?: number;
  height?: number;
  production?: { slug: string; title: string; venue: string };
};

type LoadedData = {
  page: { items: ShowcaseItem[] };
  saved: boolean;
  commissions: {
    automatic: Partial<Record<CommissionsSlot, CommissionsPicture>>;
    chosen: CommissionsImages;
  };
  productions: ProductionOption[];
};

function newId(src: string) {
  const base = src.split("/").pop()?.replace(/\.[a-z0-9]+(\?.*)?$/i, "").slice(0, 60) || "photo";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

function measure(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.naturalWidth || 2048, height: image.naturalHeight || 1365 });
    image.onerror = () => resolve({ width: 2048, height: 1365 });
    image.src = src;
  });
}

/* ---------------- Picker ---------------- */

function ImagePicker({
  productions,
  onPick,
  onClose,
  title,
}: {
  productions: ProductionOption[];
  onPick: (image: PickedImage) => void;
  onClose: () => void;
  title: string;
}) {
  const [tab, setTab] = useState<"production" | "library">("production");
  const [slug, setSlug] = useState("");
  const [filter, setFilter] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return term
      ? productions.filter((production) =>
          `${production.title} ${production.venue} ${production.year}`.toLowerCase().includes(term),
        )
      : productions;
  }, [filter, productions]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (tab === "production" && !slug) {
        setImages([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const query = tab === "library" ? "library=1" : `production=${encodeURIComponent(slug)}`;
        const response = await fetch(`${API}?${query}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "Could not load photographs.");
        if (cancelled) return;

        setImages(
          (data.images as PickedImage[]).map((image) => ({
            ...image,
            ...(data.production
              ? {
                  production: {
                    slug: data.production.slug,
                    title: data.production.title,
                    venue: data.production.venue,
                  },
                }
              : {}),
          })),
        );
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load photographs.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tab, slug]);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className={styles.picker} onClick={(event) => event.stopPropagation()}>
        <div className={styles.pickerHeader}>
          <strong style={{ marginRight: "1.5rem" }}>{title}</strong>
          <button
            type="button"
            className={tab === "production" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setTab("production")}
          >
            From a production
          </button>
          <button
            type="button"
            className={tab === "library" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setTab("library")}
          >
            From the photo library
          </button>
          <span className={styles.toolbarSpacer} />
          <button type="button" className={styles.small} onClick={onClose}>
            Close
          </button>
        </div>

        {tab === "production" ? (
          <div className={styles.fields}>
            <label className={styles.field}>
              Search productions
              <input
                className={styles.input}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Title, venue or year"
              />
            </label>
            <label className={styles.field}>
              Production
              <select className={styles.select} value={slug} onChange={(event) => setSlug(event.target.value)}>
                <option value="">Choose a production…</option>
                {filtered.map((production) => (
                  <option key={production.slug} value={production.slug}>
                    {production.title} — {production.venue} ({production.year})
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <p className={styles.intro}>
            Photographs uploaded in the photo library (the other tab on this page). Upload new photographs
            there first, then add them here.
          </p>
        )}

        {loading ? <p className={styles.message}>Loading…</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.pickerGrid}>
          {images.map((image) => (
            <button
              key={image.src}
              type="button"
              className={styles.pickerItem}
              onClick={() => onPick(image)}
              title={image.alt}
            >
              <img src={image.smallSrc || image.src} alt={image.alt} loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Main editor ---------------- */

export default function ProductionPageEditor() {
  const [data, setData] = useState<LoadedData | null>(null);
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [chosen, setChosen] = useState<CommissionsImages>({});
  const [dirty, setDirty] = useState(false);
  const [commissionsDirty, setCommissionsDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [picker, setPicker] = useState<null | { mode: "add" } | { mode: "replace"; id: string } | { mode: "slot"; slot: CommissionsSlot }>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(API, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Could not load.");
      setData(json as LoadedData);
      setItems((json as LoadedData).page.items);
      setChosen((json as LoadedData).commissions.chosen || {});
      setDirty(false);
      setCommissionsDirty(false);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load.");
    }
  }, []);

  useEffect(() => {
    // Initial load; the state updates happen after the request finishes.
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!dirty && !commissionsDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, commissionsDirty]);

  const productions = useMemo(() => data?.productions ?? [], [data]);
  const productionBySlug = useMemo(
    () => new Map(productions.map((production) => [production.slug, production])),
    [productions],
  );

  function update(id: string, patch: Partial<ShowcaseItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setDirty(true);
    setMessage("");
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    setItems((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDirty(true);
    setMessage("");
  }

  function remove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    setDirty(true);
    setMessage("");
  }

  async function handlePick(image: PickedImage) {
    if (!picker) return;

    if (picker.mode === "slot") {
      const big = picker.slot === "hero";
      setChosen((current) => ({
        ...current,
        [picker.slot]: { src: big ? image.src : image.smallSrc || image.src, alt: image.alt },
      }));
      setCommissionsDirty(true);
      setMessage("");
      setPicker(null);
      return;
    }

    const size =
      image.width && image.height ? { width: image.width, height: image.height } : await measure(image.src);
    const credit = image.production
      ? { slug: image.production.slug, title: image.production.title, venue: image.production.venue }
      : null;

    if (picker.mode === "replace") {
      update(picker.id, {
        src: image.src,
        smallSrc: image.smallSrc,
        width: size.width,
        height: size.height,
        alt: image.alt,
        ...(credit ? { credit } : {}),
      });
    } else {
      const upright = size.height > size.width;
      setItems((current) => [
        ...current,
        {
          id: newId(image.src),
          src: image.src,
          ...(image.smallSrc ? { smallSrc: image.smallSrc } : {}),
          width: size.width,
          height: size.height,
          alt: image.alt,
          credit,
          size: upright ? "tall" : "half",
        },
      ]);
      setDirty(true);
      setMessage("Added at the bottom of the list. Move it into place, then save.");
    }

    setPicker(null);
  }

  async function save(kind: "page" | "commissions") {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "page" ? { page: { items } } : { commissions: chosen }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Could not save.");

      if (kind === "page") {
        setItems(json.page.items);
        setDirty(false);
        setMessage("Saved. The live Selected Work page has been updated.");
      } else {
        setChosen(json.commissions);
        setCommissionsDirty(false);
        setMessage("Saved. The live Commissions page has been updated.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return error ? <p className={styles.error}>{error}</p> : <p className={styles.message}>Loading…</p>;
  }

  return (
    <div>
      <p className={styles.intro}>
        These are the photographs on the public Selected Work page, in order. The first one is always
        shown large at the top. Choose a production to set the caption and its link; you can edit the
        wording. Nothing changes on the live site until you press Save.
      </p>

      <div className={styles.toolbar}>
        <button type="button" className="backstage-button" onClick={() => setPicker({ mode: "add" })}>
          Add photograph
        </button>
        <a className="backstage-button" href="/selected-work" target="_blank" rel="noreferrer">
          View live page
        </a>
        <span className={styles.toolbarSpacer} />
        {message ? <span className={styles.message}>{message}</span> : null}
        {error ? <span className={styles.error}>{error}</span> : null}
        <button type="button" className="backstage-button" onClick={load} disabled={busy || (!dirty && !commissionsDirty)}>
          Undo changes
        </button>
        <button
          type="button"
          className="backstage-button backstage-button-primary"
          onClick={() => save("page")}
          disabled={busy || !dirty}
        >
          {busy ? "Saving…" : `Save page (${items.length} photos)`}
        </button>
      </div>

      <ol className={styles.list}>
        {items.map((item, index) => {
          const linked = item.credit?.slug ? productionBySlug.get(item.credit.slug) : undefined;
          const rowClass = [
            styles.row,
            dragIndex === index ? styles.rowDragging : "",
            overIndex === index && dragIndex !== index ? styles.rowOver : "",
          ].join(" ");

          return (
            <li key={item.id}>
              {item.gapBefore && index > 0 ? <p className={styles.gapMarker}>Extra space here</p> : null}
              <div
                className={rowClass}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setOverIndex(index);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragIndex !== null) move(dragIndex, index);
                  setDragIndex(null);
                  setOverIndex(null);
                }}
              >
                <span className={styles.number} title="Drag to reorder">
                  {index + 1}
                </span>

                <img className={styles.thumb} src={item.smallSrc || item.src} alt="" loading="lazy" />

                <div className={styles.fields}>
                  <label className={`${styles.field} ${styles.fieldWide}`}>
                    Production
                    <select
                      className={styles.select}
                      value={item.credit?.slug ?? ""}
                      onChange={(event) => {
                        const production = productionBySlug.get(event.target.value);
                        update(item.id, {
                          credit: production
                            ? { slug: production.slug, title: production.title, venue: production.venue }
                            : null,
                        });
                      }}
                    >
                      <option value="">No caption</option>
                      {item.credit?.slug && !linked ? (
                        <option value={item.credit.slug}>{item.credit.title}</option>
                      ) : null}
                      {productions.map((production) => (
                        <option key={production.slug} value={production.slug}>
                          {production.title} — {production.venue} ({production.year})
                        </option>
                      ))}
                    </select>
                  </label>

                  {item.credit ? (
                    <>
                      <label className={styles.field}>
                        Caption title
                        <input
                          className={styles.input}
                          value={item.credit.title}
                          onChange={(event) =>
                            update(item.id, { credit: { ...item.credit!, title: event.target.value } })
                          }
                        />
                      </label>
                      <label className={styles.field}>
                        Caption venue
                        <input
                          className={styles.input}
                          value={item.credit.venue}
                          onChange={(event) =>
                            update(item.id, { credit: { ...item.credit!, venue: event.target.value } })
                          }
                        />
                      </label>
                    </>
                  ) : null}

                  <label className={styles.field}>
                    Size
                    <select
                      className={styles.select}
                      value={item.size}
                      onChange={(event) => update(item.id, { size: event.target.value as ShowcaseSize })}
                    >
                      {SHOWCASE_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {SHOWCASE_SIZE_LABELS[size]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={Boolean(item.gapBefore)}
                      disabled={index === 0}
                      onChange={(event) => update(item.id, { gapBefore: event.target.checked })}
                    />
                    Extra space above this photo
                  </label>

                  <label className={`${styles.field} ${styles.fieldWide}`}>
                    Description for screen readers and Google
                    <input
                      className={styles.input}
                      value={item.alt}
                      onChange={(event) => update(item.id, { alt: event.target.value })}
                    />
                  </label>

                  {index === 0 ? (
                    <p className={styles.firstNote}>The first photograph is always shown large at the top.</p>
                  ) : null}
                </div>

                <div className={styles.actions}>
                  <button type="button" className={styles.small} onClick={() => move(index, index - 1)} disabled={index === 0}>
                    ↑ Up
                  </button>
                  <button
                    type="button"
                    className={styles.small}
                    onClick={() => move(index, index + 1)}
                    disabled={index === items.length - 1}
                  >
                    ↓ Down
                  </button>
                  <button type="button" className={styles.small} onClick={() => setPicker({ mode: "replace", id: item.id })}>
                    Swap photo
                  </button>
                  <button
                    type="button"
                    className={styles.small}
                    onClick={() => remove(item.id)}
                    disabled={items.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <section className="backstage-section" id="commissions-images">
        <div className="backstage-section-heading">
          <h2>Commissions page</h2>
          <p>Images in the boxes</p>
        </div>

        <p className={styles.intro}>
          Pick the photograph for each box on the Commissions page. Boxes left on automatic keep choosing
          a photograph for themselves, as they do now.
        </p>

        <div className={styles.toolbar} style={{ position: "static" }}>
          <a className="backstage-button" href="/commissions" target="_blank" rel="noreferrer">
            View Commissions page
          </a>
          <span className={styles.toolbarSpacer} />
          <button
            type="button"
            className="backstage-button backstage-button-primary"
            onClick={() => save("commissions")}
            disabled={busy || !commissionsDirty}
          >
            {busy ? "Saving…" : "Save Commissions images"}
          </button>
        </div>

        <div className={styles.slots}>
          {COMMISSIONS_SLOTS.map((slot) => {
            const picked = chosen[slot.id];
            const shown = picked ?? data.commissions.automatic[slot.id];

            return (
              <div key={slot.id} className={styles.slot}>
                {shown ? (
                  <img className={styles.slotImage} src={shown.src} alt="" loading="lazy" />
                ) : (
                  <div className={styles.slotImage} />
                )}
                <span className={styles.slotLabel}>{slot.label}</span>
                <span className={styles.slotState}>{picked ? "Chosen by you" : "Automatic"}</span>
                <div className={styles.slotButtons}>
                  <button type="button" className={styles.small} onClick={() => setPicker({ mode: "slot", slot: slot.id })}>
                    Change
                  </button>
                  {picked ? (
                    <button
                      type="button"
                      className={styles.small}
                      onClick={() => {
                        setChosen((current) => {
                          const next = { ...current };
                          delete next[slot.id];
                          return next;
                        });
                        setCommissionsDirty(true);
                        setMessage("");
                      }}
                    >
                      Use automatic
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {picker ? (
        <ImagePicker
          productions={productions}
          onPick={handlePick}
          onClose={() => setPicker(null)}
          title={
            picker.mode === "slot"
              ? `Choose a photograph: ${COMMISSIONS_SLOTS.find((slot) => slot.id === picker.slot)?.label}`
              : picker.mode === "replace"
                ? "Swap this photograph"
                : "Add a photograph"
          }
        />
      ) : null}
    </div>
  );
}
