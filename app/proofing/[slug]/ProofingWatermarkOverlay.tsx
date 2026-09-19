"use client";

import type {
  CSSProperties,
} from "react";

type WatermarkPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

type ProofingWatermarkOverlayProps = {
  url?: string;
  position?: WatermarkPosition;
  size?: number;
  opacity?: number;
};

export default function ProofingWatermarkOverlay({
  url,
  position = "bottom-right",
  size = 30,
  opacity = 65,
}: ProofingWatermarkOverlayProps) {
  if (!url) {
    return null;
  }

  const [vertical, horizontal] =
    position === "center"
      ? ["center", "center"]
      : position.split("-");

  const style: CSSProperties = {
    position: "absolute",
    zIndex: 2,
    width: `${Math.min(100, Math.max(5, size))}%`,
    height: "auto",
    opacity:
      Math.min(100, Math.max(0, opacity)) /
      100,
    pointerEvents: "none",
    userSelect: "none",
    ...(vertical === "top"
      ? { top: "4%" }
      : vertical === "bottom"
        ? { bottom: "4%" }
        : {
            top: "50%",
            transform:
              horizontal === "center"
                ? "translate(-50%, -50%)"
                : "translateY(-50%)",
          }),
    ...(horizontal === "left"
      ? { left: "4%" }
      : horizontal === "right"
        ? { right: "4%" }
        : {
            left: "50%",
            ...(
              vertical === "center"
                ? {
                    transform:
                      "translate(-50%, -50%)",
                  }
                : {
                    transform:
                      "translateX(-50%)",
                  }
            ),
          }),
  };

  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="proofing-watermark-overlay"
      style={style}
    />
  );
}
