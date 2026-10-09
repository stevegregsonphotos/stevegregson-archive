export const TRANSFER_BRAND_BACKGROUNDS = [
  "/images/selected-work/production/ensemble-puppets-performer-blue-dress-on-toadstool-stage-fog.jpg",
  "/images/selected-work/production/ensemble-under-austenland-sign-stage-lights.jpg",
  "/images/selected-work/production/theatre-croquet-flamingos-heart-topiary-stage.jpg",
  "/images/selected-work/production/theatre-performer-giant-key-glowing-keyhole-vivid-lighting.jpg",
  "/images/selected-work/production/stage-performer-opens-glowing-door-blue-amber-lighting.jpg",
  "/images/selected-work/production/top-hatted-performer-raises-arms-red-stage-lights-art-deco-set.jpg",
] as const;

export function isTransferImage(file: {
  originalName: string;
  contentType: string;
}) {
  return (
    file.contentType.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|tiff?|heic)$/i.test(file.originalName)
  );
}
