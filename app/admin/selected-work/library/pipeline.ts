/*
 * The Selected Work photo library pipeline, moved out of the old
 * SelectedWorkEditor so the new Backstage screen can reuse it unchanged:
 * WebP derivative generation, presign -> direct R2 upload -> commit-batch,
 * presign-edit -> commit-edit, Vision AI analysis, category saves (with
 * rename-on-save) and removal. Every request body is exactly what the old
 * editor sent, so /api/admin/selected-work behaves as before.
 */

import type { ImageEditorSettings } from "@/lib/client-image-editor";
import {
  getSelectedWorkDisplayUrl,
  getSelectedWorkImageUrl,
  getSelectedWorkPreviewUrl,
} from "@/lib/selected-work-image-url";

export const LIBRARY_API = "/api/admin/selected-work";
export const VISION_API = "/api/admin/vision/analyse-image";

export type CategoryId = "production" | "rehearsal" | "campaign";
export const CATEGORY_IDS: CategoryId[] = ["production", "rehearsal", "campaign"];

export type AnalysisStatus = "pending" | "complete";

export type SelectedWorkImage = {
  filename: string;
  suggestedFilename?: string;
  alt: string;
  uploadedAt: string;
  width?: number;
  height?: number;
  analysisStatus: AnalysisStatus;
  analysedAt?: string;
  originalFilename?: string;
  editAspect?: "original" | "3:2" | "4:5" | "1:1" | "16:9";
  editZoom?: number;
  editPanX?: number;
  editPanY?: number;
  editBrightness?: number;
  editAutoStrength?: number;
};

export type SelectedWorkData = Record<CategoryId, SelectedWorkImage[]>;

type ApiResponse = {
  ok: boolean;
  data?: SelectedWorkData;
  message?: string;
};

type VisionResponse = {
  ok: boolean;
  image?: string;
  metadata?: { alt: string; filename: string; layout: string };
  message?: string;
};

type SignedUpload = {
  ok?: boolean;
  message?: string;
  filename?: string;
  storageKey?: string;
  uploadUrl?: string;
  previewStorageKey?: string;
  previewUploadUrl?: string;
  displayStorageKey?: string;
  displayUploadUrl?: string;
};

export const EMPTY_DATA: SelectedWorkData = {
  production: [],
  rehearsal: [],
  campaign: [],
};

/** Plain-English names used in Backstage. */
export const CATEGORY_NAMES: Record<CategoryId, string> = {
  production: "Photo library (Production page uploads)",
  rehearsal: "Rehearsals",
  campaign: "Marketing & PR",
};

/** Same batch size as the old editor: four files prepared at once, then committed. */
export const UPLOAD_CONCURRENCY = 4;

/* ---------- Normalising ---------- */

export function normaliseIncomingImages(images: SelectedWorkImage[]): SelectedWorkImage[] {
  return images.map((image) => ({
    ...image,
    suggestedFilename: image.suggestedFilename ?? "",
    analysisStatus: image.analysisStatus ?? (image.alt.trim() ? "complete" : "pending"),
    editAspect: image.editAspect ?? "original",
    editZoom: image.editZoom ?? 1,
    editPanX: image.editPanX ?? 0,
    editPanY: image.editPanY ?? 0,
    editBrightness: image.editBrightness ?? 100,
    editAutoStrength: image.editAutoStrength ?? 0,
  }));
}

export function normaliseIncomingData(data: SelectedWorkData): SelectedWorkData {
  return {
    production: normaliseIncomingImages(data.production ?? []),
    rehearsal: normaliseIncomingImages(data.rehearsal ?? []),
    campaign: normaliseIncomingImages(data.campaign ?? []),
  };
}

/* ---------- Image URLs ---------- */

export function libraryFullUrl(category: CategoryId, filename: string) {
  return getSelectedWorkImageUrl(category, filename);
}

export function libraryPreviewUrl(category: CategoryId, filename: string) {
  return getSelectedWorkPreviewUrl(category, filename);
}

export function libraryDisplayUrl(category: CategoryId, filename: string) {
  return getSelectedWorkDisplayUrl(category, filename);
}

/** The three public URLs one library photograph can be referred to by. */
export function libraryUrls(category: CategoryId, filename: string) {
  return [
    libraryFullUrl(category, filename),
    libraryDisplayUrl(category, filename),
    libraryPreviewUrl(category, filename),
  ];
}

/** If a URL points at a library photograph, which one. */
export function parseLibraryUrl(src: string): { category: CategoryId; filename: string } | null {
  const match = src.match(
    /\/selected-work\/(production|rehearsal|campaign)\/(?:__previews\/|__display\/)?([^/?#]+)(?:[?#].*)?$/,
  );
  if (!match) return null;
  try {
    return { category: match[1] as CategoryId, filename: decodeURIComponent(match[2]) };
  } catch {
    return null;
  }
}

/** Rewrite a URL after a library photograph was renamed, keeping its size variant. */
export function renameLibraryUrl(src: string, category: CategoryId, from: string, to: string) {
  const parsed = parseLibraryUrl(src);
  if (!parsed || parsed.category !== category || parsed.filename !== from) return src;
  return src.replace(/[^/?#]+((?:[?#].*)?)$/, (_match, rest: string) => `${encodeURIComponent(to)}${rest}`);
}

/* ---------- Derivatives (unchanged from the old editor) ---------- */

async function createSelectedWorkDerivativeBlob(source: Blob, maximumWidth: number, quality: number) {
  const bitmap = await createImageBitmap(source);

  try {
    const scale = Math.min(1, maximumWidth / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not prepare the Selected Work preview.");
    }

    context.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Could not create the Selected Work preview."));
        },
        "image/webp",
        quality,
      );
    });
  } finally {
    bitmap.close();
  }
}

export function createSelectedWorkPreviewBlob(source: Blob) {
  return createSelectedWorkDerivativeBlob(source, 1000, 0.75);
}

export function createSelectedWorkDisplayBlob(source: Blob) {
  return createSelectedWorkDerivativeBlob(source, 1800, 0.8);
}

/** The main upload image: JPEG -> WebP, at most 2400px wide, quality 0.82. */
async function createMainWebp(file: File) {
  const bitmap = await createImageBitmap(file);
  const maximumWidth = 2400;
  const scale = Math.min(1, maximumWidth / bitmap.width);
  const outputWidth = Math.max(1, Math.round(bitmap.width * scale));
  const outputHeight = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error(`Could not prepare ${file.name} for WebP upload.`);
  }

  context.drawImage(bitmap, 0, 0, outputWidth, outputHeight);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error(`Could not convert ${file.name} to WebP.`));
      },
      "image/webp",
      0.82,
    );
  });

  return { blob, width: outputWidth, height: outputHeight };
}

function isCompleteSignature(signed: SignedUpload): signed is Required<Omit<SignedUpload, "message">> & SignedUpload {
  return Boolean(
    signed.ok &&
      signed.filename &&
      signed.storageKey &&
      signed.uploadUrl &&
      signed.previewStorageKey &&
      signed.previewUploadUrl &&
      signed.displayStorageKey &&
      signed.displayUploadUrl,
  );
}

async function putToR2(url: string, body: Blob, failure: string, cacheHeader = true) {
  const response = await fetch(url, {
    method: "PUT",
    headers: cacheHeader
      ? { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" }
      : { "Content-Type": "image/webp" },
    body,
  });
  if (!response.ok) {
    throw new Error(`${failure} (HTTP ${response.status}).`);
  }
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/* ---------- Upload ---------- */

export function isJpeg(file: File) {
  return file.type === "image/jpeg" && /\.(?:jpe?g)$/i.test(file.name);
}

export type UploadedFile = {
  sourceName: string;
  filename: string;
  width: number;
  height: number;
};

export type FileUploadState = "waiting" | "uploading" | "done" | "failed";

/**
 * Uploads JPEGs exactly as the old editor did: four at a time, each one
 * converted to WebP, presigned, PUT to R2 with its preview and display
 * copies, then the batch committed. Calls back after every commit with the
 * full library returned by the server.
 */
export async function uploadFilesToCategory(
  category: CategoryId,
  files: File[],
  callbacks: {
    onFileState: (index: number, state: FileUploadState) => void;
    onCommitted: (data: SelectedWorkData, uploadedSoFar: number) => void;
  },
): Promise<UploadedFile[]> {
  const total = files.length;
  let uploadedCount = 0;
  const uploaded: UploadedFile[] = [];

  for (let index = 0; index < files.length; index += UPLOAD_CONCURRENCY) {
    const batch = files.slice(index, index + UPLOAD_CONCURRENCY);

    const uploads = await Promise.all(
      batch.map(async (file, batchIndex) => {
        const fileIndex = index + batchIndex;
        callbacks.onFileState(fileIndex, "uploading");

        try {
          if (!isJpeg(file)) {
            throw new Error(`${file.name} is not a JPEG photograph.`);
          }

          const main = await createMainWebp(file);

          const signingResponse = await fetch(LIBRARY_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "presign", category, originalFilename: file.name }),
          });
          const signed = (await readJson<SignedUpload>(signingResponse)) ?? {};

          if (!signingResponse.ok || !isCompleteSignature(signed)) {
            throw new Error(signed.message || `Could not prepare ${file.name} for R2 upload.`);
          }

          await putToR2(signed.uploadUrl, main.blob, `Direct R2 upload failed for ${file.name}`);
          const previewBlob = await createSelectedWorkPreviewBlob(main.blob);
          await putToR2(signed.previewUploadUrl, previewBlob, `Direct R2 preview upload failed for ${file.name}`);
          const displayBlob = await createSelectedWorkDisplayBlob(main.blob);
          await putToR2(signed.displayUploadUrl, displayBlob, `Direct R2 display upload failed for ${file.name}`);

          return {
            filename: signed.filename,
            storageKey: signed.storageKey,
            width: main.width,
            height: main.height,
            uploadedAt: new Date().toISOString(),
            sourceName: file.name,
          };
        } catch (error) {
          callbacks.onFileState(fileIndex, "failed");
          throw error;
        }
      }),
    );

    const commitResponse = await fetch(LIBRARY_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "commit-batch",
        category,
        uploads: uploads.map((upload) => ({
          filename: upload.filename,
          storageKey: upload.storageKey,
          width: upload.width,
          height: upload.height,
          uploadedAt: upload.uploadedAt,
        })),
      }),
    });
    const result = await readJson<ApiResponse>(commitResponse);

    if (!commitResponse.ok || !result?.ok || !result.data) {
      batch.forEach((_, batchIndex) => callbacks.onFileState(index + batchIndex, "failed"));
      throw new Error(
        result?.message ?? `The upload stopped after ${uploadedCount} of ${total} photographs.`,
      );
    }

    uploadedCount += batch.length;
    batch.forEach((_, batchIndex) => callbacks.onFileState(index + batchIndex, "done"));
    uploads.forEach((upload) =>
      uploaded.push({
        sourceName: upload.sourceName,
        filename: upload.filename,
        width: upload.width,
        height: upload.height,
      }),
    );
    callbacks.onCommitted(normaliseIncomingData(result.data), uploadedCount);
  }

  return uploaded;
}

/* ---------- Category save (PUT) ---------- */

export async function persistCategory(
  category: CategoryId,
  images: SelectedWorkImage[],
  applyFilenameChanges = true,
) {
  const response = await fetch(LIBRARY_API, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, images, applyFilenameChanges }),
  });
  const result = await readJson<ApiResponse>(response);

  if (!response.ok || !result?.ok || !result.data) {
    throw new Error(result?.message ?? "The collection could not be saved.");
  }

  return normaliseIncomingData(result.data);
}

/* ---------- Vision AI ---------- */

export async function analyseLibraryImage(category: CategoryId, filename: string) {
  const response = await fetch(VISION_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selectedWorkCategory: category, image: filename }),
  });
  const result = await readJson<VisionResponse>(response);

  if (!response.ok || !result?.ok || !result.metadata) {
    throw new Error(result?.message ?? `Vision AI could not analyse ${filename}.`);
  }

  return result.metadata;
}

/* ---------- Remove ---------- */

export async function deleteLibraryImage(category: CategoryId, filename: string) {
  const response = await fetch(LIBRARY_API, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, filename }),
  });
  const result = await readJson<ApiResponse>(response);

  if (!response.ok || !result?.ok || !result.data) {
    throw new Error(result?.message ?? "The photograph could not be removed.");
  }

  return normaliseIncomingData(result.data);
}

/* ---------- Edit image ---------- */

export type EditResult = {
  blob: Blob;
  width: number;
  height: number;
  filename: string;
  settings: ImageEditorSettings;
};

/** presign-edit -> R2 (main, preview, display) -> commit-edit, as before. */
export async function applyLibraryImageEdit(
  category: CategoryId,
  image: SelectedWorkImage,
  result: EditResult,
) {
  const signingResponse = await fetch(LIBRARY_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "presign-edit", category, currentFilename: image.filename }),
  });
  const signed = (await readJson<SignedUpload>(signingResponse)) ?? {};

  if (!signingResponse.ok || !isCompleteSignature(signed)) {
    throw new Error(signed.message ?? "The edited image upload could not be prepared.");
  }

  await putToR2(signed.uploadUrl, result.blob, "Direct R2 upload failed", false);
  const previewBlob = await createSelectedWorkPreviewBlob(result.blob);
  await putToR2(signed.previewUploadUrl, previewBlob, "Direct R2 preview upload failed");
  const displayBlob = await createSelectedWorkDisplayBlob(result.blob);
  await putToR2(signed.displayUploadUrl, displayBlob, "Direct R2 display upload failed");

  const commitResponse = await fetch(LIBRARY_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "commit-edit",
      category,
      currentFilename: image.filename,
      nextFilename: signed.filename,
      width: result.width,
      height: result.height,
      settings: result.settings,
    }),
  });
  const committed = await readJson<ApiResponse>(commitResponse);

  if (!commitResponse.ok || !committed?.ok || !committed.data) {
    throw new Error(committed?.message ?? "The edited Selected Work image could not be saved.");
  }

  return { data: normaliseIncomingData(committed.data), nextFilename: signed.filename };
}

/* ---------- Load ---------- */

export async function loadLibrary() {
  const response = await fetch(LIBRARY_API, { cache: "no-store" });
  const result = await readJson<ApiResponse>(response);

  if (!response.ok || !result?.ok || !result.data) {
    throw new Error(result?.message ?? "Selected Work could not be loaded.");
  }

  return normaliseIncomingData(result.data);
}
