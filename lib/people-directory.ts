import { cache } from "react";

import type { ProductionCredit } from "../content/productions/types";
import {
  getArchiveProductions,
  type ArchiveProduction,
} from "./productions-repository";
import {
  personKey,
  PERSON_ALIASES,
  splitCreditNames,
} from "./credit-names";
import { canonicalVenue, slugify } from "./venues";

export { personSlug, splitCreditNames } from "./credit-names";

/**
 * Builds the People and Venue directories from production credits.
 *
 * Credits were typed by hand, so the same person can appear as
 * "Isabella Van Braeckel" and "Isabella van Braeckel", "Seán Linnen" and
 * "Sean Linnen", or share one credit ("Jamie Harris & Tara Piontecki").
 * Everything below turns those into one entry per real person.
 */

const EXCLUDED_ROLES = new Set([
  "commissioned by",
  "venue",
  "photography",
  "cast",
]);

/** Display order and grouping of roles on the People pages. */
export const ROLE_GROUPS = [
  { key: "directors", label: "Director", plural: "Directors", roles: ["Director"] },
  { key: "associate-directors", label: "Associate Director", plural: "Associate Directors", roles: ["Associate Director"] },
  { key: "designers", label: "Designer", plural: "Designers", roles: ["Set & Costume Design", "Set Design", "Costume Design"] },
  { key: "lighting", label: "Lighting Designer", plural: "Lighting Designers", roles: ["Lighting Design"] },
  { key: "sound", label: "Sound Designer", plural: "Sound Designers", roles: ["Sound Design"] },
  { key: "musical-directors", label: "Musical Director", plural: "Musical Directors", roles: ["Musical Director"] },
  { key: "choreographers", label: "Choreographer", plural: "Choreographers", roles: ["Choreographer"] },
  { key: "movement", label: "Movement Director", plural: "Movement Directors", roles: ["Movement Director"] },
  { key: "writers", label: "Writer", plural: "Writers", roles: ["Writer"] },
] as const;

export type RoleGroupKey = (typeof ROLE_GROUPS)[number]["key"];

export type DirectoryProduction = {
  slug: string;
  title: string;
  year: number;
  month: number | null;
  venue: string;
  venueSlug: string | null;
  hero: string;
  heroAlt: string;
  director: string | null;
};

export type PersonEntry = {
  slug: string;
  name: string;
  website?: string;
  roles: string[];
  groups: RoleGroupKey[];
  productions: (DirectoryProduction & { credits: string[] })[];
  collaborators: { slug: string; name: string; role: string; count: number }[];
  venues: { slug: string; name: string; count: number }[];
};

export type VenueEntry = {
  slug: string;
  name: string;
  productions: DirectoryProduction[];
  directors: { slug: string; name: string; count: number }[];
};

function normaliseRole(role: string): string[] {
  const value = role.trim();

  if (/^director\s*\/\s*choreographer$/i.test(value)) {
    return ["Director", "Choreographer"];
  }

  const aliases: Record<string, string> = {
    Lighting: "Lighting Design",
    "Lighting Designer": "Lighting Design",
  };

  return [aliases[value] ?? value];
}

function mostCommon(counts: Map<string, number>) {
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]),
  )[0][0];
}

function toDirectoryProduction(production: ArchiveProduction): DirectoryProduction {
  const venue = canonicalVenue(production.venue);
  const directorCredit = production.credits.find((credit) =>
    normaliseRole(credit.role).includes("Director"),
  );

  return {
    slug: production.slug,
    title: production.title,
    year: production.year,
    month: production.month,
    venue: production.venue,
    venueSlug: venue?.slug ?? null,
    hero: production.hero,
    heroAlt: production.heroAlt,
    director: directorCredit ? splitCreditNames(directorCredit.name)[0] ?? null : null,
  };
}

function byNewest(a: DirectoryProduction, b: DirectoryProduction) {
  return b.year - a.year || (b.month ?? 0) - (a.month ?? 0) || a.title.localeCompare(b.title);
}

type PersonDraft = {
  spellings: Map<string, number>;
  websites: Set<string>;
  roles: Map<string, number>;
  productions: Map<string, { production: DirectoryProduction; credits: Set<string> }>;
};

export function buildDirectory(productions: ArchiveProduction[]) {
  const publicProductions = productions.filter((production) => production.access !== "password");
  const drafts = new Map<string, PersonDraft>();
  const creditPeople = new Map<string, { key: string; role: string }[]>();
  const venueDrafts = new Map<string, { names: Map<string, number>; productions: DirectoryProduction[] }>();

  for (const production of publicProductions) {
    const entry = toDirectoryProduction(production);
    const people: { key: string; role: string }[] = [];

    const venue = canonicalVenue(production.venue);
    if (venue) {
      const draft = venueDrafts.get(venue.slug) ?? { names: new Map<string, number>(), productions: [] as DirectoryProduction[] };
      draft.names.set(venue.name, (draft.names.get(venue.name) ?? 0) + 1);
      draft.productions.push(entry);
      venueDrafts.set(venue.slug, draft);
    }

    production.credits.forEach((credit: ProductionCredit) => {
      for (const role of normaliseRole(credit.role)) {
        if (EXCLUDED_ROLES.has(role.toLowerCase())) continue;

        for (const name of splitCreditNames(credit.name)) {
          const key = personKey(name);
          const draft = drafts.get(key) ?? {
            spellings: new Map(),
            websites: new Set(),
            roles: new Map(),
            productions: new Map(),
          };

          draft.spellings.set(name, (draft.spellings.get(name) ?? 0) + 1);
          draft.roles.set(role, (draft.roles.get(role) ?? 0) + 1);
          if (credit.website && splitCreditNames(credit.name).length === 1) {
            draft.websites.add(credit.website);
          }

          const item = draft.productions.get(production.slug) ?? { production: entry, credits: new Set<string>() };
          item.credits.add(role);
          draft.productions.set(production.slug, item);
          drafts.set(key, draft);
          people.push({ key, role });
        }
      }
    });

    creditPeople.set(production.slug, people);
  }

  const nameByKey = new Map<string, string>();
  drafts.forEach((draft, key) => nameByKey.set(key, mostCommon(draft.spellings)));

  const slugByKey = new Map<string, string>();
  const usedSlugs = new Set<string>();
  [...nameByKey.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .forEach(([key, name]) => {
      let slug = slugify(name) || "person";
      if (usedSlugs.has(slug)) {
        let n = 2;
        while (usedSlugs.has(`${slug}-${n}`)) n += 1;
        slug = `${slug}-${n}`;
      }
      usedSlugs.add(slug);
      slugByKey.set(key, slug);
    });

  const people: PersonEntry[] = [...drafts.entries()].map(([key, draft]) => {
    const roles = [...draft.roles.entries()].sort((a, b) => b[1] - a[1]).map(([role]) => role);
    const groups = ROLE_GROUPS.filter((group) =>
      (group.roles as readonly string[]).some((role) => draft.roles.has(role)),
    ).map((group) => group.key);

    const personProductions = [...draft.productions.values()]
      .map(({ production, credits }) => ({ ...production, credits: [...credits] }))
      .sort(byNewest);

    const collaboratorCounts = new Map<string, { role: string; count: number }>();
    const venueCounts = new Map<string, number>();

    for (const production of personProductions) {
      for (const other of creditPeople.get(production.slug) ?? []) {
        if (other.key === key) continue;
        const id = `${other.key}::${other.role}`;
        const current = collaboratorCounts.get(id) ?? { role: other.role, count: 0 };
        current.count += 1;
        collaboratorCounts.set(id, current);
      }
      if (production.venueSlug) {
        venueCounts.set(production.venueSlug, (venueCounts.get(production.venueSlug) ?? 0) + 1);
      }
    }

    return {
      slug: slugByKey.get(key)!,
      name: nameByKey.get(key)!,
      website: [...draft.websites][0],
      roles,
      groups,
      productions: personProductions,
      collaborators: [...collaboratorCounts.entries()]
        .filter(([, value]) => value.count >= 2)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 6)
        .map(([id, value]) => {
          const otherKey = id.split("::")[0];
          return {
            slug: slugByKey.get(otherKey)!,
            name: nameByKey.get(otherKey)!,
            role: value.role,
            count: value.count,
          };
        }),
      venues: [...venueCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([slug, count]) => ({
          slug,
          name: mostCommon(venueDrafts.get(slug)!.names),
          count,
        })),
    };
  });

  const venues: VenueEntry[] = [...venueDrafts.entries()].map(([slug, draft]) => {
    const directorCounts = new Map<string, number>();
    draft.productions.forEach((production) => {
      if (production.director) {
        const key = personKey(production.director);
        directorCounts.set(key, (directorCounts.get(key) ?? 0) + 1);
      }
    });

    return {
      slug,
      name: mostCommon(draft.names),
      productions: [...draft.productions].sort(byNewest),
      directors: [...directorCounts.entries()]
        .filter(([key]) => slugByKey.has(key))
        .sort((a, b) => b[1] - a[1] || nameByKey.get(a[0])!.localeCompare(nameByKey.get(b[0])!))
        .map(([key, count]) => ({ slug: slugByKey.get(key)!, name: nameByKey.get(key)!, count })),
    };
  });

  return {
    people: people.sort((a, b) => a.name.localeCompare(b.name)),
    venues: venues.sort((a, b) => b.productions.length - a.productions.length || a.name.localeCompare(b.name)),
    productionCount: publicProductions.length,
    slugForName: (name: string) => slugByKey.get(personKey(PERSON_ALIASES[name] ?? name)),
  };
}

/** Venue pages are only worth having once a venue has more than one production. */
export const MIN_VENUE_PRODUCTIONS = 2;

export const getDirectoryData = cache(async () => buildDirectory(await getArchiveProductions()));

export function primaryRoleLabel(person: PersonEntry) {
  const group = ROLE_GROUPS.find((item) => item.key === person.groups[0]);
  return group?.label ?? person.roles[0] ?? "";
}

export function productionCountLabel(count: number) {
  return `${count} production${count === 1 ? "" : "s"}`;
}

export function yearRange(productions: { year: number }[]) {
  const years = productions.map((production) => production.year);
  const first = Math.min(...years);
  const last = Math.max(...years);
  return first === last ? String(first) : `${first}–${String(last).slice(-2)}`;
}
