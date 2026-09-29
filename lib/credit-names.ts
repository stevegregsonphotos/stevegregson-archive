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
  // Misspellings in credits, confirmed by Steve.
  "Alex Musgraves": "Alex Musgrave",
  "Louie Whitmore": "Louie Whitemore",
  "Philippa Brockelhurst": "Philippa Brocklehurst",
  "Zach Fils": "Zach Flis",
  "Gabi Nimo": "Gaby Nimo",
};

/**
 * People who genuinely use both a short and a full first name. Both spellings
 * stay as credited; they share one page, named after whichever spelling is
 * used most (the full name on a tie).
 */
export const SAME_PERSON: Record<string, string> = {
  "Matt Hockley": "Matthew Hockley",
  "Steve Grihault": "Steven Grihault",
  "Rog Ness": "Roger Ness",
  "Ebe Bamgboye": "Ebenezer Bamgboye",
  "Ellie Isherwood": "Eleanor Isherwood",
  "Jo Goodwin": "Joanna Goodwin",
  "Andy Johnson": "Andrew Johnson",
  "Ryan Littler": "Ryan Jones Littler",
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

/** The key that decides which page a credited name belongs to. */
export function personIdentity(name: string) {
  const display = PERSON_ALIASES[name] ?? name;
  return personKey(SAME_PERSON[display] ?? display);
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

