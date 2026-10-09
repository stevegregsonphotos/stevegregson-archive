/**
 * Content-Disposition for downloads that keeps accented or non-English file
 * names intact (e.g. "Café scene.jpg") while giving older browsers a safe
 * plain-ASCII fallback.
 */
export function attachmentDisposition(name: string) {
  const clean = name.replace(/[\r\n"\\/]/g, "").trim() || "download";
  const ascii = clean.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").trim() || "download";
  const encoded = encodeURIComponent(clean).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return 'attachment; filename="' + ascii + "\"; filename*=UTF-8''" + encoded;
}
