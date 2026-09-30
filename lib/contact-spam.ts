/**
 * Cheap, invisible checks that catch the automated enquiries the contact form
 * receives (random strings in every field, submitted in a fraction of a
 * second). Real visitors never see or notice any of this.
 */

export const HONEYPOT_FIELD = "website";
export const STARTED_FIELD = "formStartedAt";

/** Faster than this and a person can't have filled in the form. */
const MIN_FILL_MS = 3000;
/** Older than this and the timestamp is stale or made up. */
const MAX_FILL_MS = 1000 * 60 * 60 * 24;

/**
 * One long run of letters with no spaces that flips between upper and lower
 * case several times, e.g. "wGuWPBuCJZawkORKYCA". Real names ("McDonald")
 * flip at most two or three times, and never have a message without spaces.
 */
export function looksLikeGibberish(value: string) {
  const text = value.trim();
  if (text.length < 10 || /\s/.test(text) || !/^[A-Za-z]+$/.test(text)) {
    return false;
  }

  let flips = 0;
  for (let i = 1; i < text.length; i += 1) {
    const before = text[i - 1] === text[i - 1].toUpperCase();
    const now = text[i] === text[i].toUpperCase();
    if (before !== now) flips += 1;
  }

  return flips >= 3;
}

/** Gmail ignores dots, so bots scatter them: "i.h.ox.i.j.ut.o.9.4.1@gmail.com". */
function dottedGmail(email: string) {
  const [local = "", domain = ""] = email.toLowerCase().split("@");
  return /^(gmail|googlemail)\.com$/.test(domain) && (local.match(/\./g) ?? []).length >= 4;
}

export type SpamVerdict = { spam: false } | { spam: true; reason: string };

export function checkContactSpam(fields: {
  honeypot: string;
  startedAt: string;
  name: string;
  email: string;
  company: string;
  date: string;
  location: string;
  message: string;
  now?: number;
}): SpamVerdict {
  if (fields.honeypot) {
    return { spam: true, reason: "hidden field filled in" };
  }

  const started = Number(fields.startedAt);
  const elapsed = (fields.now ?? Date.now()) - started;
  if (!Number.isFinite(started) || started <= 0) {
    return { spam: true, reason: "no form start time" };
  }
  if (elapsed < MIN_FILL_MS || elapsed > MAX_FILL_MS) {
    return { spam: true, reason: `submitted after ${Math.round(elapsed / 1000)}s` };
  }

  const nonsense = [fields.name, fields.company, fields.date, fields.location, fields.message].filter(
    looksLikeGibberish,
  ).length;

  if (looksLikeGibberish(fields.message) && looksLikeGibberish(fields.name)) {
    return { spam: true, reason: "name and message are random letters" };
  }
  if (nonsense + (dottedGmail(fields.email) ? 1 : 0) >= 3) {
    return { spam: true, reason: "several fields are random letters" };
  }

  return { spam: false };
}
