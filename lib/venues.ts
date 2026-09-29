/**
 * Venue names in the archive were typed by hand over many years, so the
 * same building appears under many spellings ("The Mack, Mountview",
 * "The Mack Theatre, Mountview, 120 Peckham Hill Street…"). These rules
 * map every spelling to one canonical venue so each venue gets exactly
 * one page. Rules run in order and the first match wins; add a line here
 * when a new spelling appears.
 */

type VenueRule = {
  match: RegExp;
  name: string;
};

const VENUE_RULES: VenueRule[] = [
  { match: /andrew lloyd webber|\barts ?ed\b/i, name: "Andrew Lloyd Webber Foundation Theatre, ArtsEd" },
  { match: /mountview|\bthe mack\b|backstage theatre/i, name: "Mountview" },
  { match: /rose bruford|barn theatre|rose theatre/i, name: "Rose Bruford College" },
  { match: /bellairs|ivy arts centre|\bpats\b|rex doyle|guildford school of acting|\bgsa\b|university of surrey/i, name: "Guildford School of Acting" },
  { match: /yvonne arnaud/i, name: "Yvonne Arnaud Theatre" },
  { match: /greenwich theatre/i, name: "Greenwich Theatre" },
  { match: /grand temple|freemasons/i, name: "Grand Temple, Freemasons’ Hall" },
  { match: /york hall/i, name: "York Hall, Bethnal Green" },
  { match: /\bcockpit\b/i, name: "The Cockpit" },
  { match: /marlowe/i, name: "Marlowe Theatre" },
  { match: /the vaults/i, name: "The Vaults" },
  { match: /polka theatre|adventure theatre/i, name: "Polka Theatre" },
  { match: /pleasance courtyard/i, name: "Pleasance Courtyard" },
  { match: /pleasance/i, name: "Pleasance Theatre" },
  { match: /park ?90|park ?200|park theatre/i, name: "Park Theatre" },
  { match: /riverside studios/i, name: "Riverside Studios" },
  { match: /young vic/i, name: "Young Vic" },
  { match: /kiln theatre/i, name: "Kiln Theatre" },
  { match: /king['’]s head/i, name: "King’s Head Theatre" },
  { match: /jermyn street/i, name: "Jermyn Street Theatre" },
  { match: /orange tree/i, name: "Orange Tree Theatre" },
  { match: /bloomsbury theatre/i, name: "Bloomsbury Theatre" },
  { match: /bridewell/i, name: "Bridewell Theatre" },
  { match: /charing cross theatre/i, name: "Charing Cross Theatre" },
  { match: /chickenshed|\brayne\b/i, name: "Chickenshed" },
  { match: /milton court|guildhall school/i, name: "Guildhall School of Music & Drama" },
  { match: /the other palace/i, name: "The Other Palace" },
  { match: /arcola/i, name: "Arcola Theatre" },
  { match: /union theatre/i, name: "Union Theatre" },
  { match: /woolwich works/i, name: "Woolwich Works" },
  { match: /jack studio/i, name: "Jack Studio Theatre" },
  { match: /london school of musical theatre/i, name: "London School of Musical Theatre" },
  { match: /southwark (elephant )?playhouse/i, name: "Southwark Playhouse" },
  { match: /the arts at marble arch/i, name: "The Arts at Marble Arch" },
  { match: /marylebone theatre/i, name: "Marylebone Theatre" },
  { match: /seven dials playhouse/i, name: "Seven Dials Playhouse" },
  { match: /finborough/i, name: "Finborough Theatre" },
  { match: /omnibus theatre/i, name: "Omnibus Theatre" },
  { match: /alexandra palace/i, name: "Alexandra Palace Theatre" },
  { match: /cadogan hall/i, name: "Cadogan Hall" },
  { match: /savoy theatre/i, name: "Savoy Theatre" },
  { match: /racks close/i, name: "Racks Close, Guildford" },
  { match: /chalke/i, name: "Chalke History Festival" },
];

/** Entries that describe a place too loosely to deserve a venue page. */
const NOT_A_VENUE = [
  /^london$/i,
  /^online$/i,
  /^uk tour$/i,
  /^on location/i,
  /^outdoor performance$/i,
  /^site specific/i,
  /^warehouse district$/i,
  /^various /i,
  /;/, // several venues in one credit (tours)
];

export type CanonicalVenue = {
  name: string;
  slug: string;
};

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function tidyUnmatchedVenue(raw: string) {
  // Keep the building name, drop trailing city or street address parts.
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const kept = parts.filter(
    (part, index) =>
      index === 0 ||
      !/^(london|main house|\d|[a-z]{1,2}\d|.*\b(road|street|rd|lane|campus)\b)/i.test(
        part,
      ),
  );

  return kept.slice(0, 2).join(", ");
}

export function canonicalVenue(
  raw: string | null | undefined,
): CanonicalVenue | null {
  const value = (raw ?? "").trim();

  if (!value || NOT_A_VENUE.some((rule) => rule.test(value))) {
    return null;
  }

  const rule = VENUE_RULES.find((item) => item.match.test(value));
  const name = rule ? rule.name : tidyUnmatchedVenue(value);

  return {
    name,
    slug: slugify(name),
  };
}
