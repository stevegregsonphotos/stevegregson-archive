/**
 * Pure helpers for reading people out of production credits. Kept free of
 * database code so client components (such as ProtectedProduction) can use
 * them.
 */
import { slugify } from "./venues";

/** Spellings that plainly refer to the same person. Key and value are both display names. */
export const PERSON_ALIASES: Record<string, string> = {
  "Benjamin Woodward": "Ben Woodward",
  "Stewart J Charlesworth": "Stewart Charlesworth",
  "Sammy J Glover": "Sammy Glover",
  "Nicola T. Chang": "Nicola Chang",
  "Cory Shipp": "Cory Anne Shipp",
  "Laura Price": "Laura Ann Price",
};

/** Credits that are not people and never get a page. */
const NOT_A_PERSON = [
  /^steve gregson$/i,
  /teaching staff|students|company|ensemble|various|^tbc$|^tba$/i,
];

export function personKey(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const NAME_PART = /^[\p{Lu}][\p{L}'’.-]*$/u;
/** A nickname in quotes, such as Leroy ‘FX’ Dias Dos Santos. */
const NICKNAME = /^[‘'"“][^‘'"“”’]+[’'"”]$/u;
const NAME_PARTICLES = new Set(["van", "von", "de", "der", "den", "da", "di", "du", "la", "le", "del", "dos", "y"]);

function looksLikeName(value: string) {
  const words = value.split(/\s+/);

  return (
    words.length >= 1 &&
    words.length <= 6 &&
    (words.length > 1 || value.length >= 3) &&
    words.every((word) => NAME_PART.test(word) || NAME_PARTICLES.has(word.toLowerCase()) || NICKNAME.test(word)) &&
    !NOT_A_PERSON.some((rule) => rule.test(value))
  );
}

/**
 * Splits one credit's name field into the people it names, dropping notes
 * such as "(Co-Director)". Returns only parts that look like a person.
 */
export function splitCreditNames(name: string): string[] {
  return name
    .replace(/\([^)]*\)/g, " ")
    .split(/\s*;\s*|\s*&\s*|\s*\/\s*|\s+and\s+|\s+with\s+|\s*,\s*/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(looksLikeName)
    .map((part) => PERSON_ALIASES[part] ?? part);
}

export function personSlug(name: string) {
  return slugify(PERSON_ALIASES[name] ?? name);
}

