"use client";

/*
 * Backstage -> Productions -> Edit. Two tabs (Details & credits,
 * Photographs) and one Save & publish bar, in the same design as the
 * Selected Work screen. Everything is saved together through the existing
 * /api/admin/edit-production request (plus the new galleryLayout field).
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import ImageEditor from "../../../../components/admin/image-editor/ImageEditor";
import { prepareImageForUpload } from "../../../../lib/client-image-editor";
import { getProductionImageUrl } from "../../../../lib/production-image-url";

import DetailsTab from "./DetailsTab";
import {
  docFromProduction,
  editorReducer,
  INITIAL_EDITOR_STATE,
  needsDescription,
  same,
  type Doc,
  type Production,
  type ProductionImage,
} from "./editor-state";
import PhotosTab, { HERO_TILE, type UploadProgress } from "./PhotosTab";

import sw from "../../selected-work/backstage-selected-work.module.css";
import styles from "./production-edit.module.css";

type LoadResult = { ok: boolean; message?: string; production?: Production };
type SaveResult = {
  ok: boolean;
  message?: string;
  production?: Production;
  directoryWarning?: string | null;
  galleryLayoutWarning?: string;
};
type PresignResult = {
  ok?: boolean;
  message?: string;
  filename?: string;
  uploadUrl?: string;
  cardUploadUrl?: string;
};

type TabId = "details" | "photos";
type Notice = { type: "success" | "error"; text: string } | null;

function webpFilename(filename: string) {
  const stem = filename.replace(/\.[^.]+$/, "").trim() || "production-image";
  return `${stem}.webp`;
}

/** Lightweight WebP copy used by the public gallery grid (the full image stays for fullscreen). */
async function createProductionCardBlob(source: Blob) {
  const bitmap = await createImageBitmap(source);
  try {
    const maximumWidth = 1000;
    const scale = Math.min(1, maximumWidth / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare production gallery derivative.");
    context.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not create production gallery derivative."));
            return;
          }
          resolve(blob);
        },
        "image/webp",
        0.75,
      );
    });
  } finally {
    bitmap.close();
  }
}

async function putImageToR2(uploadUrl: string, blob: Blob) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/webp" },
    body: blob,
  });
  if (!response.ok) throw new Error(`Direct R2 upload failed (HTTP ${response.status}).`);
}

export default function EditProductionPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;

  const [state, dispatch] = useReducer(editorReducer, INITIAL_EDITOR_STATE);
  const { doc, saved } = state;
  const [production, setProduction] = useState<Production | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("details");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [active, setActive] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [recent, setRecent] = useState<Set<string>>(() => new Set());
  const [editingImage, setEditingImage] = useState<ProductionImage | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>(null);
  const docRef = useRef<Doc | null>(doc);

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  /* ---------- Load ---------- */

  useEffect(() => {
    let cancelled = false;
    async function loadProduction() {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch(`/api/admin/edit-production?slug=${encodeURIComponent(slug)}`);
        const data = (await response.json()) as LoadResult;
        if (!response.ok || !data.ok || !data.production) {
          throw new Error(data.message ?? "The production could not be loaded.");
        }
        if (cancelled) return;
        setProduction(data.production);
        dispatch({ type: "load", doc: docFromProduction(data.production) });
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "The production could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadProduction();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const fromHash = window.location.hash.replace("#", "");
      if (fromHash === "photos" || fromHash === "details") setTab(fromHash);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function chooseTab(next: TabId) {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
  }

  /* ---------- What needs saving ---------- */

  const anyDirty = Boolean(doc && saved && !same(doc, saved));
  const dirtyAreas = doc && saved
    ? [
        !same(
          { ...doc, credits: null, images: null, hero: null, galleryLayout: null },
          { ...saved, credits: null, images: null, hero: null, galleryLayout: null },
        ),
        !same(doc.credits, saved.credits),
        doc.hero !== saved.hero,
        !same(doc.images, saved.images),
        doc.galleryLayout !== saved.galleryLayout,
      ].filter(Boolean).length
    : 0;
  const changeCount = anyDirty ? Math.max(state.history.length, dirtyAreas) : 0;
  const summary = Array.from(new Set(state.history.map((entry) => entry.label)))
    .slice(-4)
    .join(" · ");

  /* ---------- Warn before leaving ---------- */

  useEffect(() => {
    if (!anyDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    // Links inside Backstage navigate without reloading, so ask for those too.
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || event.defaultPrevented || event.metaKey || event.ctrlKey) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (!window.confirm("You have unsaved changes to this production. Leave without saving them?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", onClick, true);
    };
  }, [anyDirty]);

  /* ---------- Changes ---------- */

  const change = useCallback((label: string, key: string | undefined, mutate: (current: Doc) => Doc) => {
    setSavedMessage(null);
    setSaveError(null);
    dispatch({ type: "change", label, key, mutate });
  }, []);

  /* ---------- Uploads and image edits (files go to R2 straight away) ---------- */

  async function requestUpload(filename: string) {
    if (!production) throw new Error("The production is not loaded.");
    const response = await fetch("/api/admin/edit-production", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "presign", slug: production.slug, originalFilename: filename }),
    });
    const result = (await response.json()) as PresignResult;
    if (!response.ok || !result.ok || !result.filename || !result.uploadUrl) {
      throw new Error(result.message ?? "The image upload could not be prepared.");
    }
    return { filename: result.filename, uploadUrl: result.uploadUrl, cardUploadUrl: result.cardUploadUrl };
  }

  async function uploadNewImages(files: File[]) {
    if (!production || !files.length || isUploadingImage) return;
    const selected = files.filter((file) => file.type.startsWith("image/"));
    if (!selected.length) {
      setNotice({ type: "error", text: "Choose one or more image files." });
      return;
    }
    setIsUploadingImage(true);
    setUploadProgress({ completed: 0, total: selected.length });
    setNotice(null);
    const added: ProductionImage[] = [];
    try {
      const concurrency = 3;
      for (let start = 0; start < selected.length; start += concurrency) {
        const batch = selected.slice(start, start + concurrency);
        const batchResults = await Promise.all(
          batch.map(async (file) => {
            const prepared = await prepareImageForUpload(file);
            const signed = await requestUpload(webpFilename(file.name));
            await putImageToR2(signed.uploadUrl, prepared.blob);
            if (!signed.cardUploadUrl) {
              throw new Error("The production gallery derivative upload was not prepared.");
            }
            const cardBlob = await createProductionCardBlob(prepared.blob);
            await putImageToR2(signed.cardUploadUrl, cardBlob);
            return {
              src: signed.filename,
              alt: `${production.title} production photograph`,
              layout: "wide" as const,
              originalSrc: signed.filename,
              editAspect: "original" as const,
              editZoom: 1,
              editPanX: 0,
              editPanY: 0,
              editBrightness: 100,
            };
          }),
        );
        added.push(...batchResults);
        setUploadProgress({ completed: Math.min(added.length, selected.length), total: selected.length });
      }
      setNotice({
        type: "success",
        text: `${added.length} photograph${added.length === 1 ? "" : "s"} added. Press Save & publish to put ${added.length === 1 ? "it" : "them"} in the gallery.`,
      });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "The images could not be uploaded." });
    } finally {
      // Keep whatever did upload, even if a later file failed.
      if (added.length) {
        change(added.length === 1 ? "1 photo added" : `${added.length} photos added`, undefined, (current) => ({
          ...current,
          images: [...current.images, ...added],
        }));
        setRecent((current) => new Set([...current, ...added.map((image) => image.src)]));
        setActive(added[0].src);
      }
      setIsUploadingImage(false);
      setUploadProgress(null);
    }
  }

  async function applyImageEdit(result: {
    blob: Blob;
    width: number;
    height: number;
    filename: string;
    settings: {
      aspect: "original" | "3:2" | "4:5" | "1:1" | "16:9";
      zoom: number;
      panX: number;
      panY: number;
      brightness: number;
      autoStrength: number;
    };
  }) {
    if (!production || !editingImage || isUploadingImage) return;
    setIsUploadingImage(true);
    setNotice(null);
    try {
      const signed = await requestUpload(result.filename);
      await putImageToR2(signed.uploadUrl, result.blob);
      if (!signed.cardUploadUrl) {
        throw new Error("The production gallery derivative upload was not prepared.");
      }
      const cardBlob = await createProductionCardBlob(result.blob);
      await putImageToR2(signed.cardUploadUrl, cardBlob);
      const oldSrc = editingImage.src;
      const originalSrc = editingImage.originalSrc ?? editingImage.src;
      change("Photo edited", undefined, (current) => ({
        ...current,
        // The hero choice follows the photo to its new filename.
        hero: current.hero === oldSrc ? signed.filename : current.hero,
        images: current.images.map((image) =>
          image.src === oldSrc
            ? {
                ...image,
                src: signed.filename,
                originalSrc,
                editAspect: result.settings.aspect,
                editZoom: result.settings.zoom,
                editPanX: result.settings.panX,
                editPanY: result.settings.panY,
                editBrightness: result.settings.brightness,
                editAutoStrength: result.settings.autoStrength,
                suggestedFilename: undefined,
              }
            : image,
        ),
      }));
      setSelection((current) => {
        if (!current.has(oldSrc)) return current;
        const next = new Set(current);
        next.delete(oldSrc);
        next.add(signed.filename);
        return next;
      });
      setActive(signed.filename);
      setEditingImage(null);
      setNotice({ type: "success", text: "Image edit applied. Press Save & publish to put it on the site." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "The edited image could not be uploaded." });
    } finally {
      setIsUploadingImage(false);
    }
  }

  /* ---------- Save & publish ---------- */

  async function saveChanges() {
    const current = docRef.current;
    if (!production || !current || !anyDirty || saving) return;
    const parsedMonth = current.month === "" ? null : Number.parseInt(current.month, 10);
    const parsedYear = Number.parseInt(current.year, 10);

    const problem = !current.title.trim()
      ? "A production title is required."
      : !current.venue.trim()
        ? "A venue is required."
        : parsedMonth !== null && (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12)
          ? "Select a valid production month."
          : !Number.isInteger(parsedYear)
            ? "A valid production year is required."
            : null;
    if (problem) {
      setSaveError(problem);
      setTab("details");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSavedMessage(null);
    try {
      const response = await fetch("/api/admin/edit-production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: production.slug,
          newSlug: current.slug.trim(),
          hero: current.hero,
          title: current.title.trim(),
          venue: current.venue.trim(),
          month: parsedMonth,
          year: parsedYear,
          description: current.description.trim(),
          access: current.access,
          showHeroWhenLocked: current.showHeroWhenLocked,
          accessPassword: current.access === "password" ? current.accessPassword.trim() : "",
          credits: current.credits,
          images: current.images,
          galleryLayout: current.galleryLayout,
        }),
      });
      const data = (await response.json()) as SaveResult;
      if (!response.ok || !data.ok || !data.production) {
        throw new Error(data.message ?? "The production could not be updated.");
      }
      setProduction(data.production);
      dispatch({ type: "load", doc: docFromProduction(data.production) });
      setRecent(new Set());
      setSelection(new Set());
      setActive((previous) =>
        previous === HERO_TILE || data.production!.images.some((image) => image.src === previous) ? previous : null,
      );
      if (data.production.slug !== slug) {
        router.replace(`/admin/edit-production/${encodeURIComponent(data.production.slug)}${window.location.hash}`);
      }
      const warnings = [data.directoryWarning, data.galleryLayoutWarning].filter(Boolean).join(" ");
      setSavedMessage(`Saved and published. The production page has been updated.${warnings ? ` ${warnings}` : ""}`);
      setNotice(null);
    } catch (error) {
      setSaveError(
        `${error instanceof Error ? error.message : "The production could not be updated."} Your changes are still here; try again.`,
      );
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Tab badges ---------- */

  const detailsMissing = useMemo(() => {
    if (!doc) return [];
    return [
      !doc.title.trim() ? "Title" : "",
      !doc.venue.trim() ? "Venue" : "",
      doc.month === "" ? "Month" : "",
      !Number.isInteger(Number.parseInt(doc.year, 10)) ? "Year" : "",
    ].filter(Boolean);
  }, [doc]);

  /* ---------- Render ---------- */

  if (loading || !doc || !saved || !production) {
    return (
      <main className="backstage-page" style={{ paddingTop: "4rem" }}>
        <div className="backstage-shell">
          <div className={sw.screen}>
            {loadError ? (
              <p className={sw.errorText} role="alert">
                {loadError}
              </p>
            ) : loading ? (
              <p className={sw.intro}>Loading production…</p>
            ) : (
              <p className={sw.intro}>Production not found.</p>
            )}
          </div>
        </div>
      </main>
    );
  }

  const described = doc.images.filter((image) => !needsDescription(image)).length;

  return (
    <main className="backstage-page" style={{ paddingTop: "4rem" }}>
      <div className="backstage-shell">
        <div className={sw.screen} aria-busy={saving}>
          <header className={sw.head}>
            <div>
              <p className={sw.eyebrow}>PRODUCTIONS › EDIT</p>
              <h1 className={sw.title}>{production.title}</h1>
              <p className={styles.subline}>
                {production.venue} · {production.year}
              </p>
            </div>
            <div className={styles.headRight}>
              <a className={styles.backLink} href="/archive">
                ← Back to archive
              </a>
              <a className={sw.liveLink} href={`/productions/${production.slug}`} target="_blank" rel="noreferrer">
                View production ↗
              </a>
            </div>
          </header>

          <div className={sw.tabs} role="tablist" aria-label="Production editor sections">
            <button
              type="button"
              role="tab"
              id="tab-details"
              aria-selected={tab === "details"}
              aria-controls="production-edit-section"
              className={tab === "details" ? `${sw.tab} ${sw.tabActive}` : sw.tab}
              onClick={() => chooseTab("details")}
            >
              <span className={sw.tabNum}>01</span>
              <span className={sw.tabName}>Details &amp; credits</span>
              <span className={styles.tabMeta}>
                {doc.credits.length} {doc.credits.length === 1 ? "credit" : "credits"}
              </span>
              {detailsMissing.length ? (
                <span className={styles.tabWarn}>{detailsMissing.join(", ")} missing</span>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              id="tab-photos"
              aria-selected={tab === "photos"}
              aria-controls="production-edit-section"
              className={tab === "photos" ? `${sw.tab} ${sw.tabActive}` : sw.tab}
              onClick={() => chooseTab("photos")}
            >
              <span className={sw.tabNum}>02</span>
              <span className={sw.tabName}>Photographs</span>
              <span className={sw.tabCount}>{doc.images.length}</span>
              <span className={described < doc.images.length ? styles.tabWarn : styles.tabMeta}>
                {described} of {doc.images.length} described
              </span>
            </button>
          </div>

          {notice ? (
            <p className={notice.type === "error" ? `${styles.notice} ${styles.noticeError}` : styles.notice} role="status">
              {notice.text}
            </p>
          ) : null}

          <section id="production-edit-section" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {tab === "details" ? (
              <DetailsTab
                doc={doc}
                savedSlug={production.slug}
                publishedHero={saved.hero}
                publishedAccess={production.access ?? "public"}
                heroChanged={doc.hero !== saved.hero}
                hasUnsavedChanges={anyDirty}
                change={change}
                onChooseHero={() => {
                  chooseTab("photos");
                  setActive(HERO_TILE);
                }}
              />
            ) : (
              <PhotosTab
                slug={production.slug}
                doc={doc}
                publishedHero={saved.hero}
                publishedHeroAlt={production.heroAlt}
                publishedGalleryLayout={saved.galleryLayout}
                change={change}
                active={active}
                setActive={setActive}
                selection={new Set(Array.from(selection).filter((src) => doc.images.some((image) => image.src === src)))}
                setSelection={setSelection}
                recent={recent}
                uploadProgress={uploadProgress}
                busy={isUploadingImage || saving}
                onUpload={(files) => void uploadNewImages(files)}
                onEditImage={(image) => {
                  setEditingImage(image);
                  setNotice(null);
                }}
              />
            )}
          </section>

          <div className={anyDirty ? `${sw.saveBar} ${sw.saveBarDirty}` : sw.saveBar} data-testid="save-bar">
            <span className={anyDirty ? `${sw.dot} ${sw.dotDirty}` : sw.dot} aria-hidden="true" />
            <span className={sw.saveCount} role="status">
              {saving
                ? "Saving…"
                : anyDirty
                  ? `${changeCount} unsaved ${changeCount === 1 ? "change" : "changes"}`
                  : "All changes saved"}
            </span>
            {saveError ? (
              <span className={sw.saveError} role="alert">
                {saveError}
              </span>
            ) : (
              <span className={sw.saveSummary} title={anyDirty ? summary : undefined}>
                {anyDirty
                  ? summary
                  : savedMessage ??
                    "Edits on either tab are saved together with one button. Uploads and crops are stored straight away; deleting the production happens immediately."}
              </span>
            )}
            <span className={sw.spacer} />
            {anyDirty ? (
              <button
                type="button"
                className={sw.btn}
                disabled={saving || state.history.length === 0}
                onClick={() => {
                  setSaveError(null);
                  dispatch({ type: "undo" });
                }}
                data-testid="undo"
              >
                Undo
              </button>
            ) : null}
            <button
              type="button"
              className={sw.btnPrimary}
              disabled={!anyDirty || saving || isUploadingImage}
              onClick={() => void saveChanges()}
              data-testid="save"
            >
              {saving ? "Saving…" : "Save & publish"}
            </button>
          </div>
        </div>
      </div>

      {editingImage ? (
        <ImageEditor
          source={`${getProductionImageUrl(production.slug, editingImage.originalSrc ?? editingImage.src)}?editor=1`}
          filename={editingImage.originalSrc ?? editingImage.src}
          initialSettings={{
            aspect: editingImage.editAspect ?? "original",
            zoom: editingImage.editZoom ?? 1,
            panX: editingImage.editPanX ?? 0,
            panY: editingImage.editPanY ?? 0,
            brightness: editingImage.editBrightness ?? 100,
            autoStrength: editingImage.editAutoStrength ?? 0,
          }}
          onCancel={() => setEditingImage(null)}
          onApply={applyImageEdit}
        />
      ) : null}
    </main>
  );
}
