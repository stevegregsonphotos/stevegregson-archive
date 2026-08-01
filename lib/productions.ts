export type GalleryLayout =
  | "wide"
  | "left"
  | "right"
  | "medium"
  | "full"
  | "left-small"
  | "right-small"
  | "wide-left"
  | "wide-right";

export type ProductionCredit = {
  role: string;
  name: string;
  website?: string;
};

export type ProductionImage = {
  src: string;
  alt: string;
  layout: GalleryLayout;
};

export type Production = {
  slug: string;
  title: string;
  venue: string;
  year: number;
  description: string;
  hero: string;
  heroAlt: string;
  credits: ProductionCredit[];
  images: ProductionImage[];
  nextProduction?: {
    slug: string;
    title: string;
    venue: string;
    year: number;
    image: string;
  };
};

export const productions: Production[] = [
  {
    slug: "lonely-londoners",
    title: "The Lonely Londoners",
    venue: "Kiln Theatre",
    year: 2025,
    description:
      "Dress rehearsal photography created for the production’s publicity campaign.",
    hero: "ProofOnly-LonelyLondoners-113-Enhanced-NR-Edit.jpg",
    heroAlt:
      "The Lonely Londoners at Kiln Theatre, photographed by Steve Gregson",

    credits: [
     {
  role: "Venue",
  name: "Kiln Theatre",
  website: "https://kilntheatre.com",
},
      {
  role: "Director",
  name: "Ebenezer Bamgboye",
  website: "https://www.ebenezerbamgboye.com",
},
      { role: "Lighting Design", name: "Elliot Griggs" },
      {
        role: "Set & Costume Design",
        name: "Laura Ann Price",
      },
      { role: "Commissioned by", name: "Kiln Theatre" },
      { role: "Photography", name: "Steve Gregson" },
    ],

    images: [
      {
        src: "ProofOnly-LonelyLondoners-2-Enhanced-NR.jpg",
        alt: "The Lonely Londoners production photograph",
        layout: "wide",
      },
      {
        src: "ProofOnly-LonelyLondoners-313-Enhanced-NR-Edit-Edit.jpg",
        alt: "The Lonely Londoners production photograph",
        layout: "left",
      },
      {
        src: "ProofOnly-LonelyLondoners-21-Enhanced-NR.jpg",
        alt: "The Lonely Londoners production photograph",
        layout: "right",
      },
      {
        src: "ProofOnly-LonelyLondoners-226-Enhanced-NR-Edit.jpg",
        alt: "The Lonely Londoners production photograph",
        layout: "medium",
      },
      {
        src: "ProofOnly-LonelyLondoners-297-Enhanced-NR-Edit.jpg",
        alt: "The Lonely Londoners production photograph",
        layout: "full",
      },
      {
        src: "ProofOnly-LonelyLondoners-25-Enhanced-NR-Edit.jpg",
        alt: "The Lonely Londoners production photograph",
        layout: "left-small",
      },
      {
        src: "ProofOnly-LonelyLondoners-316-Enhanced-NR.jpg",
        alt: "The Lonely Londoners production photograph",
        layout: "right-small",
      },
      {
        src: "ProofOnly-LonelyLondoners-56-Enhanced-NR-Edit-Edit-Edit.jpg",
        alt: "The Lonely Londoners production photograph",
        layout: "wide-left",
      },
      {
        src: "ProofOnly-LonelyLondoners-7-Enhanced-NR-Edit.jpg",
        alt: "The Lonely Londoners production photograph",
        layout: "wide-right",
      },
      {
        src: "ProofOnly-LonelyLondoners-29-Enhanced-NR-Edit-Edit.jpg",
        alt: "The Lonely Londoners production photograph",
        layout: "medium",
      },
      {
        src: "ProofOnly-LonelyLondoners-88-Enhanced-NR-Edit.jpg",
        alt: "The Lonely Londoners production photograph",
        layout: "full",
      },
    ],

    nextProduction: {
      slug: "alice-in-wonderland",
      title: "Alice in Wonderland",
      venue: "Marylebone Theatre",
      year: 2025,
      image:
        "/images/productions/alice-in-wonderland/A1_02664-Edit-Edit.jpg",
    },
  },

  {
    slug: "alice-in-wonderland",
    title: "Alice in Wonderland",
    venue: "Marylebone Theatre",
    year: 2025,
    description:
      "Dress rehearsal photography created for the production’s publicity campaign.",
    hero: "A1_02664-Edit-Edit.jpg",
    heroAlt:
      "Alice in Wonderland at Marylebone Theatre, photographed by Steve Gregson",

    credits: [
      { role: "Venue", name: "Marylebone Theatre" },
      { role: "Director", name: "Nate Bertone" },
      { role: "Associate Director", name: "Eva Sampson" },
      { role: "Lighting", name: "Jack Weir" },
      {
        role: "Set & Costume Design",
        name: "Nate Bertone",
      },
      {
        role: "Commissioned by",
        name: "Deus Ex Machina Productions",
      },
      { role: "Photography", name: "Steve Gregson" },
    ],

    images: [
      {
        src: "A1_03510-Edit-Edit-Edit-Edit-Edit-Edit-Edit-Edit.jpg",
        alt: "Alice in Wonderland production photograph",
        layout: "wide",
      },
      {
        src: "A_105514-Edit.jpg",
        alt: "Alice in Wonderland production photograph",
        layout: "medium",
      },
      {
        src: "A9_07611-Edit-Edit-Edit-Edit.jpg",
        alt: "Alice in Wonderland production photograph",
        layout: "right",
      },
      {
        src: "A1_03829-Edit-Edit-Edit-Edit.jpg",
        alt: "Alice in Wonderland production photograph",
        layout: "left",
      },
      {
        src: "A9_07786-Edit.jpg",
        alt: "Alice in Wonderland production photograph",
        layout: "full",
      },
      {
        src: "A1_03160-Edit.jpg",
        alt: "Alice in Wonderland production photograph",
        layout: "wide-left",
      },
      {
        src: "A_106683.jpg",
        alt: "Alice in Wonderland production photograph",
        layout: "medium",
      },
      {
        src: "A_105935-Edit-Edit.jpg",
        alt: "Alice in Wonderland production photograph",
        layout: "right-small",
      },
      {
        src: "A1_02280-Edit.jpg",
        alt: "Alice in Wonderland production photograph",
        layout: "wide",
      },
      {
        src: "A_106098-Edit-Edit.jpg",
        alt: "Alice in Wonderland production photograph",
        layout: "left",
      },
      {
        src: "A_106098.jpg",
        alt: "Alice in Wonderland production photograph",
        layout: "full",
      },
    ],

    nextProduction: {
  slug: "godspell",
  title: "Godspell",
  venue: "Mountview",
  year: 2026,
  image:
    "/images/productions/godspell/GODSPELL-Genesis-58.jpg",
},
  },

  {
    slug: "girl-in-the-machine",
    title: "Girl In The Machine",
    venue: "Young Vic Theatre",
    year: 2025,
    description:
      "Dress rehearsal photography created for the production’s publicity campaign.",
    hero: "hero.jpg",
    heroAlt:
      "Girl In The Machine at the Young Vic Theatre, photographed by Steve Gregson",

    credits: [
      { role: "Venue", name: "Young Vic Theatre" },
      { role: "Director", name: "Annie Kershaw" },
      {
        role: "Lighting Design",
        name: "Lucía Sánchez Roldán",
      },
      {
        role: "Commissioned by",
        name: "Young Vic Theatre",
      },
      { role: "Photography", name: "Steve Gregson" },
    ],

    images: [
      {
        src: "GirlInTheMachine-8.jpg",
        alt: "A performer wearing an illuminated digital visor",
        layout: "wide",
      },
      {
        src: "GirlInTheMachine-20.jpg",
        alt: "Two performers in a stark domestic interior",
        layout: "left",
      },
      {
        src: "GirlInTheMachine-19.jpg",
        alt: "Two performers embracing on stage",
        layout: "right",
      },
      {
        src: "GirlInTheMachine-23.jpg",
        alt: "Two performers seated together during Girl In The Machine",
        layout: "medium",
      },
      {
        src: "GirlInTheMachine-37.jpg",
        alt: "Two performers sitting apart in a tense domestic scene",
        layout: "wide-left",
      },
      {
        src: "GirlInTheMachine-12.jpg",
        alt: "A performer drinking during a scene from Girl In The Machine",
        layout: "right-small",
      },
      {
        src: "GirlInTheMachine-21.jpg",
        alt: "A performer standing beneath stark stage lighting",
        layout: "left-small",
      },
      {
        src: "GirlInTheMachine-31.jpg",
        alt: "A performer illuminated by intense red light",
        layout: "full",
      },
      {
        src: "GirlInTheMachine-34.jpg",
        alt: "A performer wearing a glowing digital visor in darkness",
        layout: "medium",
      },
      {
        src: "GITM-Dress-1177-Edit.jpg",
        alt: "A seated performer wearing a glowing visor",
        layout: "left",
      },
      {
        src: "GITM-Dress-1277-Edit.jpg",
        alt: "A close portrait illuminated by a digital screen",
        layout: "right",
      },
      {
        src: "GirlInTheMachine-55.jpg",
        alt: "A solitary performer standing in a narrow pool of light",
        layout: "left-small",
      },
      {
        src: "GirlInTheMachine-56.jpg",
        alt: "Two performers silhouetted by stage lighting",
        layout: "wide-right",
      },
      {
        src: "GirlInTheMachine-57.jpg",
        alt: "Two performers sharing an intimate moment",
        layout: "medium",
      },
      {
        src: "GirlInTheMachine-66.jpg",
        alt: "Performers beneath a dramatic red illuminated ceiling",
        layout: "full",
      },
      {
        src: "GITM-Dress-1300.jpg",
        alt: "A performer silhouetted against repeated red text",
        layout: "wide",
      },
      {
        src: "GirlInTheMachine-52.jpg",
        alt: "A red-lit scene from Girl In The Machine",
        layout: "full",
      },
    ],

    nextProduction: {
      slug: "lonely-londoners",
      title: "The Lonely Londoners",
      venue: "Kiln Theatre",
      year: 2025,
      image:
        "/images/productions/lonely-londoners/ProofOnly-LonelyLondoners-113-Enhanced-NR-Edit.jpg",
    },
  },
  {
  slug: "godspell",
  title: "Godspell",
  venue: "Mountview",
  year: 2026,

  description:
    "Dress rehearsal photography created for the production’s publicity campaign.",

  hero: "GODSPELL-Genesis-58.jpg",

  heroAlt:
    "Godspell at Mountview, photographed by Steve Gregson",

  credits: [
    {
      role: "Venue",
      name: "Mountview",
    },
    {
      role: "Director",
      name: "Shane Dempsey",
    },
    {
      role: "Musical Director",
      name: "James Bowen-Thomas",
    },
    {
      role: "Choreographer",
      name: "Julia Cave",
    },
    {
      role: "Lighting Design",
      name: "Mark Dymock",
    },
    {
      role: "Set & Costume Design",
      name: "George P Martin",
    },
    {
      role: "Sound Design",
      name: "Matthew Giles",
    },
    {
      role: "Commissioned by",
      name: "Mountview",
    },
    {
      role: "Photography",
      name: "Steve Gregson",
    },
  ],

  images: [
    {
      src: "GODSPELL-Revelation-136-2.jpg",
      alt: "Godspell production photograph",
      layout: "wide",
    },
    {
      src: "GODSPELL-Genesis-329.jpg",
      alt: "Godspell production photograph",
      layout: "left",
    },
    {
      src: "GODSPELL-Genesis-381.jpg",
      alt: "Godspell production photograph",
      layout: "right",
    },
    {
      src: "GODSPELL-Revelation-181-2.jpg",
      alt: "Godspell production photograph",
      layout: "full",
    },
    {
      src: "GODSPELL-Genesis-249.jpg",
      alt: "Godspell production photograph",
      layout: "left-small",
    },
    {
      src: "GODSPELL-Revelation-266.jpg",
      alt: "Godspell production photograph",
      layout: "right-small",
    },
    {
      src: "GODSPELL-Revelation-184.jpg",
      alt: "Godspell production photograph",
      layout: "wide-left",
    },
    {
      src: "GODSPELL-Revelation-190-2.jpg",
      alt: "Godspell production photograph",
      layout: "wide-right",
    },
    {
      src: "GODSPELL-Revelation-24.jpg",
      alt: "Godspell production photograph",
      layout: "medium",
    },
    {
      src: "GODSPELL-Revelation-33-2.jpg",
      alt: "Godspell production photograph",
      layout: "left-small",
    },
    {
      src: "GODSPELL-Revelation-27-2.jpg",
      alt: "Godspell production photograph",
      layout: "wide",
    },
    {
      src: "GODSPELL-Revelation-32-2.jpg",
      alt: "Godspell production photograph",
      layout: "full",
    },
    {
      src: "GODSPELL-Revelation-372-2.jpg",
      alt: "Godspell production photograph",
      layout: "left",
    },
    {
      src: "GODSPELL-Revelation-374.jpg",
      alt: "Godspell production photograph",
      layout: "right",
    },
    {
      src: "GODSPELL-Genesis-388.jpg",
      alt: "Godspell production photograph",
      layout: "medium",
    },
    {
      src: "GODSPELL-Genesis-397.jpg",
      alt: "Godspell production photograph",
      layout: "right-small",
    },
    {
      src: "GODSPELL-Genesis-395.jpg",
      alt: "Godspell production photograph",
      layout: "wide-left",
    },
    {
      src: "GODSPELL-Revelation-380-2.jpg",
      alt: "Godspell production photograph",
      layout: "full",
    },{
  src: "GODSPELL-Revelation-380-2.jpg",
  alt: "Godspell production photograph",
  layout: "full",
},
],

nextProduction: {
  slug: "the-code",
  title: "The Code",
  venue: "Southwark Elephant Playhouse",
  year: 2025,
  image:
    "/images/productions/the-code/A1_00042-Edit.jpg",
},
},

{
  slug: "the-code",
  title: "The Code",
  venue: "Southwark Elephant Playhouse",
  year: 2025,

  description:
    "Dress rehearsal photography created for the production’s publicity campaign.",

  hero: "A1_00042-Edit.jpg",

  heroAlt:
    "The Code at Southwark Elephant Playhouse, photographed by Steve Gregson",

  credits: [
    {
      role: "Venue",
      name: "Southwark Elephant Playhouse",
    },
    {
      role: "Director",
      name: "Christopher Renshaw",
    },
    {
      role: "Lighting Design",
      name: "Jack Weir",
    },
    {
      role: "Set & Costume Design",
      name: "Ethan Cheek",
    },
    {
      role: "Commissioned by",
      name: "Deus Ex Machina Productions",
    },
    {
      role: "Photography",
      name: "Steve Gregson",
    },
  ],

  images: [
    {
      src: "A1_08140.jpg",
      alt: "A silhouetted performer standing before illuminated blinds in The Code",
      layout: "left-small",
    },
    {
      src: "A_100683.jpg",
      alt: "Two performers seated together in The Code",
      layout: "wide",
    },
    {
      src: "A1_08326.jpg",
      alt: "A performer seated at a drinks trolley during The Code",
      layout: "right",
    },
    {
      src: "A1_09448-Edit.jpg",
      alt: "A performer in formal costume holding a drink in The Code",
      layout: "left",
    },
    {
      src: "A1_09554-Edit-Edit-2.jpg",
      alt: "Two performers sharing an intimate moment in The Code",
      layout: "full",
    },
    {
      src: "A1_09554-Edit-Edit.jpg",
      alt: "Two performers seated together on the set of The Code",
      layout: "wide-left",
    },
    {
      src: "A1_09554-Edit.jpg",
      alt: "A close dramatic scene between two performers in The Code",
      layout: "wide-right",
    },
    {
      src: "A1_09791.jpg",
      alt: "Two performers in a tense exchange during The Code",
      layout: "left",
    },
    {
      src: "A1_09801.jpg",
      alt: "A seated performer confronted by another character in The Code",
      layout: "right",
    },
    {
      src: "A9_05819-Edit.jpg",
      alt: "A wide view of the illuminated set for The Code",
      layout: "wide",
    },
    {
      src: "A9_05899-Edit.jpg",
      alt: "The company positioned across the stage in The Code",
      layout: "full",
    },
    {
      src: "A_100642.jpg",
      alt: "A solitary figure silhouetted against the blinds in The Code",
      layout: "left-small",
    },
    {
      src: "A_101276.jpg",
      alt: "A performer standing beneath the Hollywoodland sign in The Code",
      layout: "medium",
    },
    {
      src: "A_101855-Edit.jpg",
      alt: "A performer behind a drinks trolley in The Code",
      layout: "right-small",
    },
    {
      src: "A_101899.jpg",
      alt: "Two performers holding drinks during The Code",
      layout: "wide-left",
    },
    {
      src: "A_102062.jpg",
      alt: "A performer seated on the floor of the set in The Code",
      layout: "full",
    },
    {
},
],
},

{
  slug: "extraordinary-women",
  title: "Extraordinary Women",
  venue: "Jermyn Street Theatre",
  year: 2025,

  description:
    "Dress rehearsal photography created for the production’s publicity campaign.",

  hero: "A9_03345.jpg",

  heroAlt:
    "Extraordinary Women at Jermyn Street Theatre, photographed by Steve Gregson",

  credits: [
    {
      role: "Venue",
      name: "Jermyn Street Theatre",
    },
    {
      role: "Director",
      name: "Paul Foster",
    },
    {
      role: "Choreographer",
      name: "Jo Goodwin",
    },
    {
      role: "Lighting Design",
      name: "Alex Musgrave",
    },
    {
      role: "Set Design",
      name: "Alex Marker",
    },
    {
      role: "Costume Design",
      name: "Carla Joy Evans",
    },
    {
      role: "Commissioned by",
      name: "Jermyn Street Theatre",
    },
    {
      role: "Photography",
      name: "Steve Gregson",
    },
  ],

  images: [
    {
      src: "A9_01916.jpg",
      alt: "The company of Extraordinary Women gathered in a colourful ensemble scene",
      layout: "wide",
    },
    {
      src: "A1_00344.jpg",
      alt: "A performer in period costume during Extraordinary Women",
      layout: "left",
    },
    {
      src: "A1_00516-2.jpg",
      alt: "A performer in a beaded costume beneath warm stage lighting",
      layout: "right-small",
    },
    {
      src: "A1_00715.jpg",
      alt: "Two performers dancing together during Extraordinary Women",
      layout: "wide-left",
    },
    {
      src: "A1_01210.jpg",
      alt: "A performer raising a bottle during Extraordinary Women",
      layout: "left-small",
    },
    {
      src: "A9_02401-Edit.jpg",
      alt: "A performer in a top hat addressing the audience during Extraordinary Women",
      layout: "right",
    },
    {
      src: "A1_00516.jpg",
      alt: "A performer standing beside the bar during Extraordinary Women",
      layout: "full",
    },
  ]    
},
];

export function getProduction(slug: string) {
  const normalisedSlug = decodeURIComponent(slug)
    .trim()
    .toLowerCase();

  return productions.find(
    (production) =>
      production.slug.trim().toLowerCase() === normalisedSlug,
  );
}

export function getNextProduction(slug: string) {
  const normalisedSlug = decodeURIComponent(slug)
    .trim()
    .toLowerCase();

  const currentIndex = productions.findIndex(
    (production) =>
      production.slug.trim().toLowerCase() === normalisedSlug,
  );

  if (currentIndex === -1 || productions.length < 2) {
    return undefined;
  }

  const nextIndex = (currentIndex + 1) % productions.length;

  return productions[nextIndex];
}