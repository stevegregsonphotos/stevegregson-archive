/**
 * Turns a block of pasted text (from Google, a theatre website, a programme or
 * Wikipedia) into role/name credits for the Backstage credits editor.
 *
 * Pure and dependency-free so both client components and test scripts can use
 * it. Nothing is ever saved by this file: the editor shows the result as a
 * preview and Steve decides what to add.
 *
 * Conventions followed (matching the existing production data):
 * - One credit per person. "Producers: A, B and C" becomes three "Producer"
 *   credits. Names that only look like one organisation ("King's College
 *   School, Wimbledon") are left whole.
 * - Roles use the site's vocabulary: "Lighting Design", "Sound Design",
 *   "Set & Costume Design", "Musical Director", "Commissioned by", etc.
 *   Unknown roles are kept as typed, in Title Case.
 * - A "Cast" section becomes "Cast" credits (one per actor), the same way the
 *   new-production upload stores cast.
 */

export type PastedCredit = {
  role: string;
  name: string;
};

export type PastedCreditsResult = {
  credits: PastedCredit[];
  /** Lines that were not blank or headings but could not be understood. */
  unparsed: string[];
};

/* ------------------------------------------------------------------ */
/* Text clean-up                                                       */
/* ------------------------------------------------------------------ */

function normaliseText(value: string) {
  return value
    .replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, " ")
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, "")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/…/g, "...");
}

/** Removes bullets, list numbering and Wikipedia-style footnote markers. */
function stripLineDecoration(line: string) {
  return line
    .replace(/\[(?:\d+|[a-z]|citation needed|note \d+)\]/gi, "")
    .replace(/^[\s•·∙◦‣▪▫●○■□►▶➤→>*+\-–—:|]+/u, "")
    .replace(/^\(?\d{1,3}[.)]\s+/, "")
    .replace(/[ \t]+$/g, "")
    .replace(/^[ \t]+/g, "");
}

function tidy(value: string) {
  let result = value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,;:|\-–—\s]+/, "")
    .replace(/[,;:|\-–—\s]+$/, "");

  // Trailing full stops go, unless they end an initial or "Jr." / "Ltd.".
  if (/\.$/.test(result) && !/(?:^|\s)(?:\p{Lu}|Jr|Sr|St|Inc|Ltd|Co)\.$/u.test(result)) {
    result = result.replace(/\s*\.+$/, "");
  }

  // Wrapping quotes: "Jane Smith" -> Jane Smith.
  return result.replace(/^"([^"]*)"$/, "$1").trim();
}

/** Final guard: no "-", "–", "—", ":", "|" (or stray commas) left at either end. */
function stripSeparators(value: string) {
  return value.replace(/^[\s\-–—:|,;]+|[\s\-–—:|,;]+$/g, "").trim();
}

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "the", "to", "with", "&"]);

function capitaliseWord(word: string) {
  return word.replace(
    /(^|[-/('])(\p{Ll})/gu,
    (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`,
  );
}

function isAllCaps(value: string) {
  const letters = value.match(/\p{L}/gu) ?? [];
  return letters.length > 1 && letters.every((letter) => letter === letter.toUpperCase() && letter !== letter.toLowerCase());
}

/** Lower-case words that belong in the middle of a name ("Peter van der Berg"). */
const NAME_PARTICLES = new Set(["van", "der", "den", "de", "la", "le", "du", "von", "da", "di", "dos", "del", "of", "and"]);

/** Honours and guild letters that follow a name and stay in capitals. */
const POST_NOMINALS = new Set([
  "CDG", "CSA", "MBE", "OBE", "CBE", "KBE", "DBE", "RA", "FRSA", "BSC", "GBSC", "ALD", "ASD",
]);

/** "DJ", "MC", "J.R.", "TJ": initials and acronyms to keep in capitals. */
function isInitialsOrAcronym(word: string) {
  const bare = word.replace(/^["(]+|[)",!]+$/g, "");
  if (/^(?:\p{Lu}\.)+\p{Lu}?\.?$/u.test(bare)) return true; // J.R. / J.R
  if (/^(?:DJ|MC)$/.test(bare)) return true;
  // Letters after a name: "Anna Bell CDG", "Jane Smith OBE".
  if (POST_NOMINALS.has(bare)) return true;
  return /^\p{Lu}{1,2}$/u.test(bare) && !/[AEIOUY]/.test(bare);
}

/** Capitalises one lower-cased name word: o'brien -> O'Brien, mcdonald -> McDonald. */
function recaseNameWord(word: string) {
  return word
    .toLowerCase()
    .replace(/(^|[-'"(])(\p{Ll})/gu, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`)
    // Only "Mc" capitalises the next letter; "Mac" is left alone (Macintyre).
    .replace(/(^|[-'"(])Mc(\p{Ll})/gu, (_match, prefix: string, letter: string) => `${prefix}Mc${letter.toUpperCase()}`);
}

/**
 * Fixes names typed in capitals or all lower case:
 * "SARAH McDONALD" -> "Sarah McDonald", "amy macintyre" -> "Amy Macintyre",
 * "PETER VAN DER BERG" -> "Peter van der Berg". Words already in mixed case
 * (McDonald, DeVito) and initials such as "DJ" or "J.R." are left alone.
 */
function fixNameCase(value: string) {
  const letters = value.match(/\p{L}/gu) ?? [];
  const allLower = letters.length > 0 && letters.every((letter) => letter === letter.toLowerCase() && letter !== letter.toUpperCase());

  return value
    .split(" ")
    .map((word, index) => {
      const wordLetters = word.match(/\p{L}/gu) ?? [];
      if (!wordLetters.length) return word;
      const upper = wordLetters.every((letter) => letter === letter.toUpperCase() && letter !== letter.toLowerCase());
      const lower = wordLetters.every((letter) => letter === letter.toLowerCase() && letter !== letter.toUpperCase());

      if (upper && isInitialsOrAcronym(word)) return word;

      // "McDONALD" / "MacDONALD": capitals after a Mc/Mac prefix.
      const prefixed = word.match(/^(Ma?c)(\p{Lu}{2,}[\p{Lu}'\-]*)$/u);
      if (prefixed) return `${prefixed[1]}${recaseNameWord(prefixed[2])}`;

      if (!(upper || (allLower && lower))) return word; // Deliberate mixed case.

      if (index > 0 && NAME_PARTICLES.has(word.toLowerCase())) return word.toLowerCase();
      return recaseNameWord(word);
    })
    .join(" ");
}

function titleCaseRole(value: string) {
  const words = value.split(" ");
  return words
    .map((word, index) => {
      if (/^[A-Z0-9]{2,4}$/.test(word)) return word; // Acronyms such as AV, VFX.
      const lower = word.toLowerCase();
      if (index > 0 && SMALL_WORDS.has(lower)) return lower;
      return capitaliseWord(lower);
    })
    .join(" ");
}

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

/** Role spellings people paste, mapped to the role names this site uses. */
const ROLE_ALIASES: Record<string, string> = {
  director: "Director",
  "directed by": "Director",
  direction: "Director",
  "associate director": "Associate Director",
  "assistant director": "Assistant Director",
  "musical director": "Musical Director",
  "musical direction": "Musical Director",
  "musical direction by": "Musical Director",
  md: "Musical Director",
  "music director": "Musical Director",
  "movement director": "Movement Director",
  "movement direction": "Movement Director",
  "movement by": "Movement Director",
  movement: "Movement Director",
  choreographer: "Choreographer",
  choreography: "Choreographer",
  "choreography by": "Choreographer",
  "choreographed by": "Choreographer",
  writer: "Writer",
  "written by": "Writer",
  playwright: "Writer",
  "by": "Writer",
  "a new play by": "Writer",
  "a play by": "Writer",
  "lighting design": "Lighting Design",
  "lighting designer": "Lighting Design",
  "lighting designed by": "Lighting Design",
  "lighting design by": "Lighting Design",
  "lighting by": "Lighting Design",
  lighting: "Lighting Design",
  "lit by": "Lighting Design",
  "sound design": "Sound Design",
  "sound designer": "Sound Design",
  "sound design by": "Sound Design",
  "sound by": "Sound Design",
  sound: "Sound Design",
  "set design": "Set Design",
  "set designer": "Set Design",
  "set by": "Set Design",
  set: "Set Design",
  "costume design": "Costume Design",
  "costume designer": "Costume Design",
  "costumes by": "Costume Design",
  "costume by": "Costume Design",
  costumes: "Costume Design",
  costume: "Costume Design",
  "set & costume design": "Set & Costume Design",
  "set & costume designer": "Set & Costume Design",
  "set & costumes": "Set & Costume Design",
  "set & costume": "Set & Costume Design",
  "set & costume by": "Set & Costume Design",
  "set & costume design by": "Set & Costume Design",
  "costume & set design": "Set & Costume Design",
  "costume & set designer": "Set & Costume Design",
  designer: "Set & Costume Design",
  design: "Set & Costume Design",
  "designed by": "Set & Costume Design",
  "design by": "Set & Costume Design",
  "commissioned by": "Commissioned by",
  commissioned: "Commissioned by",
  producer: "Producer",
  "produced by": "Producer",
  composer: "Composer",
  "composed by": "Composer",
  "music by": "Music",
  "lyrics by": "Lyrics",
  "book by": "Book",
  "music & lyrics by": "Music & Lyrics",
  "book & lyrics by": "Book & Lyrics",
  "book, music & lyrics by": "Book, Music & Lyrics",
  "words & music by": "Words & Music",
  "casting by": "Casting Director",
  casting: "Casting Director",
  "casting director": "Casting Director",
  "adapted by": "Adaptation",
  "adaptation by": "Adaptation",
  "translated by": "Translation",
  "translation by": "Translation",
  "orchestrations by": "Orchestrations",
  "orchestrated by": "Orchestrations",
  "arranged by": "Arrangements",
  "arrangements by": "Arrangements",
  "video design by": "Video Design",
  "projection design by": "Projection Design",
  "presented by": "Presented by",
  cast: "Cast",
  "starring": "Cast",
  "featuring": "Cast",
  "with": "Cast",
  book: "Book",
  lyrics: "Lyrics",
  music: "Music",
  "music & lyrics": "Music & Lyrics",
  "book & lyrics": "Book & Lyrics",
};

/**
 * Words that make a phrase look like a job title rather than a person, when
 * they END the phrase ("Stage Manager", "Head of Wardrobe")...
 */
const ROLE_LAST_WORDS = new Set([
  "director", "directors", "direction", "design", "designs", "designer", "designers", "producer", "producers",
  "writer", "writers", "playwright", "author", "lyricist", "lyricists", "composer", "composers", "lyrics",
  "music", "choreographer", "choreographers", "choreography", "supervisor", "supervisors", "supervision",
  "manager", "managers", "management", "assistant", "assistants", "associate", "associates", "dramaturg",
  "dramaturgy", "coach", "coaches", "consultant", "consultants", "adaptation", "translation", "translator",
  "puppetry", "illusions", "conductor", "operator", "operators", "programmer", "photographer", "photography",
  "captain", "understudy", "understudies", "orchestrations", "orchestrator", "arranger", "arrangements",
  "technician", "technicians", "electrician", "engineer", "dresser", "dressers", "rigger", "creator",
  "creators", "by", "wigs", "makeup", "make-up", "props", "costumes", "costume", "lighting", "effects",
  "projections", "projection", "video", "movement", "casting", "wardrobe", "commissioned", "presented",
  "produced", "directed", "written", "designed", "choreographed", "composed", "adapted", "translated",
  "orchestrated", "arranged", "conceived", "md", "asm", "dsm", "csm", "venue", "cast",
]);

/** ...or when they START it ("Associate Lighting", "Production Electrician"). */
const ROLE_FIRST_WORDS = new Set([
  "associate", "assistant", "deputy", "head", "chief", "resident", "co-director", "co-producer", "executive",
  "technical", "artistic", "creative", "general", "lighting", "sound", "costume", "costumes", "set", "video",
  "projection", "production", "stage", "company", "casting", "musical", "music", "props", "wardrobe", "wigs",
  "hair", "fight", "intimacy", "movement", "vocal", "dialect", "voice", "dance", "orchestrations",
  "original", "additional", "lead", "senior", "junior", "trainee", "children's", "youth",
]);

/** Headings that introduce a section rather than a credit. */
const CREATIVE_HEADINGS = new Set([
  "creative team", "creatives", "creative", "the creative team", "creative & production team",
  "production team", "the team", "team", "credits", "production credits", "creative credits",
  "full credits", "crew", "production", "production & creative team", "artistic team", "creative crew",
  "creative & production", "band", "the band", "musicians", "orchestra", "cast & crew", "cast & creatives",
]);
const CAST_HEADINGS = new Set([
  "cast", "the cast", "full cast", "cast list", "company", "the company", "starring", "featuring",
  "original cast", "cast & understudies", "ensemble", "actors", "performers", "cast in order of appearance",
  "in order of appearance", "cast members", "understudies", "swings", "understudies & swings",
]);
/**
 * Labels from Wikipedia/Google info boxes that are facts about the show,
 * not credits. Lines using them are listed as "not understood".
 */
const NOT_CREDIT_LABELS = new Set([
  "awards", "award", "productions", "production history", "basis", "based on", "premiere", "premiered",
  "setting", "genre", "running time", "runtime", "duration", "language", "original language", "opening",
  "opening night", "opened", "closing", "closed", "date", "dates", "website", "tickets", "booking", "age",
  "ages", "age guidance", "age recommendation", "location", "address", "price", "prices", "synopsis",
  "performances", "released", "country", "subject", "characters", "show times", "times", "previews",
  "first performance", "last performance", "status", "type", "rating", "recording", "cast recording",
]);

/** Bits of web pages that come along with a copy and paste. */
const NOISE_LINES = new Set([
  "show more", "see more", "read more", "more", "show less", "view all", "people also search for",
  "feedback", "see all", "view more", "less", "wikipedia", "sources", "edit",
]);

function roleKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+and\s+/g, " & ")
    .replace(/\s*&\s*/g, " & ")
    .replace(/[.:]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headingKey(value: string) {
  return roleKey(value).replace(/[:\-–—]+$/, "").trim();
}

/** Turns a plural job title into the singular ("Producers" -> "Producer"). */
function singularise(value: string) {
  return value.replace(/\b(\p{L}+(?:er|or|ant|ist|ian|eur))s$/iu, "$1");
}

/** Maps a pasted role onto the site's role vocabulary. */
export function normalisePastedRole(raw: string): string {
  const cleaned = tidy(raw).replace(/^the\s+/i, "");
  if (!cleaned) return "";

  const key = roleKey(cleaned);
  let base = singularise(key);
  if (ROLE_ALIASES[key]) return ROLE_ALIASES[key];
  if (ROLE_ALIASES[base]) return ROLE_ALIASES[base];

  // "Orchestrations by" -> "Orchestrations".
  base = base.replace(/\s+by$/, "");
  if (ROLE_ALIASES[base]) return ROLE_ALIASES[base];

  // "Video Designer" -> "Video Design", matching "Lighting Design" etc.
  base = base.replace(/ designer$/, " design");
  if (ROLE_ALIASES[base]) return ROLE_ALIASES[base];

  // Keep acronyms the way they were typed ("AV Design"), unless the whole
  // role was in capitals.
  const acronyms = isAllCaps(cleaned)
    ? []
    : cleaned.split(/\s+/).filter((word) => /^[A-Z]{2,4}s?$/.test(word)).map((word) => word.replace(/s$/, ""));

  return titleCaseRole(base)
    .split(" ")
    .map((word) => acronyms.find((acronym) => acronym.toLowerCase() === word.toLowerCase()) ?? word)
    .join(" ");
}

/** How strongly a phrase looks like a job title. 0 = not at all. */
function roleScore(value: string) {
  const cleaned = tidy(value);
  if (!cleaned || cleaned.length > 70) return 0;
  const key = roleKey(cleaned);
  const singular = singularise(key);
  if (ROLE_ALIASES[key] || ROLE_ALIASES[singular]) return 3;
  if (/ (?:designer|design|director|manager|supervisor|producer)$| by$/.test(singular)) return 2;
  const words = key.split(/[\s/,]+/).filter((word) => word && word !== "&");
  if (!words.length || words.length > 8) return 0;
  if (ROLE_LAST_WORDS.has(words[words.length - 1])) return 1;
  // "Musical" on its own is a genre, "Musical Supervisor" is a job.
  return words.length > 1 && ROLE_FIRST_WORDS.has(words[0]) ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* Names                                                               */
/* ------------------------------------------------------------------ */

const NAME_WORD = /^["(]?(?:[\p{Lu}\p{Lt}\d][\p{L}\p{M}'.\-\d]*|\p{Ll}{1,4}|\p{Ll}'\p{Lu}[\p{L}\p{M}'\-]*|&)[)",!]*$/u;

/** A loose check: does this look like a person or organisation name? */
function looksLikeName(value: string) {
  const cleaned = tidy(value);
  if (!cleaned || cleaned.length > 90) return false;
  if (!/^[\p{Lu}\p{Lt}"'(\d]/u.test(cleaned)) return false;
  const words = cleaned.split(" ");
  if (words.length > 10) return false;
  return words.every((word) => NAME_WORD.test(word));
}

/** A stricter check used for single lines with nothing else on them. */
function looksLikePersonLine(value: string) {
  const cleaned = tidy(value);
  if (!looksLikeName(cleaned)) return false;
  if (roleScore(cleaned) >= 2) return false;
  const words = cleaned.split(" ");
  return words.length >= 1 && words.length <= 6 && (words.length > 1 || cleaned.length >= 3);
}

function cleanName(value: string) {
  let name = tidy(value).replace(/^by\s+/i, "");
  // Unbalanced trailing quote or bracket left over from copy/paste.
  if ((name.match(/\(/g) ?? []).length < (name.match(/\)/g) ?? []).length) name = name.replace(/\)+$/, "");
  if ((name.match(/"/g) ?? []).length === 1) name = name.replace(/"/g, "");
  return fixNameCase(tidy(name));
}

const ORGANISATION_WORDS =
  /\b(?:productions?|theatres?|theaters?|company|ltd|limited|inc|school|college|university|trust|group|studios?|arts|centre|center|council|festival|ensemble|playhouse|opera|ballet)\b/i;

/**
 * Splits "A, B and C" into separate people, but only when every part looks
 * like a full name. "King's College School, Wimbledon" or
 * "Smith & Jones Productions" stay as one credit.
 */
export function splitPastedNames(value: string): string[] {
  const whole = cleanName(value);
  if (!whole) return [];

  // Protect commas and "and" inside brackets.
  const protectedValue = whole.replace(/\([^)]*\)/g, (match) => match.replace(/,/g, "\u0001").replace(/&/g, "\u0002").replace(/\band\b/g, "\u0003"));
  const parts = protectedValue
    .split(/\s*,\s*(?:and\s+|&\s*)?|\s*;\s*|\s+and\s+|\s*&\s*|\s*\/\s*/i)
    .map((part) => part.replace(/\u0001/g, ",").replace(/\u0002/g, "&").replace(/\u0003/g, "and"))
    .map((part) => cleanName(part))
    .filter(Boolean);

  if (parts.length < 2) return [whole];

  const allPeople = parts.every((part) => {
    const withoutNote = part.replace(/\s*\([^)]*\)\s*/g, " ").trim();
    const words = withoutNote.split(" ").filter(Boolean);
    return (
      words.length >= 2 &&
      words.length <= 5 &&
      /^[\p{Lu}"]/u.test(withoutNote) &&
      !ORGANISATION_WORDS.test(withoutNote)
    );
  });

  // A longer list of capitalised parts ("A, B, C") is a list even if one of
  // them is a single word or a company.
  const longList =
    parts.length >= 3 && parts.every((part) => /^[\p{Lu}"]/u.test(part) && looksLikeName(part));

  // "Kiln Theatre and Sonia Friedman Productions": every part is a whole
  // organisation name of its own. ("Smith & Jones Productions" is not split,
  // because "Smith" on its own isn't an organisation.)
  const allOrganisations = parts.every(
    (part) => part.split(" ").length >= 2 && ORGANISATION_WORDS.test(part),
  );

  return allPeople || longList || allOrganisations ? parts : [whole];
}

/* ------------------------------------------------------------------ */
/* Line parsing                                                        */
/* ------------------------------------------------------------------ */

type Pair = { role: string; name: string };

/**
 * Given the two halves of a line, works out which one is the role.
 * `roleFirstByDefault` is used when neither half is clearly a role
 * ("Dramaturg: Jane" is clear; "Fluffer: Jane Smith" relies on the colon).
 */
function pickRole(left: string, right: string, roleFirstByDefault: boolean): Pair | null {
  const l = tidy(left);
  const r = tidy(right);
  if (!l || !r) return null;
  if (NOT_CREDIT_LABELS.has(roleKey(l)) || NOT_CREDIT_LABELS.has(roleKey(r))) return null;

  const leftScore = roleScore(l);
  const rightScore = roleScore(r);
  const leftName = looksLikeName(l);
  const rightName = looksLikeName(r);

  if (leftScore > rightScore && (rightName || rightScore === 0)) return { role: l, name: r };
  if (rightScore > leftScore && (leftName || leftScore === 0)) return { role: r, name: l };
  if (leftScore > 0 && leftScore === rightScore) {
    return roleFirstByDefault ? { role: l, name: r } : { role: r, name: l };
  }
  if (roleFirstByDefault && leftScore === 0 && rightScore === 0 && l.split(" ").length <= 5 && /^[\p{Lu}"]/u.test(r) && rightName) {
    return { role: l, name: r };
  }
  return null;
}

/** "Book by X, Music by Y and Lyrics by Z" -> three pairs. */
function parseByClauses(line: string): Pair[] | null {
  if (!/\bby\s+\S/i.test(line)) return null;

  // Split before each "<Role> by", then glue back pieces that have no "by"
  // of their own ("Music and Lyrics by X" stays together).
  // A full stop also ends a clause ("Book by X. Directed by Y."), but only
  // after a whole word, so initials ("by J. R. Smith") are left alone.
  const pieces = line.split(/(?:\s*[,;]\s*(?:and\s+)?|\s+and\s+|(?<=\p{L}{2})\.\s+)(?=(?:[\p{L}&'-]+\s+){0,4}by\s)/iu);
  const clauses: string[] = [];
  let current = "";
  for (const piece of pieces) {
    current = current ? `${current} and ${piece}` : piece;
    if (/\sby\s/i.test(` ${current} `)) {
      clauses.push(current);
      current = "";
    }
  }
  if (current) {
    if (!clauses.length) return null;
    clauses[clauses.length - 1] = `${clauses[clauses.length - 1]} and ${current}`;
  }

  const pairs: Pair[] = [];
  for (const clause of clauses) {
    const match = clause.match(/^(.*?\S)\s+by\s+(.+)$/i);
    if (!match) return null;
    const [, rolePart, namePart] = match;
    if (rolePart.trim().split(/\s+/).length > 4) return null;
    // "Directed by", "Orchestrations by" - but not "Matilda the Musical by".
    if (roleScore(`${rolePart} by`) < 3 && roleScore(rolePart) === 0) return null;
    if (!/^[\p{Lu}"]/u.test(tidy(namePart))) return null;
    pairs.push({ role: `${rolePart} by`, name: namePart });
  }

  return pairs.length ? pairs : null;
}

type LineKind =
  | { kind: "pairs"; pairs: Pair[] }
  | { kind: "castName"; name: string }
  | { kind: "plain"; text: string };

function parseLine(line: string, inCast: boolean): LineKind {
  // Cast: "Jane Smith as Maria" or "Jane Smith (Maria)".
  if (inCast) {
    const asMatch = line.match(/^(.+?)\s+as\s+(.+)$/i);
    if (asMatch && looksLikeName(asMatch[1])) return { kind: "castName", name: asMatch[1] };
  }

  // "By William Shakespeare" on its own.
  const byOnly = line.match(/^(?:a (?:new )?play )?by\s+(\p{Lu}.+)$/iu);
  if (byOnly) return { kind: "pairs", pairs: [{ role: "Writer", name: byOnly[1] }] };

  // Tab-separated or wide-gap columns (tables copied from websites).
  const columns = line.split(/\t+| {3,}/).map(tidy).filter(Boolean);
  if (columns.length === 2) {
    const pair = pickRole(columns[0], columns[1], true);
    if (pair) return { kind: "pairs", pairs: [pair] };
  }

  // Role: Name   /   Role | Name
  for (const separator of [/\s*:\s+|\s*:(?=\S)/, /\s*\|\s*/]) {
    const index = line.search(separator);
    if (index > 0) {
      const match = line.slice(index).match(separator)!;
      const left = line.slice(0, index);
      const right = line.slice(index + match[0].length);
      const pair = pickRole(left, right, true);
      if (pair) return { kind: "pairs", pairs: [pair] };
    }
  }

  // "Directed by Jane Smith", "Music by A, Lyrics by B".
  const byPairs = parseByClauses(line);
  if (byPairs) return { kind: "pairs", pairs: byPairs };

  // Role – Name / Name — Role (dashes with spaces, or long dashes).
  const dashMatch = line.match(/^(.+?)(?:\s+[-–—]+\s+|\s*[–—]+\s*)(.+)$/);
  if (dashMatch) {
    const pair = pickRole(dashMatch[1], dashMatch[2], true);
    if (pair) return { kind: "pairs", pairs: [pair] };
  }

  // Jane Smith (Director)
  const parenMatch = line.match(/^(.+?)\s*\(([^()]+)\)$/);
  if (parenMatch && roleScore(parenMatch[2]) > 0 && looksLikeName(parenMatch[1])) {
    return { kind: "pairs", pairs: [{ role: parenMatch[2], name: parenMatch[1] }] };
  }
  if (inCast && parenMatch && looksLikeName(parenMatch[1])) {
    return { kind: "castName", name: parenMatch[1] };
  }

  // Jane Smith, Director   /   Director, Jane Smith
  const lastComma = line.lastIndexOf(",");
  if (lastComma > 0) {
    const left = line.slice(0, lastComma);
    const right = line.slice(lastComma + 1);
    if (roleScore(right) > 0 && roleScore(left) === 0 && looksLikeName(left)) {
      return { kind: "pairs", pairs: [{ role: right, name: left }] };
    }
    const firstComma = line.indexOf(",");
    const head = line.slice(0, firstComma);
    const tail = line.slice(firstComma + 1);
    if (roleScore(head) >= 2 && looksLikeName(tail)) {
      return { kind: "pairs", pairs: [{ role: head, name: tail }] };
    }
  }

  // "Lighting Designer Sherry Coenen": a job title at the start of the line
  // with no dash or colon before the name. Take the strongest-looking role
  // (longest wins a tie) that leaves a plain name after it.
  if (!inCast) {
    const words = tidy(line).split(" ");
    let best: { role: string; name: string; score: number; length: number } | null = null;
    for (let k = 1; k <= Math.min(6, words.length - 1); k += 1) {
      const role = words.slice(0, k).join(" ");
      const name = words.slice(k).join(" ");
      const score = roleScore(role);
      if (score < 2) continue;
      if (roleScore(name) > 0 || !looksLikeName(name)) continue;
      if (!best || score > best.score || (score === best.score && k > best.length)) {
        best = { role, name, score, length: k };
      }
    }
    if (best) return { kind: "pairs", pairs: [{ role: best.role, name: best.name }] };
  }

  return { kind: "plain", text: tidy(line) };
}

/* ------------------------------------------------------------------ */
/* Main entry point                                                    */
/* ------------------------------------------------------------------ */

export function parsePastedCredits(text: string): PastedCreditsResult {
  const credits: PastedCredit[] = [];
  const unparsed: string[] = [];
  const seen = new Set<string>();

  function add(role: string, rawName: string) {
    const normalisedRole = stripSeparators(normalisePastedRole(role));
    if (!normalisedRole) return false;
    const names = splitPastedNames(rawName).map(stripSeparators).filter(Boolean);
    if (!names.length) return false;
    for (const name of names) {
      const key = `${normalisedRole.toLowerCase()}::${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      credits.push({ role: normalisedRole, name });
    }
    return true;
  }

  const lines = normaliseText(text)
    .split(/\r\n|\r|\n|\u2028|\u2029/)
    .map(stripLineDecoration);

  let section: "creative" | "cast" = "creative";
  /** Consecutive lines with no separator, kept until we can pair them up. */
  let plainRun: string[] = [];
  /** The same lines as Steve pasted them, for the "couldn't understand" list. */
  let plainOriginals = new Map<string, string>();

  function flushPlainRun() {
    const run = plainRun;
    const originals = plainOriginals;
    plainRun = [];
    plainOriginals = new Map();
    if (!run.length) return;
    const original = (line: string) => originals.get(line) ?? line;

    if (section === "cast") {
      for (const line of run) {
        if (looksLikePersonLine(line)) add("Cast", line);
        else unparsed.push(original(line));
      }
      return;
    }

    // Websites list either "Role, Name, Role, Name" (sometimes several
    // names under one role) or "Name, Role, Name, Role". Try both and keep
    // whichever makes more sense of the lines.
    const isRole = run.map((line) => roleScore(line) > 0);
    const isName = run.map((line, index) => !isRole[index] && looksLikeName(line));

    const roleFirst: { pairs: Pair[]; leftover: string[] } = { pairs: [], leftover: [] };
    let pendingRole: string | null = null;
    let pendingUsed = false;
    run.forEach((line, index) => {
      if (isRole[index]) {
        if (pendingRole && !pendingUsed) roleFirst.leftover.push(pendingRole);
        pendingRole = line;
        pendingUsed = false;
      } else if (pendingRole && isName[index]) {
        roleFirst.pairs.push({ role: pendingRole, name: line });
        pendingUsed = true;
      } else {
        roleFirst.leftover.push(line);
      }
    });
    if (pendingRole && !pendingUsed) roleFirst.leftover.push(pendingRole);

    const nameFirst: { pairs: Pair[]; leftover: string[] } = { pairs: [], leftover: [] };
    for (let index = 0; index < run.length; index += 1) {
      if (isName[index] && isRole[index + 1]) {
        nameFirst.pairs.push({ role: run[index + 1], name: run[index] });
        index += 1;
      } else {
        nameFirst.leftover.push(run[index]);
      }
    }

    const best =
      nameFirst.pairs.length > roleFirst.pairs.length ||
      (nameFirst.pairs.length === roleFirst.pairs.length && nameFirst.leftover.length < roleFirst.leftover.length)
        ? nameFirst
        : roleFirst;

    for (const pair of best.pairs) {
      if (!add(pair.role, pair.name)) unparsed.push(original(pair.role), original(pair.name));
    }
    unparsed.push(...best.leftover.map(original));
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^[\p{P}\p{S}\s]+$/u.test(line)) continue;

    const heading = headingKey(line);
    if (CREATIVE_HEADINGS.has(heading)) {
      flushPlainRun();
      section = "creative";
      continue;
    }
    if (CAST_HEADINGS.has(heading)) {
      flushPlainRun();
      section = "cast";
      continue;
    }
    if (NOISE_LINES.has(heading)) continue;

    const parsed = parseLine(line, section === "cast");

    if (parsed.kind === "plain") {
      plainRun.push(parsed.text);
      if (!plainOriginals.has(parsed.text)) plainOriginals.set(parsed.text, line);
      continue;
    }

    flushPlainRun();

    if (parsed.kind === "castName") {
      add("Cast", parsed.name);
      continue;
    }

    // A clear credit line ends a cast section ("Director: X" after the cast
    // list). Anything else there is usually "Actor – Character" or
    // "Character: Actor", and we can't tell which is which.
    const pairs = parsed.pairs;
    if (section === "cast") {
      const clearlyCredit = pairs.every((pair) => roleScore(pair.role) >= 2);
      if (!clearlyCredit) {
        unparsed.push(line);
        continue;
      }
      section = "creative";
    }

    let ok = true;
    for (const pair of pairs) {
      if (!add(pair.role, pair.name)) ok = false;
    }
    if (!ok) unparsed.push(line);
  }

  flushPlainRun();

  return { credits, unparsed };
}
