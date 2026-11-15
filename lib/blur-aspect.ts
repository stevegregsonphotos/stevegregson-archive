/*
 * Every gallery photo has a tiny blur placeholder (24 px wide, same shape
 * as the photo) stored as a data URL. Reading its width and height gives
 * the photo's shape without storing anything new, so layouts can be sized
 * before the photos load (no jumping, nothing cropped).
 *
 * Handles PNG (Safari), WebP (VP8 / VP8L / VP8X) and JPEG placeholders.
 * Returns width ÷ height, or null if it can't tell.
 */

function decodeBase64(data: string): Uint8Array | null {
  try {
    if (typeof atob === "function") {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
  } catch {
    return null;
  }
  return null;
}

function sizeFromBytes(b: Uint8Array): [number, number] | null {
  // PNG: IHDR width/height (big-endian) at 16 and 20.
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const w = (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19];
    const h = (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23];
    return [w, h];
  }

  // WebP: "RIFF" .... "WEBP" then a VP8 / VP8L / VP8X chunk.
  if (
    b.length > 30 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (chunk === "VP8 ") {
      const w = (b[26] | (b[27] << 8)) & 0x3fff;
      const h = (b[28] | (b[29] << 8)) & 0x3fff;
      return [w, h];
    }
    if (chunk === "VP8L") {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
    if (chunk === "VP8X") {
      const w = (b[24] | (b[25] << 8) | (b[26] << 16)) + 1;
      const h = (b[27] | (b[28] << 8) | (b[29] << 16)) + 1;
      return [w, h];
    }
    return null;
  }

  // JPEG: find a start-of-frame marker.
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      const length = (b[i + 2] << 8) | b[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const h = (b[i + 5] << 8) | b[i + 6];
        const w = (b[i + 7] << 8) | b[i + 8];
        return [w, h];
      }
      i += 2 + length;
    }
  }

  return null;
}

export function aspectFromBlurDataURL(dataUrl: string | undefined | null): number | null {
  if (!dataUrl) return null;
  const comma = dataUrl.indexOf(",");
  if (comma < 0 || !dataUrl.slice(0, comma).includes("base64")) return null;
  const bytes = decodeBase64(dataUrl.slice(comma + 1));
  if (!bytes) return null;
  const size = sizeFromBytes(bytes);
  if (!size) return null;
  const [w, h] = size;
  if (!(w > 0 && h > 0)) return null;
  const ratio = w / h;
  // Sanity range: very wide panoramas to tall portraits.
  return ratio > 0.2 && ratio < 5 ? ratio : null;
}
