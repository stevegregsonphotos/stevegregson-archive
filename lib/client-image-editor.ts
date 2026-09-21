export type ImageEditorAspect =
  | "original"
  | "3:2"
  | "4:5"
  | "1:1"
  | "16:9";

export type ImageEditorSettings = {
  aspect: ImageEditorAspect;
  zoom: number;
  panX: number;
  panY: number;
  brightness: number;
};

export type EditedImageResult = {
  blob: Blob;
  width: number;
  height: number;
};

export function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}

export function aspectRatioFor(
  aspect: ImageEditorAspect,
  sourceWidth: number,
  sourceHeight: number,
) {
  if (aspect === "3:2") {
    return 3 / 2;
  }

  if (aspect === "4:5") {
    return 4 / 5;
  }

  if (aspect === "1:1") {
    return 1;
  }

  if (aspect === "16:9") {
    return 16 / 9;
  }

  return sourceWidth / sourceHeight;
}

export function calculateCropRect(
  sourceWidth: number,
  sourceHeight: number,
  settings: ImageEditorSettings,
) {
  const aspectRatio = aspectRatioFor(
    settings.aspect,
    sourceWidth,
    sourceHeight,
  );

  let baseWidth = sourceWidth;
  let baseHeight = sourceHeight;

  if (
    sourceWidth / sourceHeight >
    aspectRatio
  ) {
    baseWidth =
      sourceHeight * aspectRatio;
  } else {
    baseHeight =
      sourceWidth / aspectRatio;
  }

  const zoom = clamp(
    settings.zoom,
    1,
    4,
  );

  const cropWidth =
    baseWidth / zoom;
  const cropHeight =
    baseHeight / zoom;

  const maxOffsetX =
    Math.max(
      0,
      (sourceWidth - cropWidth) / 2,
    );

  const maxOffsetY =
    Math.max(
      0,
      (sourceHeight - cropHeight) / 2,
    );

  const centreX =
    sourceWidth / 2 +
    clamp(settings.panX, -1, 1) *
      maxOffsetX;

  const centreY =
    sourceHeight / 2 +
    clamp(settings.panY, -1, 1) *
      maxOffsetY;

  return {
    x: clamp(
      centreX - cropWidth / 2,
      0,
      sourceWidth - cropWidth,
    ),
    y: clamp(
      centreY - cropHeight / 2,
      0,
      sourceHeight - cropHeight,
    ),
    width: cropWidth,
    height: cropHeight,
    aspectRatio,
  };
}

export function drawEditedImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  outputWidth: number,
  outputHeight: number,
  settings: ImageEditorSettings,
) {
  const crop = calculateCropRect(
    sourceWidth,
    sourceHeight,
    settings,
  );

  context.save();

  context.clearRect(
    0,
    0,
    outputWidth,
    outputHeight,
  );

  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  const brightness =
    clamp(
      settings.brightness,
      25,
      200,
    ) / 100;

  if (brightness !== 1) {
    const imageData =
      context.getImageData(
        0,
        0,
        outputWidth,
        outputHeight,
      );

    const data =
      imageData.data;

    for (
      let index = 0;
      index < data.length;
      index += 4
    ) {
      data[index] = Math.min(
        255,
        Math.round(
          data[index] * brightness,
        ),
      );

      data[index + 1] = Math.min(
        255,
        Math.round(
          data[index + 1] * brightness,
        ),
      );

      data[index + 2] = Math.min(
        255,
        Math.round(
          data[index + 2] * brightness,
        ),
      );
    }

    context.putImageData(
      imageData,
      0,
      0,
    );
  }

  context.restore();
}

export async function renderEditedImage(
  image: HTMLImageElement,
  settings: ImageEditorSettings,
  options?: {
    maxDimension?: number;
    quality?: number;
  },
): Promise<EditedImageResult> {
  const maxDimension =
    options?.maxDimension ?? 2560;

  const quality =
    options?.quality ?? 0.88;

  const crop = calculateCropRect(
    image.naturalWidth,
    image.naturalHeight,
    settings,
  );

  const scale = Math.min(
    1,
    maxDimension /
      Math.max(
        crop.width,
        crop.height,
      ),
  );

  const width = Math.max(
    1,
    Math.round(
      crop.width * scale,
    ),
  );

  const height = Math.max(
    1,
    Math.round(
      crop.height * scale,
    ),
  );

  const canvas =
    document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context =
    canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "The edited image could not be prepared.",
    );
  }

  drawEditedImage(
    context,
    image,
    image.naturalWidth,
    image.naturalHeight,
    width,
    height,
    settings,
  );

  const blob =
    await new Promise<Blob>(
      (resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) {
              resolve(result);
              return;
            }

            reject(
              new Error(
                "The edited image could not be exported.",
              ),
            );
          },
          "image/webp",
          quality,
        );
      },
    );

  return {
    blob,
    width,
    height,
  };
}


export async function prepareImageForUpload(
  file: File | Blob,
): Promise<EditedImageResult> {
  const objectUrl =
    URL.createObjectURL(file);

  try {
    const image =
      await new Promise<HTMLImageElement>(
        (resolve, reject) => {
          const nextImage =
            new Image();

          nextImage.decoding = "async";

          nextImage.onload = () =>
            resolve(nextImage);

          nextImage.onerror = () =>
            reject(
              new Error(
                "The photograph could not be prepared for upload.",
              ),
            );

          nextImage.src = objectUrl;
        },
      );

    return renderEditedImage(
      image,
      {
        aspect: "original",
        zoom: 1,
        panX: 0,
        panY: 0,
        brightness: 100,
      },
    );
  } finally {
    URL.revokeObjectURL(
      objectUrl,
    );
  }
}
