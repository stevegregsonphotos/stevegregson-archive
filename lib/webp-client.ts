// Browser-side WebP for every site photo, in every browser.
//
// Chrome, Edge and Firefox can make WebP themselves (canvas.toBlob). Safari
// can't: it silently hands back a much bigger PNG instead. So when the
// browser can't, we use a small free WebP encoder that runs inside the page
// (WebAssembly, @jsquash/webp; engine files in /public/wasm). Still runs on
// Steve's Mac, never on Vercel.

let nativeWebpPromise: Promise<boolean> | null = null;

/** Whether this browser's canvas can make real WebP files. */
export function browserCanMakeWebP(): Promise<boolean> {
  nativeWebpPromise ??= new Promise<boolean>((resolve) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 2;
      canvas.toBlob((blob) => resolve(blob?.type === "image/webp"), "image/webp", 0.8);
    } catch {
      resolve(false);
    }
  });
  return nativeWebpPromise;
}

type Encoder = (data: ImageData, options: { quality: number }) => Promise<ArrayBuffer>;
let encoderPromise: Promise<Encoder> | null = null;

function loadEncoder(): Promise<Encoder> {
  encoderPromise ??= (async () => {
    const mod = await import("@jsquash/webp/encode");
    await mod.init({ locateFile: (path: string) => `/wasm/${path}` });
    return mod.default as unknown as Encoder;
  })();
  encoderPromise.catch(() => {
    encoderPromise = null; // let a later photo try again
  });
  return encoderPromise;
}

function isWebP(bytes: Uint8Array) {
  return (
    bytes.length > 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  );
}

/**
 * Turns a canvas into a real WebP file (quality 0–1), in any browser.
 * Throws rather than ever returning a PNG or JPEG.
 */
export async function canvasToWebP(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  if (await browserCanMakeWebP()) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (blob && blob.type === "image/webp") return blob;
  }

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Couldn't read the photo to make a WebP.");
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const encode = await loadEncoder();
  const buffer = await encode(pixels, { quality: Math.round(Math.min(1, Math.max(0, quality)) * 100) });
  if (!isWebP(new Uint8Array(buffer, 0, Math.min(16, buffer.byteLength)))) {
    throw new Error("The WebP converter didn't produce a WebP file.");
  }
  return new Blob([buffer], { type: "image/webp" });
}
