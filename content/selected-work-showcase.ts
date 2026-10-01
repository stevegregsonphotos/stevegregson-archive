/**
 * Selected Work showcase (mock-up, October 2026).
 *
 * One photograph per production, drawn from the "Fresh Picks" report and the
 * strongest images already on the Selected Work page. Grouped into chapters
 * that each make one case for Steve's work: scale, light, emotion, timing and
 * story.
 *
 * Images marked `credit: null` came from the Selected Work library, which
 * doesn't record the production. Steve to add the title, venue and year.
 */

const ARCHIVE = "https://images.stevegregson.com";
const LIBRARY =
  "https://selected-work-images.stevegregson.com/selected-work/production";

export type ShowcaseCredit = {
  title: string;
  venue: string;
  year: number;
  slug: string;
};

export type ShowcaseImage = {
  id: string;
  src: string;
  /** Smaller version for half-width tiles, when one exists. */
  smallSrc?: string;
  width: number;
  height: number;
  alt: string;
  credit: ShowcaseCredit | null;
  /** "wide" fills the row; "half" sits beside the next half image. */
  size: "wide" | "half";
};

export type ShowcaseChapter = {
  id: string;
  number: string;
  title: string;
  statement: string;
  images: ShowcaseImage[];
};

function archive(
  slug: string,
  file: string,
  options: { card?: boolean; width?: number } = {},
) {
  const width = options.width ?? 2048;
  return {
    src: `${ARCHIVE}/${slug}/${file}`,
    smallSrc: options.card ? `${ARCHIVE}/${slug}/__cards/${file}` : undefined,
    width,
    height: Math.round((width * 2) / 3),
  };
}

function library(file: string, width = 2048) {
  return {
    src: `${LIBRARY}/${file}`,
    smallSrc: `${LIBRARY}/__display/${file}`,
    width,
    height: Math.round((width * 2) / 3),
  };
}

export const showcaseHero: ShowcaseImage = {
  id: "dear-england",
  ...archive(
    "dear-england-olivier-theatre-national-theatre-london-june-2023",
    "hero-fullres-dearengland-credit-stevegregson-027.webp",
    { width: 2560 },
  ),
  alt: "A goalkeeper in luminous green dives across a vast circular stage ringed with light, the England squad lined up beneath a stadium screen.",
  credit: {
    title: "Dear England",
    venue: "Olivier Theatre, National Theatre",
    year: 2023,
    slug: "dear-england-olivier-theatre-national-theatre-london-june-2023",
  },
  size: "wide",
};

export const showcaseInterlude: ShowcaseImage = {
  id: "dance-show-2026",
  ...archive("the-dance-show-2026", "hero-web-danceshow2026-show-253.webp"),
  alt: "A dancer at the height of a leap, folded in mid-air inside a cone of white light above a glowing red stage.",
  credit: {
    title: "The Dance Show 2026",
    venue: "ArtsEd",
    year: 2026,
    slug: "the-dance-show-2026",
  },
  size: "wide",
};

export const showcaseChapters: ShowcaseChapter[] = [
  {
    id: "scale",
    number: "01",
    title: "Scale",
    statement:
      "The whole stage held as a single picture: set, light and company working together, read in one look.",
    images: [
      {
        id: "austenland",
        ...archive("austenland", "18-web-austenland-tech-1027.webp"),
        alt: "A couple dance centre stage beneath a glowing Austenland sign and a fan of blue and gold light beams, the company framed either side.",
        credit: {
          title: "Austenland",
          venue: "Savoy Theatre",
          year: 2025,
          slug: "austenland",
        },
        size: "wide",
      },
      {
        id: "the-big-life",
        ...archive(
          "the-big-life-theatre-royal-stratford-east-february-2024",
          "01-a-109094-enhanced-nr.webp",
          { card: true, width: 2560 },
        ),
        alt: "A winged performer leads the company downstage inside concentric arches of red bulbs, a 1950s London streetscape rising behind.",
        credit: {
          title: "The Big Life",
          venue: "Theatre Royal Stratford East",
          year: 2024,
          slug: "the-big-life-theatre-royal-stratford-east-february-2024",
        },
        size: "half",
      },
      {
        id: "table-17",
        ...archive(
          "table-17-kiln-theatre-september-2026",
          "hero-web-table17-kiln-1059.webp",
        ),
        alt: "Two diners share a laugh in a raised booth under a glowing grid of coloured ceiling panels and angled spotlights.",
        credit: {
          title: "Table 17",
          venue: "Kiln Theatre",
          year: 2026,
          slug: "table-17-kiln-theatre-september-2026",
        },
        size: "half",
      },
      {
        id: "giant-key",
        ...library("theatre-performer-giant-key-glowing-keyhole-vivid-lighting.webp"),
        alt: "A performer in a blue dress lifts an oversized golden key beneath a blazing keyhole, surrounded by flying playing cards and a giant clock.",
        credit: null,
        size: "wide",
      },
      {
        id: "let-the-right-one-in",
        ...archive(
          "let-the-right-one-in-mountview-july-2024",
          "hero-fullres-lettherightonein-credit-stevegregson-232.webp",
          { width: 2560 },
        ),
        alt: "Figures press their hands against tall, pale curtains lit cold blue, one climbing a ladder behind the drapes.",
        credit: {
          title: "Let the Right One In",
          venue: "Mountview",
          year: 2024,
          slug: "let-the-right-one-in-mountview-july-2024",
        },
        size: "half",
      },
      {
        id: "amelie",
        ...archive(
          "amelie-mountview-may-2026",
          "31-amelie-sacrecoeur-349.webp",
          { card: true, width: 2560 },
        ),
        alt: "A booth stands in a shaft of white backlight on a Parisian set, musicians and company silhouetted on the stairs around it.",
        credit: {
          title: "Amélie",
          venue: "Mountview",
          year: 2026,
          slug: "amelie-mountview-may-2026",
        },
        size: "half",
      },
    ],
  },
  {
    id: "light",
    number: "02",
    title: "Light",
    statement:
      "Understanding what the lighting designer intended, then waiting for the moment it lands on the performer.",
    images: [
      {
        id: "the-penelopiad",
        ...archive("the-penelopiad", "21-web-thepenelopiad-lyt-63.webp", {
          card: true,
        }),
        alt: "A woman in a red dress sits alone on a deep blue stage as a single shaft of white light falls diagonally across the floor.",
        credit: {
          title: "The Penelopiad",
          venue: "The Cockpit",
          year: 2026,
          slug: "the-penelopiad",
        },
        size: "wide",
      },
      {
        id: "glowing-door",
        ...library("stage-performer-opens-glowing-door-blue-amber-lighting.webp", 1800),
        alt: "A performer opens a door onto a blade of amber light that spills across a dark blue stage.",
        credit: null,
        size: "half",
      },
      {
        id: "girl-in-the-machine",
        ...archive("girl-in-the-machine", "GITM-Dress-1300.webp", {
          card: true,
        }),
        alt: "A performer stands lost in a wall of projected red text repeating the word bliss across the set and floor.",
        credit: {
          title: "Girl In The Machine",
          venue: "Young Vic",
          year: 2025,
          slug: "girl-in-the-machine",
        },
        size: "half",
      },
      {
        id: "cage-ensemble",
        ...library("stage-ensemble-cage-spotlights-production-photography.webp"),
        alt: "A line of performers grip the bars of a cage, each lit by its own narrow white spotlight against black.",
        credit: null,
        size: "wide",
      },
      {
        id: "attempts-on-her-life",
        ...archive(
          "attempts-on-her-life-bellairs-theatre-ivy-arts-centre-guildford-may-2022",
          "hero-attemptsonherlife-full-001.webp",
          { width: 2560 },
        ),
        alt: "A small figure in red stands in a single pool of white light on a vast dark stage washed with red.",
        credit: {
          title: "Attempts on Her Life",
          venue: "Guildford School of Acting",
          year: 2022,
          slug: "attempts-on-her-life-bellairs-theatre-ivy-arts-centre-guildford-may-2022",
        },
        size: "half",
      },
      {
        id: "children-of-eden",
        ...archive(
          "children-of-eden-union-theatre-london-december-2021",
          "hero-childrenofeden-full-433.webp",
          { width: 2560 },
        ),
        alt: "A performer sits cross-legged with raised hands beneath hazy shafts of blue light pouring down from above.",
        credit: {
          title: "Children of Eden",
          venue: "Union Theatre",
          year: 2021,
          slug: "children-of-eden-union-theatre-london-december-2021",
        },
        size: "half",
      },
    ],
  },
  {
    id: "emotion",
    number: "03",
    title: "Emotion",
    statement:
      "Faces, not just figures. The thought behind the line, caught while it is still happening.",
    images: [
      {
        id: "the-lonely-londoners",
        ...archive(
          "the-lonely-londoners",
          "hero-web-thelonelylondoners-113.webp",
        ),
        alt: "A man in a cream jumper gazes upward, one hand raised, as a beam of blue light cuts through haze behind him.",
        credit: {
          title: "The Lonely Londoners",
          venue: "Kiln Theatre",
          year: 2025,
          slug: "the-lonely-londoners",
        },
        size: "wide",
      },
      {
        id: "this-restless-house",
        ...archive(
          "this-restless-house-stone-nest-shaftesbury-avenue-london-july-2022",
          "08-thisrestlesshouse-part1-web-142.webp",
          { card: true },
        ),
        alt: "A woman in a pale slip cries out with arms flung wide, her face lit against a dark brick interior.",
        credit: {
          title: "This Restless House",
          venue: "Stone Nest",
          year: 2022,
          slug: "this-restless-house-stone-nest-shaftesbury-avenue-london-july-2022",
        },
        size: "half",
      },
      {
        id: "tristan-und-isolde",
        ...archive(
          "tristan-und-isolde-arcola-theatre-august-2025",
          "39-fullres-tristanundisolde-creditstevegregson-274.webp",
          { card: true, width: 2560 },
        ),
        alt: "A singer in a gold robe sings with arms open and face lifted against shimmering violet light.",
        credit: {
          title: "Tristan und Isolde",
          venue: "Arcola Theatre",
          year: 2025,
          slug: "tristan-und-isolde-arcola-theatre-august-2025",
        },
        size: "half",
      },
      {
        id: "a-streetcar-named-desire",
        ...archive(
          "a-streetcar-named-desire-mountview-march-2025",
          "21-fullres-streetcarnameddesire-leigh-creditstevegregson-183.webp",
          { card: true, width: 2560 },
        ),
        alt: "A woman in a floral dress gazes at a small flame held between her fingers, lit warm against deep blue.",
        credit: {
          title: "A Streetcar Named Desire",
          venue: "Mountview",
          year: 2025,
          slug: "a-streetcar-named-desire-mountview-march-2025",
        },
        size: "half",
      },
      {
        id: "the-farmers-wife",
        ...archive(
          "the-farmers-wife-theatre-by-the-lake-september-2026",
          "the-farmers-wife-theatre-by-the-lake-2026-solo-under-blue-sky.webp",
          { card: true },
        ),
        alt: "A woman in an apron raises one arm to a sky of hanging blue fabric on an open, sunlit farmhouse stage.",
        credit: {
          title: "The Farmer’s Wife",
          venue: "Theatre by the Lake",
          year: 2026,
          slug: "the-farmers-wife-theatre-by-the-lake-september-2026",
        },
        size: "half",
      },
      {
        id: "rain-screen",
        ...library("theatre-performer-reaches-behind-rain-screen-blue-light.webp"),
        alt: "A performer in a white shirt reaches up through a curtain of falling water droplets lit silver and blue.",
        credit: null,
        size: "wide",
      },
    ],
  },
  {
    id: "timing",
    number: "04",
    title: "Timing",
    statement:
      "The fraction of a second a scene builds towards, taken silently from the dark.",
    images: [
      {
        id: "cruel-intentions",
        ...archive("cruel-intentions-the-90s-musical", "hero-a1-07680-edit.webp", {
          width: 2560,
        }),
        alt: "A performer hangs mid-leap above the stage while a cellist plays below on a magenta-lit checkerboard floor.",
        credit: {
          title: "Cruel Intentions: The ’90s Musical",
          venue: "The Other Palace",
          year: 2024,
          slug: "cruel-intentions-the-90s-musical",
        },
        size: "wide",
      },
      {
        id: "die-walkure",
        ...archive(
          "die-walkure-york-hall-bethnal-green-london-february-2025",
          "hero-web-regentsopera-diewalk-re-creditstevegregson-308.webp",
        ),
        alt: "Wotan brandishes a long silver spear through red haze, the orchestra glowing behind him.",
        credit: {
          title: "Die Walküre",
          venue: "York Hall",
          year: 2025,
          slug: "die-walkure-york-hall-bethnal-green-london-february-2025",
        },
        size: "half",
      },
      {
        id: "into-the-woods",
        ...archive(
          "into-the-woods-artsed-november-2024",
          "hero-webres-intothewoods-cast2-fast-credit-stevegregson-023.webp",
        ),
        alt: "A huge red sheet billows overhead as a girl in a red cloak bursts through beneath it.",
        credit: {
          title: "Into the Woods",
          venue: "ArtsEd",
          year: 2024,
          slug: "into-the-woods-artsed-november-2024",
        },
        size: "half",
      },
    ],
  },
  {
    id: "story",
    number: "05",
    title: "Story",
    statement:
      "The detail that tells you what the production is about, so a single frame can stand for the whole show.",
    images: [
      {
        id: "salome",
        ...archive("salome", "16-web-salome-regents-dress2-279.webp", {
          card: true,
        }),
        alt: "A severed head rests on a silver platter in a pool of blood, the stage lights soft and blurred behind.",
        credit: {
          title: "Salome",
          venue: "York Hall",
          year: 2026,
          slug: "salome",
        },
        size: "wide",
      },
      {
        id: "her-naked-skin",
        ...archive(
          "her-naked-skin-rose-bruford-college-november-2022",
          "16-rbc-hernakedskin-webres-139.webp",
          { card: true },
        ),
        alt: "A suffragette holds a Deeds Not Words banner centre stage, surrounded by figures on a red-lit floor.",
        credit: {
          title: "Her Naked Skin",
          venue: "Rose Bruford College",
          year: 2022,
          slug: "her-naked-skin-rose-bruford-college-november-2022",
        },
        size: "half",
      },
      {
        id: "the-snowy-day",
        ...archive(
          "the-snowy-day-polka-theatre-december-2024",
          "hero-web-thesnowyday-creditstevegregson-345.webp",
        ),
        alt: "A child in a red snowsuit sits in the snow gazing up at giant flakes and puffs of cloud on a bright blue set.",
        credit: {
          title: "The Snowy Day",
          venue: "Polka Theatre",
          year: 2024,
          slug: "the-snowy-day-polka-theatre-december-2024",
        },
        size: "half",
      },
      {
        id: "tidy",
        ...archive(
          "tidy-polka-theatre-february-2024",
          "hero-web-polka-tidy-credit-stevegregson-006.webp",
        ),
        alt: "Puppet animals peer out from inside a giant woven nest, a single red leaf falling above them.",
        credit: {
          title: "Tidy",
          venue: "Polka Theatre",
          year: 2024,
          slug: "tidy-polka-theatre-february-2024",
        },
        size: "half",
      },
      {
        id: "rain-weaver",
        ...archive(
          "rain-weaver-the-cockpit-august-2024",
          "04-fullres-rainweaver-credit-stevegregson-016.webp",
          { card: true, width: 2560 },
        ),
        alt: "A man holds up a glowing lantern that lights his face from below against complete darkness.",
        credit: {
          title: "Rain Weaver",
          venue: "The Cockpit",
          year: 2024,
          slug: "rain-weaver-the-cockpit-august-2024",
        },
        size: "half",
      },
    ],
  },
];

export const showcaseCount =
  2 +
  showcaseChapters.reduce(
    (sum, chapter) => sum + chapter.images.length,
    0,
  );
