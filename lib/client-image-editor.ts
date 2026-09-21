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
  autoStrength: number;
};

export type EditedImageResult = {
  blob: Blob;
  width: number;
  height: number;
};

export type ImageAutoCorrection = {
  blackPoint: number;
  whitePoint: number;
  gamma: number;
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

export function analyseImageAutoCorrection(
  image: HTMLImageElement,
): ImageAutoCorrection {
  const maxSampleDimension = 512;

  const scale = Math.min(
    1,
    maxSampleDimension /
      Math.max(
        image.naturalWidth,
        image.naturalHeight,
      ),
  );

  const width = Math.max(
    1,
    Math.round(
      image.naturalWidth * scale,
    ),
  );

  const height = Math.max(
    1,
    Math.round(
      image.naturalHeight * scale,
    ),
  );

  const canvas =
    document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context =
    canvas.getContext("2d", {
      willReadFrequently: true,
    });

  if (!context) {
    return {
      blackPoint: 0,
      whitePoint: 255,
      gamma: 1,
    };
  }

  context.drawImage(
    image,
    0,
    0,
    width,
    height,
  );

  const pixels =
    context.getImageData(
      0,
      0,
      width,
      height,
    ).data;

  const histogram =
    new Uint32Array(256);

  let total = 0;
  let luminanceSum = 0;

  for (
    let index = 0;
    index < pixels.length;
    index += 4
  ) {
    const alpha =
      pixels[index + 3];

    if (alpha < 16) {
      continue;
    }

    const luminance =
      Math.round(
        0.2126 * pixels[index] +
        0.7152 * pixels[index + 1] +
        0.0722 * pixels[index + 2],
      );

    histogram[luminance] += 1;
    luminanceSum += luminance;
    total += 1;
  }

  if (!total) {
    return {
      blackPoint: 0,
      whitePoint: 255,
      gamma: 1,
    };
  }

  function percentile(
    fraction: number,
  ) {
    const target =
      total * fraction;

    let running = 0;

    for (
      let value = 0;
      value < 256;
      value += 1
    ) {
      running +=
        histogram[value];

      if (running >= target) {
        return value;
      }
    }

    return 255;
  }

  const low =
    percentile(0.01);

  const high =
    percentile(0.99);

  const blackPoint =
    Math.max(
      0,
      Math.min(low, 32),
    );

  const whitePoint =
    Math.min(
      255,
      Math.max(high, 220),
    );

  const mean =
    luminanceSum / total;

  const normalisedMean =
    clamp(
      (mean - blackPoint) /
        Math.max(
          1,
          whitePoint -
            blackPoint,
        ),
      0.02,
      0.98,
    );

  const desiredMidtone = 0.5;

  const gamma =
    clamp(
      Math.log(desiredMidtone) /
        Math.log(
          normalisedMean,
        ),
      0.65,
      1.6,
    );

  return {
    blackPoint,
    whitePoint,
    gamma,
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
  autoCorrection?: ImageAutoCorrection,
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

  const autoStrength =
    clamp(
      settings.autoStrength,
      0,
      100,
    ) / 100;

  if (
    autoCorrection &&
    autoStrength > 0
  ) {
    const imageData =
      context.getImageData(
        0,
        0,
        outputWidth,
        outputHeight,
      );

    const data =
      imageData.data;

    const black =
      autoCorrection.blackPoint;

    const white =
      Math.max(
        black + 1,
        autoCorrection.whitePoint,
      );

    const gamma =
      autoCorrection.gamma;

    for (
      let index = 0;
      index < data.length;
      index += 4
    ) {
      for (
        let channel = 0;
        channel < 3;
        channel += 1
      ) {
        const original =
          data[index + channel];

        const levelled =
          clamp(
            (original - black) /
              (white - black),
            0,
            1,
          );

        const corrected =
          Math.pow(
            levelled,
            gamma,
          ) * 255;

        data[index + channel] =
          Math.round(
            original +
              (
                corrected -
                original
              ) *
                autoStrength,
          );
      }
    }

    context.putImageData(
      imageData,
      0,
      0,
    );
  }

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
  autoCorrection?: ImageAutoCorrection,
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
        autoStrength: 0,
      },
    );
  } finally {
    URL.revokeObjectURL(
      objectUrl,
    );
  }
}
