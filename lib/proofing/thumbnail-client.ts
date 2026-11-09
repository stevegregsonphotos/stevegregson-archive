// Browser-side: makes the small gallery thumbnail for a proof.
// The proofing grid shows photos as small tiles, so it loads these
// (~60–120 KB) instead of the full proof (often 2–4 MB). Made in Steve's
// browser, never on Vercel.

/** The thumbnail's shorter side, in pixels (sharp on a Retina grid tile). */
const THUMB_SHORT_SIDE = 640;
const THUMB_QUALITY = 0.74;

function loadImage(blob: Blob) {
  const url = URL.createObjectURL(blob);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Couldn't read the photo."));
    image.src = url;
  }).finally(() => URL.revokeObjectURL(url));
}

/*
 * Safari can't make WebP pictures: asked for one, it quietly hands back a
 * PNG, which ignores the quality setting and is several times bigger and
 * far slower to make (uploads crawled, ~25 s per photo, and proofs were
 * shrunk to 1734px trying to get the PNG under the size limit). So where
 * the browser can't make WebP, use JPEG: fast, small, and every browser
 * shows it. The stored file keeps its .webp name and label; browsers look
 * at the picture itself, and downloads already pass JPEGs straight through.
 */
let encodeTypePromise: Promise<string> | null = null;

export function proofEncodeType(): Promise<string> {
  encodeTypePromise ??= new Promise<string>((resolve) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 2;
      canvas.toBlob(
        (blob) => resolve(blob?.type === "image/webp" ? "image/webp" : "image/jpeg"),
        "image/webp",
        0.8,
      );
    } catch {
      resolve("image/jpeg");
    }
  });
  return encodeTypePromise;
}

async function toBlob(canvas: HTMLCanvasElement) {
  const type = await proofEncodeType();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't make the thumbnail."))),
      type,
      THUMB_QUALITY,
    );
  });
}

export async function makeProofThumbnail(source: Blob): Promise<Blob> {
  const image = await loadImage(source);
  const { naturalWidth: w, naturalHeight: h } = image;
  const scale = Math.min(1, THUMB_SHORT_SIDE / Math.min(w, h));
  const targetW = Math.max(1, Math.round(w * scale));
  const targetH = Math.max(1, Math.round(h * scale));

  // Halve in steps so the small version stays sharp rather than jagged.
  let current: CanvasImageSource = image;
  let cw = w;
  let ch = h;
  while (cw / 2 >= targetW && ch / 2 >= targetH) {
    const step = document.createElement("canvas");
    step.width = Math.round(cw / 2);
    step.height = Math.round(ch / 2);
    const ctx = step.getContext("2d");
    if (!ctx) break;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(current, 0, 0, step.width, step.height);
    current = step;
    cw = step.width;
    ch = step.height;
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Couldn't make the thumbnail.");
  context.imageSmoothingQuality = "high";
  context.drawImage(current, 0, 0, targetW, targetH);
  return toBlob(canvas);
}

export async function uploadProofThumbnail(uploadUrl: string, thumbnail: Blob) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/webp" },
    body: thumbnail,
  });
  if (!response.ok) throw new Error("Thumbnail upload failed (HTTP " + response.status + ").");
}
