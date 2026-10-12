// Dropbox-style icons for the Storage browser (inline SVG, no downloads).

export function FolderIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M4 10.5A2.5 2.5 0 0 1 6.5 8h9.2c.7 0 1.3.3 1.8.8l2 2.2h14a2.5 2.5 0 0 1 2.5 2.5V14H4z" fill="#7aa7fb" />
      <path d="M4 13h32v17.5a2.5 2.5 0 0 1-2.5 2.5h-27A2.5 2.5 0 0 1 4 30.5z" fill="#92b8fd" />
    </svg>
  );
}

const KINDS: Record<string, { label: string; color: string }> = {
  pdf: { label: "PDF", color: "#e0443e" },
  doc: { label: "DOC", color: "#2b6fd6" },
  docx: { label: "DOC", color: "#2b6fd6" },
  xls: { label: "XLS", color: "#1e8e4f" },
  xlsx: { label: "XLS", color: "#1e8e4f" },
  numbers: { label: "NUM", color: "#1e8e4f" },
  csv: { label: "CSV", color: "#1e8e4f" },
  zip: { label: "ZIP", color: "#7a6a58" },
  mp4: { label: "VID", color: "#7a3fd1" },
  mov: { label: "VID", color: "#7a3fd1" },
  m4v: { label: "VID", color: "#7a3fd1" },
  mp3: { label: "AUD", color: "#d9762a" },
  wav: { label: "AUD", color: "#d9762a" },
  tif: { label: "TIF", color: "#0b8a9c" },
  tiff: { label: "TIF", color: "#0b8a9c" },
  psd: { label: "PSD", color: "#1a5fb4" },
  cr3: { label: "RAW", color: "#0b8a9c" },
  cr2: { label: "RAW", color: "#0b8a9c" },
  nef: { label: "RAW", color: "#0b8a9c" },
  arw: { label: "RAW", color: "#0b8a9c" },
  dng: { label: "RAW", color: "#0b8a9c" },
  jpg: { label: "JPG", color: "#0b8a9c" },
  jpeg: { label: "JPG", color: "#0b8a9c" },
  png: { label: "PNG", color: "#0b8a9c" },
  heic: { label: "IMG", color: "#0b8a9c" },
};

export function FileIcon({ name, size = 32 }: { name: string; size?: number }) {
  const ext = name.toLowerCase().split(".").pop() || "";
  const kind = KINDS[ext] || { label: ext.slice(0, 4).toUpperCase() || "FILE", color: "#8a8178" };
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M10 4h14l8 8v22a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="#fff" stroke="#d6d1ca" />
      <path d="M24 4v6a2 2 0 0 0 2 2h6" fill="#f1eee9" stroke="#d6d1ca" />
      <rect x="10.5" y="22" width="19" height="9" rx="1.5" fill={kind.color} />
      <text x="20" y="28.8" textAnchor="middle" fontSize="6.2" fontWeight="700" fill="#fff" fontFamily="Arial, Helvetica, sans-serif">
        {kind.label}
      </text>
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  );
}

export function FilesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l1.8 2h8.6A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
    </svg>
  );
}

export function LaptopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <rect x="5" y="5" width="14" height="10" rx="1.5" />
      <path d="M3 18h18" strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  );
}

export function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  );
}

export function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <circle cx="5.5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="18.5" cy="12" r="1.7" />
    </svg>
  );
}

export function ChevronIcon({ open }: { open?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      style={{ transform: open ? "rotate(90deg)" : undefined, transition: "transform .15s ease" }}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
