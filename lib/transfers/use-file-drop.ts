"use client";

import { useRef, useState, type DragEvent } from "react";
import { filesFromDrop, isFileDrag, type QueuedFile } from "./upload-client";

/**
 * Lets an area of the page accept dropped files and folders.
 * Spread `dropProps` onto the element; `dragging` is true while files hover over it.
 */
export function useFileDrop(onFiles: (files: QueuedFile[]) => void, enabled = true) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const dropProps = {
    onDragEnter(event: DragEvent) {
      if (!enabled || !isFileDrag(event)) return;
      event.preventDefault();
      depth.current += 1;
      setDragging(true);
    },
    onDragOver(event: DragEvent) {
      if (!enabled || !isFileDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    onDragLeave(event: DragEvent) {
      if (!enabled || !isFileDrag(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    },
    onDrop(event: DragEvent) {
      if (!enabled || !isFileDrag(event)) return;
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      // Must be read straight away — the browser forgets dropped items after this event.
      void filesFromDrop(event.dataTransfer).then((files) => {
        if (files.length) onFiles(files);
      });
    },
  };

  return { dragging, dropProps };
}
