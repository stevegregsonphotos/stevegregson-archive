import { cache } from "react";

import {
  getArchiveProductions,
  type ArchiveProduction,
} from "./productions-repository";
import {
  getDirectoryData,
  MIN_VENUE_PRODUCTIONS,
  type DirectoryProduction,
} from "./people-directory";
import { canonicalVenue } from "./venues";

/**
 * Groups archive productions into the sectors that have their own landing
 * pages (drama schools, opera). Everything is worked out from the archive,
 * so the pages grow as productions are added.
 */

type School = { name: string; match: RegExp };

/** Drama schools and conservatoires, most specific first. */
const SCHOOLS: School[] = [
  { name: "Guildford School of Acting", match: /guildford school of acting|\bgsa\b|bellairs|ivy arts centre|rex doyle/i },
  { name: "Mountview", match: /mountview/i },
  { name: "ArtsEd", match: /\barts ?ed\b|arts educational|andrew lloyd webber foundation theatre/i },
  { name: "Rose Bruford College", match: /rose bruford/i },
  { name: "Guildhall School of Music & Drama", match: /guildhall school|milton court/i },
  { name: "London School of Musical Theatre", match: /london school of musical theatre|\blsmt\b/i },
  { name: "Royal Central School of Speech & Drama", match: /central school of speech/i },
  { name: "RADA", match: /\brada\b|royal academy of dramatic art/i },
  { name: "LAMDA", match: /\blamda\b/i },
  { name: "Italia Conti", match: /italia conti/i },
  { name: "East 15 Acting School", match: /east 15/i },
  { name: "Bird College", match: /bird college/i },
  { name: "Urdang", match: /urdang/i },
  { name: "LIPA", match: /\blipa\b|liverpool institute for performing arts/i },
  { name: "Royal Welsh College of Music & Drama", match: /royal welsh college/i },
  { name: "Royal Conservatoire of Scotland", match: /royal conservatoire of scotland/i },
  { name: "Bristol Old Vic Theatre School", match: /bristol old vic theatre school/i },
  { name: "Drama Studio London", match: /drama studio london/i },
  { name: "Emil Dale Academy", match: /emil dale/i },
  { name: "Performers College", match: /performers college/i },
  { name: "Laine Theatre Arts", match: /laine theatre arts/i },
  { name: "Wac Arts", match: /wac arts/i },
];

/** Musicals and plays whose titles or blurbs say "opera" without being one. */
const NOT_OPERA = /phantom of the opera|soap opera|rock opera|pop opera|threepenny opera|opera house|space opera/gi;

function commissionedBy(production: ArchiveProduction) {
  return production.credits
    .filter((credit) => credit.role.trim().toLowerCase() === "commissioned by")
    .map((credit) => credit.name);
}

export function schoolFor(production: Pick<ArchiveProduction, "venue" | "description" | "credits">) {
  const venueAndClient = [production.venue, ...production.credits
    .filter((credit) => credit.role.trim().toLowerCase() === "commissioned by")
    .map((credit) => credit.name)].join(" · ");

  // The venue or client decides first; the blurb only fills gaps, such as a
  // school's season staged at a public theatre.
  const byVenue = SCHOOLS.find((school) => school.match.test(venueAndClient));
  if (byVenue) return byVenue.name;

  const firstSentence = (production.description ?? "").split(/(?<=[.!?])\s/)[0] ?? "";
  return SCHOOLS.find((school) => school.match.test(firstSentence))?.name ?? null;
}

export function isOpera(production: Pick<ArchiveProduction, "title" | "description" | "credits">) {
  const text = [
    production.title,
    production.description ?? "",
    ...production.credits.map((credit) => `${credit.role} ${credit.name}`),
  ]
    .join(" · ")
    .replace(NOT_OPERA, " ");

  return /\bopera\b|\boperas\b|\boperetta\b|\blibretto\b|\bconductor\b/i.test(text);
}

export type ServiceLink = { href: string; label: string };

/** The landing page a production page should point to, if any. */
export function serviceLinkFor(production: Pick<ArchiveProduction, "title" | "venue" | "description" | "credits">): ServiceLink | undefined {
  if (isOpera(production)) {
    return { href: "/opera-photography", label: "Explore opera photography" };
  }
  if (schoolFor(production)) {
    return { href: "/drama-school-photography", label: "Explore drama school photography" };
  }
  return undefined;
}

export type SchoolGroup = {
  name: string;
  venueSlug: string | null;
  productions: DirectoryProduction[];
};

export type OperaData = {
  productions: DirectoryProduction[];
  companies: { name: string; count: number }[];
  venues: { name: string; slug: string | null; count: number }[];
};

function byNewest(a: DirectoryProduction, b: DirectoryProduction) {
  return b.year - a.year || (b.month ?? 0) - (a.month ?? 0) || a.title.localeCompare(b.title);
}

export const getSectorData = cache(async () => {
  const [productions, directory] = await Promise.all([
    getArchiveProductions(),
    getDirectoryData(),
  ]);

  const venuePages = new Set(
    directory.venues
      .filter((venue) => venue.productions.length >= MIN_VENUE_PRODUCTIONS)
      .map((venue) => venue.slug),
  );
  const directoryBySlug = new Map<string, DirectoryProduction>();
  directory.venues.forEach((venue) =>
    venue.productions.forEach((production) => directoryBySlug.set(production.slug, production)),
  );

  const toEntry = (production: ArchiveProduction): DirectoryProduction =>
    directoryBySlug.get(production.slug) ?? {
      slug: production.slug,
      title: production.title,
      year: production.year,
      month: production.month,
      venue: production.venue,
      venueSlug: null,
      hero: production.hero,
      heroAlt: production.heroAlt,
      director: null,
    };

  const publicProductions = productions.filter((production) => production.access !== "password");

  // Drama schools
  const schools = new Map<string, SchoolGroup>();
  const schoolProductions: DirectoryProduction[] = [];

  for (const production of publicProductions) {
    if (isOpera(production)) continue;
    const school = schoolFor(production);
    if (!school) continue;

    const entry = toEntry(production);
    schoolProductions.push(entry);

    const group = schools.get(school) ?? { name: school, venueSlug: null, productions: [] };
    group.productions.push(entry);

    const venue = canonicalVenue(production.venue);
    if (!group.venueSlug && venue && venuePages.has(venue.slug) && SCHOOLS.find((item) => item.name === school)?.match.test(venue.name)) {
      group.venueSlug = venue.slug;
    }
    schools.set(school, group);
  }

  // Opera
  const operaProductions: DirectoryProduction[] = [];
  const companies = new Map<string, number>();
  const operaVenues = new Map<string, { name: string; slug: string | null; count: number }>();

  for (const production of publicProductions) {
    if (!isOpera(production)) continue;
    operaProductions.push(toEntry(production));

    // "UCOpera (University College Opera)" and "UCOpera" are one company.
    commissionedBy(production)
      .map((name) => name.replace(/\s*\([^)]*\)\s*/g, " ").trim())
      .filter(Boolean)
      .forEach((name) => companies.set(name, (companies.get(name) ?? 0) + 1));

    const venue = canonicalVenue(production.venue);
    if (venue) {
      const current = operaVenues.get(venue.slug) ?? {
        name: venue.name,
        slug: venuePages.has(venue.slug) ? venue.slug : null,
        count: 0,
      };
      current.count += 1;
      operaVenues.set(venue.slug, current);
    }
  }

  return {
    dramaSchools: {
      productions: schoolProductions.sort(byNewest),
      schools: [...schools.values()]
        .map((group) => ({ ...group, productions: group.productions.sort(byNewest) }))
        .sort((a, b) => b.productions.length - a.productions.length || a.name.localeCompare(b.name)),
    },
    opera: {
      productions: operaProductions.sort(byNewest),
      companies: [...companies.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      venues: [...operaVenues.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    } satisfies OperaData,
    totalProductions: publicProductions.length,
  };
});

/** Unique "schools" a drama school venue belongs to, for the venue page link. */
export function isDramaSchoolVenue(venueName: string) {
  return SCHOOLS.some((school) => school.match.test(venueName));
}
