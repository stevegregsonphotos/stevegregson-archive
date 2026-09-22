"use client";

export default function PrintNotesReportButton() {
  return (
    <button
      type="button"
      onClick={() =>
        window.print()
      }
    >
      Print / Save PDF
    </button>
  );
}
