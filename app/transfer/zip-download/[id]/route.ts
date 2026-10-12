// Only reached when the browser did NOT build the zip itself (its download
// helper isn't running). Tells the page to fall back to one-by-one downloads.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const safeId = id.replace(/[^A-Za-z0-9_-]/g, "");
  const html = `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><script>
try { parent.postMessage({ type: "zip-unsupported", id: ${JSON.stringify(safeId)} }, location.origin); } catch (e) {}
</script>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
