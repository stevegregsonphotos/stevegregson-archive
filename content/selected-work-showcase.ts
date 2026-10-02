/**
 * Selected Work showcase (mock-up, October 2026).
 *
 * A curated run of production photographs, deliberately mixed: roughly a
 * third each of single performers, two-handers or small groups, and full
 * company or stage pictures. Wide and close alternate, neighbouring photos never share a
 * colour palette, and no production appears twice in a row. No headings
 * or explanations.
 *
 * Images marked `credit: null` came from the Selected Work library, which
 * doesn't record the production. Steve to add the title, venue and year.
 *
 * One Salome frame (dress1-228) isn't on the website yet,
 * so the mock-up serves Steve's own copy from /public/selected-work-mockup.
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
  /**
   * "wide" fills the row; "half" sits beside the next half image;
   * "portrait" is an upright frame that pairs with the next portrait;
   * "tall" is an upright frame shown on its own, centred.
   */
  size: "wide" | "half" | "portrait" | "tall";
};

export type ShowcaseSection = {
  id: string;
  images: ShowcaseImage[];
};

function archive(
  slug: string,
  file: string,
  options: { card?: boolean; width?: number; height?: number } = {},
) {
  const width = options.width ?? 2048;
  return {
    src: `${ARCHIVE}/${slug}/${file}`,
    smallSrc: options.card ? `${ARCHIVE}/${slug}/__cards/${file}` : undefined,
    width,
    height: options.height ?? Math.round((width * 2) / 3),
  };
}

function library(
  file: string,
  width = 2048,
  height = Math.round((width * 2) / 3),
) {
  return {
    src: `${LIBRARY}/${file}`,
    smallSrc: `${LIBRARY}/__display/${file}`,
    width,
    height,
  };
}

function local(file: string, width = 2048, height = Math.round((width * 2) / 3)) {
  return {
    src: `/selected-work-mockup/${file}`,
    width,
    height,
  };
}

export const showcaseHero: ShowcaseImage = {
  id: "the-lonely-londoners-company",
  ...archive("the-lonely-londoners", "the-lonely-londoners-kiln-theatre-2025-ensemble-trunks-grid-lights.webp"),
  alt: "The company bow low over travelling trunks in rolling haze, one man rising above them against a wall of blazing stage lights.",
  credit: {
    title: "The Lonely Londoners",
    venue: "Kiln Theatre",
    year: 2025,
    slug: "the-lonely-londoners",
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

export const showcaseSections: ShowcaseSection[] = [
  {
    id: "opening",
    images: [
      {
        id: "die-walkure-embrace",
        ...archive("die-walkure-york-hall-bethnal-green-london-february-2025", "19-web-regentsopera-diewalk-re-creditstevegregson-196.webp", { card: true }),
        alt: "A bloodied man cradles a woman’s face in his scarred hands as she closes her eyes.",
        credit: {
          title: "Die Walküre",
          venue: "York Hall",
          year: 2025,
          slug: "die-walkure-york-hall-bethnal-green-london-february-2025",
        },
        size: "half",
      },
      {
        id: "and-then-there-were-none",
        ...archive("and-then-there-were-none", "05-fullres-andthentherewerenone-creditstevegregson-143.webp", { card: true }),
        alt: "A woman in a pink jacket jabs a finger at a man in a yellow jumper, mid-row, both lit bright against black.",
        credit: {
          title: "And Then There Were None",
          venue: "Upstairs at the Gatehouse",
          year: 2025,
          slug: "and-then-there-were-none",
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
        id: "senecas-oedipus",
        ...archive("senecas-oedipus", "hero-web-oedipus-credit-stevegregson-214-edited.webp"),
        alt: "A woman with bound wrists cries out, a rope pulled tight across her mouth, lit cold blue against black.",
        credit: {
          title: "Seneca’s Oedipus",
          venue: "The Cockpit",
          year: 2024,
          slug: "senecas-oedipus",
        },
        size: "half",
      },
      {
        id: "mid-century-embrace",
        ...library("intimate-embrace-stage-mid-century-living-room-blue-gown.webp"),
        alt: "In a lamplit mid-century lounge, a man in a velvet jacket leans in to hold a woman in a blue gown as she rests her head on his hands.",
        credit: null,
        size: "half",
      },
      {
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
      },
      {
        id: "girl-in-the-machine",
        ...archive("girl-in-the-machine", "GirlInTheMachine-31.webp", { card: true }),
        alt: "A woman bathed in red light leans back, holding a glowing white box above her face against total darkness.",
        credit: {
          title: "Girl In The Machine",
          venue: "Young Vic",
          year: 2025,
          slug: "girl-in-the-machine",
        },
        size: "half",
      },
      {
        id: "gotterdammerung",
        ...archive("gotterdammerung", "01-web-regentsopera-g-tterd-mmerung-creditstevegregson-002.webp", { card: true }),
        alt: "A woman in black sequins stares out wide-eyed, tangled in a curtain of fine silver threads.",
        credit: {
          title: "Götterdämmerung",
          venue: "York Hall",
          year: 2025,
          slug: "gotterdammerung",
        },
        size: "half",
      },
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
    ],
  },
  {
    id: "middle",
    images: [
      {
        id: "young-frankenstein",
        ...archive("young-frankenstein-yvonne-arnaud-theatre-june-2026", "11-web-youngfrankenstein-gsa-372.webp", { card: true }),
        alt: "A young woman clutches a startled man’s face, both frozen mid-gasp in a comic double take.",
        credit: {
          title: "Young Frankenstein",
          venue: "Yvonne Arnaud Theatre",
          year: 2026,
          slug: "young-frankenstein-yvonne-arnaud-theatre-june-2026",
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
      {
        id: "vertical-light",
        ...library("stage-performer-profile-vertical-light-minimalist-darkness.webp", 2048, 1152),
        alt: "A woman in a long grey cardigan stands in profile, head bowed, beside a single vertical blade of white light in total darkness.",
        credit: null,
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
        id: "salome-platter",
        ...local("salome-dress1-228.webp", 1365, 2048),
        alt: "Salome kneels on a blood-spattered stage holding the veiled head, her reflection caught in the pool of blood on a silver platter.",
        credit: {
          title: "Salome",
          venue: "York Hall",
          year: 2026,
          slug: "salome",
        },
        size: "tall",
      },
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
        id: "on-the-ropes-round-2",
        ...archive("on-the-ropes", "hero-ontheropes-fullres-photosbystevegregson-060-copy.webp", { card: true }),
        alt: "A boxer in a red-lit ring raises both fists to the crowd beneath a glowing Round 2 sign.",
        credit: {
          title: "On The Ropes",
          venue: "Park Theatre",
          year: 2023,
          slug: "on-the-ropes",
        },
        size: "half",
      },
      {
        id: "table-17-hands",
        ...archive("table-17-kiln-theatre-september-2026", "table-17-kiln-theatre-2026-diners-holding-hands.webp", { card: true }),
        alt: "Across a small table lit by a red lamp, a man takes a woman’s hands and holds her gaze.",
        credit: {
          title: "Table 17",
          venue: "Kiln Theatre",
          year: 2026,
          slug: "table-17-kiln-theatre-september-2026",
        },
        size: "half",
      },
    ],
  },
  {
    id: "closing",
    images: [
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
        size: "wide",
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
        size: "half",
      },
    ],
  },
];

export const showcaseCount =
  2 +
  showcaseSections.reduce(
    (sum, section) => sum + section.images.length,
    0,
  );
