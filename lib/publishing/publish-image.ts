import sharp from "sharp";

const MAX_PUBLISHED_IMAGE_WIDTH = 2560;
const PUBLISHED_WEBP_QUALITY = 82;
const BLUR_PLACEHOLDER_WIDTH = 24;

export type PublishedImageAsset = {
  sourceFilepath: string;
  filename: string;
  blurDataURL: string;
  buffer: Buffer;
};

export async function publishImageBuffer(
  sourceBuffer: Buffer,
  sourceFilepath: string,
  outputFilename: string,
  _destinationDirectory: string,
): Promise<PublishedImageAsset> {
  const orientedImage = sharp(
    sourceBuffer,
    { failOn: "none" },
  ).rotate();

  const publishedBuffer =
    await orientedImage
      .clone()
      .resize({
        width: MAX_PUBLISHED_IMAGE_WIDTH,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: PUBLISHED_WEBP_QUALITY,
        effort: 5,
        smartSubsample: true,
      })
      .toBuffer();

  const blurBuffer =
    await orientedImage
      .clone()
      .resize({
        width: BLUR_PLACEHOLDER_WIDTH,
        fit: "inside",
        withoutEnlargement: true,
      })
      .blur(0.5)
      .webp({ quality: 38, effort: 3 })
      .toBuffer();

  return {
    sourceFilepath,
    filename: outputFilename,
    blurDataURL:
      `data:image/webp;base64,${blurBuffer.toString("base64")}`,
    buffer: publishedBuffer,
  };
}
