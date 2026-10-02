"use client";

/*
 * The photo library's immediate actions (upload, Vision AI, remove, edit
 * image), taken from the old SelectedWorkEditor. These still happen straight
 * away, as they always did; only order, descriptions and filenames wait for
 * "Save & publish" (see draft.ts).
 */

import { useCallback, useEffect, useRef, useState, type Dispatch } from "react";

import {
  analyseLibraryImage,
  applyLibraryImageEdit,
  deleteLibraryImage,
  EMPTY_DATA,
  isJpeg,
  loadLibrary,
  persistCategory,
  uploadFilesToCategory,
  type CategoryId,
  type EditResult,
  type FileUploadState,
  type SelectedWorkData,
  type SelectedWorkImage,
  type UploadedFile,
} from "./pipeline";
import {
  dropFieldDraft,
  removeFromDoc,
  renameInDoc,
  type DraftAction,
} from "./draft";
import { parseLibraryUrl } from "./pipeline";

export type UploadProgress = {
  category: CategoryId;
  files: Array<{ name: string; state: FileUploadState }>;
};

export type AnalysisProgress = { category: CategoryId; current: number; total: number };

type Selection = Record<CategoryId, Set<string>>;

function emptySelection(): Selection {
  return { production: new Set(), rehearsal: new Set(), campaign: new Set() };
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useSelectedWorkLibrary(options: {
  dispatch: Dispatch<DraftAction>;
  /** Asked before removing: is this photo used on the Production page or a Commissions box? */
  describeUse?: (category: CategoryId, filename: string) => string | null;
}) {
  const { dispatch, describeUse } = options;
  const [server, setServerState] = useState<SelectedWorkData>(EMPTY_DATA);
  const serverRef = useRef<SelectedWorkData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusyState] = useState<string | null>(null);
  const busyRef = useRef<string | null>(null);
  const [upload, setUpload] = useState<UploadProgress | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const [editing, setEditing] = useState<{ category: CategoryId; image: SelectedWorkImage } | null>(null);
  /** Photos uploaded during this visit, to label them "New". */
  const [recent, setRecent] = useState<Set<string>>(() => new Set());

  const setServer = useCallback((data: SelectedWorkData) => {
    serverRef.current = data;
    setServerState(data);
  }, []);

  function setBusy(label: string | null) {
    busyRef.current = label;
    setBusyState(label);
  }

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setServer(await loadLibrary());
    } catch (caught) {
      setLoadError(errorText(caught, "Selected Work could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [setServer]);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  /* ---------- Selection ---------- */

  function toggleSelected(category: CategoryId, filename: string) {
    setSelection((current) => {
      const next = { ...current, [category]: new Set(current[category]) };
      if (next[category].has(filename)) next[category].delete(filename);
      else next[category].add(filename);
      return next;
    });
  }

  function selectAll(category: CategoryId) {
    setSelection((current) => ({
      ...current,
      [category]: new Set(serverRef.current[category].map((image) => image.filename)),
    }));
  }

  function clearSelection(category: CategoryId) {
    setSelection((current) => ({ ...current, [category]: new Set<string>() }));
  }

  function forgetSelected(category: CategoryId, filenames: string[]) {
    setSelection((current) => {
      const next = new Set(current[category]);
      filenames.forEach((name) => next.delete(name));
      return { ...current, [category]: next };
    });
  }

  /* ---------- Vision AI ---------- */

  async function runAnalysis(category: CategoryId, filenames: string[]) {
    let done = 0;
    setAnalysis({ category, current: 0, total: filenames.length });
    const results: Array<{ filename: string; alt: string }> = [];

    try {
      for (const filename of filenames) {
        setAnalysis({ category, current: done + 1, total: filenames.length });
        const current = serverRef.current[category].find((image) => image.filename === filename);
        if (!current) throw new Error(`${filename} could not be found in the collection.`);

        const metadata = await analyseLibraryImage(category, current.filename);
        const analysedAt = new Date().toISOString();

        // Make each successful result durable straight away, as before. Only
        // this photograph changes; other unsaved edits stay as drafts.
        const updated = serverRef.current[category].map((image) =>
          image.filename === current.filename
            ? { ...image, alt: metadata.alt, suggestedFilename: metadata.filename, analysisStatus: "complete" as const, analysedAt }
            : image,
        );
        const saved = await persistCategory(category, updated, false);
        setServer(saved);
        dispatch({ type: "rebase", mutate: (doc) => dropFieldDraft(doc, category, current.filename) });
        results.push({ filename: current.filename, alt: metadata.alt });
        done += 1;
      }

      // Page photos from the library with no description yet pick up the AI one.
      if (results.length) {
        const byName = new Map(results.map((result) => [result.filename, result.alt]));
        dispatch({
          type: "rebase",
          mutate: (doc) => {
            let changed = false;
            const items = doc.items.map((item) => {
              const parsed = parseLibraryUrl(item.src);
              const alt = parsed && parsed.category === category ? byName.get(parsed.filename) : undefined;
              if (alt && !item.alt.trim()) {
                changed = true;
                return { ...item, alt };
              }
              return item;
            });
            return changed ? { ...doc, items } : doc;
          },
        });
      }

      return results;
    } finally {
      setAnalysis(null);
    }
  }

  async function analyse(category: CategoryId, filenames: string[]) {
    if (busyRef.current || filenames.length === 0) return [];
    setBusy("Describing with AI…");
    setError(null);
    setMessage(null);
    try {
      const results = await runAnalysis(category, filenames);
      setMessage(
        `${results.length} ${results.length === 1 ? "photograph" : "photographs"} described by Vision AI and saved. ` +
          "Suggested filenames are applied when you press Save & publish.",
      );
      return results;
    } catch (caught) {
      setError(errorText(caught, "Vision AI analysis failed."));
      return [];
    } finally {
      setBusy(null);
    }
  }

  function analyseNew(category: CategoryId) {
    const pending = serverRef.current[category].filter((image) => image.analysisStatus === "pending").map((image) => image.filename);
    if (!pending.length) {
      setMessage("No photographs here are waiting for a description.");
      setError(null);
      return Promise.resolve([]);
    }
    return analyse(category, pending);
  }

  /* ---------- Upload ---------- */

  async function uploadFiles(category: CategoryId, files: File[], { describe = true } = {}): Promise<UploadedFile[]> {
    if (busyRef.current || files.length === 0) return [];
    const notJpeg = files.filter((file) => !isJpeg(file));
    if (notJpeg.length) {
      setError(`Only JPEG photographs can be uploaded. Not added: ${notJpeg.map((file) => file.name).join(", ")}.`);
      return [];
    }

    setBusy("Uploading…");
    setError(null);
    setMessage(null);
    setUpload({ category, files: files.map((file) => ({ name: file.name, state: "waiting" })) });

    let uploaded: UploadedFile[] = [];
    try {
      uploaded = await uploadFilesToCategory(category, files, {
        onFileState: (index, state) =>
          setUpload((current) =>
            current
              ? { ...current, files: current.files.map((file, fileIndex) => (fileIndex === index ? { ...file, state } : file)) }
              : current,
          ),
        onCommitted: (data) => setServer(data),
      });
      setRecent((current) => new Set([...current, ...uploaded.map((file) => file.filename)]));
      setMessage(`${uploaded.length} ${uploaded.length === 1 ? "photograph" : "photographs"} uploaded.`);
    } catch (caught) {
      setError(errorText(caught, "The photographs could not be uploaded."));
      setBusy(null);
      return uploaded;
    }

    if (describe && uploaded.length) {
      setBusy("Describing with AI…");
      try {
        await runAnalysis(
          category,
          uploaded.map((file) => file.filename),
        );
        setMessage(
          `${uploaded.length} ${uploaded.length === 1 ? "photograph" : "photographs"} uploaded and described by Vision AI.`,
        );
      } catch (caught) {
        setError(`${errorText(caught, "Vision AI analysis failed.")} The upload itself worked; try "Describe with AI" again.`);
      }
    }

    setBusy(null);
    window.setTimeout(() => setUpload((current) => (current?.files.every((file) => file.state !== "uploading") ? null : current)), 6000);
    return uploaded;
  }

  /* ---------- Remove ---------- */

  async function remove(category: CategoryId, filenames: string[]) {
    if (busyRef.current || filenames.length === 0) return false;

    const uses = describeUse
      ? filenames.map((name) => describeUse(category, name)).filter((use): use is string => Boolean(use))
      : [];
    const what = filenames.length === 1 ? "this photograph" : `these ${filenames.length} photographs`;
    const confirmed = window.confirm(
      `Permanently remove ${what}? This happens straight away and cannot be undone.` +
        (uses.length ? `\n\n${uses.join("\n")}` : ""),
    );
    if (!confirmed) return false;

    setBusy("Removing…");
    setError(null);
    setMessage(null);
    let removed = 0;

    try {
      for (const filename of filenames) {
        const data = await deleteLibraryImage(category, filename);
        setServer(data);
        removed += 1;
        const used = describeUse?.(category, filename);
        dispatch({
          type: "rebase",
          mutate: (doc) => removeFromDoc(doc, category, filename),
          note: used ? "Removed a deleted photo from the page" : undefined,
        });
      }
      forgetSelected(category, filenames);
      setMessage(`${removed} ${removed === 1 ? "photograph" : "photographs"} removed.`);
      return true;
    } catch (caught) {
      forgetSelected(category, filenames.slice(0, removed));
      setError(
        filenames.length > 1
          ? `${errorText(caught, "Removal failed.")} Stopped after ${removed} of ${filenames.length}.`
          : errorText(caught, "The photograph could not be removed."),
      );
      return false;
    } finally {
      setBusy(null);
    }
  }

  /* ---------- Edit image ---------- */

  function openEditor(category: CategoryId, filename: string) {
    const image = serverRef.current[category].find((candidate) => candidate.filename === filename);
    if (image && !busyRef.current) setEditing({ category, image });
  }

  async function applyEdit(result: EditResult) {
    if (!editing || busyRef.current) return;
    const { category, image } = editing;
    setBusy("Saving the edited photo…");
    setError(null);
    setMessage(null);

    try {
      const { data, nextFilename } = await applyLibraryImageEdit(category, image, result);
      setServer(data);
      if (nextFilename !== image.filename) {
        setRecent((current) => (current.has(image.filename) ? new Set([...current, nextFilename]) : current));
        setSelection((current) => {
          if (!current[category].has(image.filename)) return current;
          const next = new Set(current[category]);
          next.delete(image.filename);
          next.add(nextFilename);
          return { ...current, [category]: next };
        });
        dispatch({
          type: "rebase",
          mutate: (doc) => renameInDoc(doc, category, image.filename, nextFilename),
          note: describeUse?.(category, image.filename) ? "Edited photo updated on the page" : undefined,
        });
      }
      setEditing(null);
      setMessage("Photo updated.");
      return nextFilename;
    } catch (caught) {
      setError(errorText(caught, "The Selected Work image could not be edited."));
    } finally {
      setBusy(null);
    }
  }

  return {
    server,
    serverRef,
    setServer,
    loading,
    loadError,
    reload,
    busy,
    upload,
    analysis,
    message,
    error,
    setMessage,
    setError,
    selection,
    toggleSelected,
    selectAll,
    clearSelection,
    recent,
    analyse,
    analyseNew,
    uploadFiles,
    remove,
    editing,
    openEditor,
    closeEditor: () => setEditing(null),
    applyEdit,
  };
}

export type LibraryApi = ReturnType<typeof useSelectedWorkLibrary>;
