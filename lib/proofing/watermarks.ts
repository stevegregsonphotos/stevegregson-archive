import fs from "node:fs";
import path from "node:path";

export type ProofingWatermarkPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type ProofingWatermark = {
  id: string;
  name: string;
  filename: string;
  createdAt: string;
  updatedAt: string;
};

const watermarkDirectory = path.join(
  process.cwd(),
  "data",
  "proofing-watermarks",
);

const watermarkIndexPath = path.join(
  watermarkDirectory,
  "watermarks.json",
);

function ensureWatermarkStorage() {
  fs.mkdirSync(watermarkDirectory, {
    recursive: true,
  });

  if (!fs.existsSync(watermarkIndexPath)) {
    fs.writeFileSync(
      watermarkIndexPath,
      JSON.stringify([], null, 2),
    );
  }
}

export function getProofingWatermarks():
  ProofingWatermark[] {
  ensureWatermarkStorage();

  try {
    const raw = fs.readFileSync(
      watermarkIndexPath,
      "utf8",
    );

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? (parsed as ProofingWatermark[])
      : [];
  } catch {
    return [];
  }
}

export function saveProofingWatermarks(
  watermarks: ProofingWatermark[],
) {
  ensureWatermarkStorage();

  fs.writeFileSync(
    watermarkIndexPath,
    JSON.stringify(watermarks, null, 2),
  );
}

export function getProofingWatermark(
  id: string,
) {
  return getProofingWatermarks().find(
    (watermark) => watermark.id === id,
  );
}

export function getProofingWatermarkDirectory() {
  ensureWatermarkStorage();

  return watermarkDirectory;
}
