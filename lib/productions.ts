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
      { role: "Venue", name: "Kiln Theatre" },
      { role: "Director", name: "Ebenezer Bamgboye" },
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
      slug: "girl-in-the-machine",
      title: "Girl In The Machine",
      venue: "Young Vic Theatre",
      year: 2025,
      image: "/images/productions/girl-in-the-machine/hero.jpg",
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