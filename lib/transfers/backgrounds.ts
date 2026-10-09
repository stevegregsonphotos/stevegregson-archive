// Built-in photographs used on client download pages when Steve hasn't
// uploaded his own defaults or picked photos from the transfer itself.
// These are web-sized copies (≈2400px) so the page loads quickly.
export const TRANSFER_BRAND_BACKGROUNDS = [
  "/images/transfer-backgrounds/ensemble-puppets-performer-blue-dress-on-toadstool-stage-fog.jpg",
  "/images/transfer-backgrounds/ensemble-under-austenland-sign-stage-lights.jpg",
  "/images/transfer-backgrounds/theatre-croquet-flamingos-heart-topiary-stage.jpg",
  "/images/transfer-backgrounds/theatre-performer-giant-key-glowing-keyhole-vivid-lighting.jpg",
  "/images/transfer-backgrounds/stage-performer-opens-glowing-door-blue-amber-lighting.jpg",
  "/images/transfer-backgrounds/top-hatted-performer-raises-arms-red-stage-lights-art-deco-set.jpg",
] as const;

/** Most transfer pages show up to this many backgrounds. */
export const MAX_BACKGROUNDS = 8;

export function isTransferImage(file: {
  originalName: string;
  contentType: string;
}) {
  return (
    file.contentType.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|tiff?|heic)$/i.test(file.originalName)
  );
}

/** Image types every browser can show (so they can be used as a background). */
export function isWebImage(file: { originalName: string; contentType: string }) {
  return /^image\/(jpeg|png|webp)$/i.test(file.contentType) || /\.(jpe?g|png|webp)$/i.test(file.originalName);
}
