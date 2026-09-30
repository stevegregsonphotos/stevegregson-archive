/**
 * Remembers, in memory only, which pages someone viewed during this visit and
 * which website sent them, so an enquiry can say what brought them here.
 * Nothing is written to cookies or browser storage; a reload starts afresh.
 */

const MAX_PAGES = 12;

let pages: string[] = [];
let referrer: string | null = null;

export function recordPage(pathname: string) {
  if (referrer === null) {
    referrer = "";
    try {
      if (document.referrer) {
        const from = new URL(document.referrer);
        if (from.host !== window.location.host) {
          referrer = from.hostname.replace(/^www\./, "");
        }
      }
    } catch {
      // Unreadable referrer: treat as direct.
    }
  }

  if (pages[pages.length - 1] !== pathname) {
    pages = [...pages, pathname].slice(-MAX_PAGES);
  }
}

export function getVisitTrail() {
  return {
    referrer: referrer ?? "",
    landing: pages[0] ?? "",
    pages: [...pages],
  };
}
