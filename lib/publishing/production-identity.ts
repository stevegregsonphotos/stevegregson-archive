import {
  createProductionSlug,
} from "@/lib/publishing/production-slug";

export type ProductionIdentityInput = {
  title: string;
  venue: string;
  month: number | null | undefined;
  year: number | null | undefined;
};

export function normaliseProductionIdentityText(
  value: string,
) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[—–−]/g, "-")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function canonicalProductionVenue(
  value: string,
) {
  const normalised =
    normaliseProductionIdentityText(
      value,
    );

  if (
    /\bguildford school of acting\b/.test(normalised) ||
    /\bgsa\b/.test(normalised) ||
    /\bpats\b/.test(normalised)
  ) {
    return "guildford school of acting";
  }

  if (
    /\bartsed\b/.test(normalised) ||
    /\barts ed\b/.test(normalised) ||
    /\bandrew lloyd webber foundation theatre\b/.test(
      normalised,
    )
  ) {
    return "artsed";
  }

  if (
    /\bmountview\b/.test(normalised) ||
    /\bbackstage theatre\b/.test(normalised) ||
    /\bmack theatre\b/.test(normalised) ||
    /\bthe mack\b/.test(normalised)
  ) {
    return "mountview";
  }

  if (
    /\bmarlowe\b/.test(normalised)
  ) {
    return "marlowe theatre";
  }

  if (
    /\brose bruford\b/.test(normalised)
  ) {
    return "rose bruford college";
  }

  if (
    /\byoung vic\b/.test(normalised) ||
    /\bthe clare\b/.test(normalised)
  ) {
    return "young vic theatre";
  }

  if (
    /\bpolka theatre\b/.test(normalised) ||
    normalised === "polka"
  ) {
    return "polka theatre";
  }

  if (
    /\bpark theatre\b/.test(normalised) ||
    /\bpark90\b/.test(normalised) ||
    /\bpark200\b/.test(normalised)
  ) {
    return "park theatre";
  }

  if (
    /\bsouthwark playhouse\b/.test(normalised) ||
    /\bsouthwark elephant playhouse\b/.test(
      normalised,
    )
  ) {
    return "southwark playhouse";
  }

  return normalised;
}

export function createProductionIdentityKey(
  input: ProductionIdentityInput,
) {
  return [
    normaliseProductionIdentityText(
      input.title,
    ),
    canonicalProductionVenue(
      input.venue,
    ),
    input.month ?? "",
    input.year ?? "",
  ].join("|");
}

export function productionIdentityMatches(
  first: ProductionIdentityInput,
  second: ProductionIdentityInput,
) {
  return (
    createProductionIdentityKey(first) ===
    createProductionIdentityKey(second)
  );
}

const MONTH_NAMES = [
  "",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export function createCuratedProductionSlug(
  input: ProductionIdentityInput,
) {
  const month =
    input.month &&
    input.month >= 1 &&
    input.month <= 12
      ? MONTH_NAMES[input.month]
      : "";

  return createProductionSlug(
    [
      input.title,
      canonicalProductionVenue(
        input.venue,
      ),
      month,
      input.year ?? "",
    ]
      .filter(Boolean)
      .join(" "),
  );
}
