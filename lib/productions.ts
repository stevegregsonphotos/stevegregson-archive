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
  description: string;
  hero: string;
  heroAlt: string;
  credits: ProductionCredit[];
  images: ProductionImage[];
  nextProduction?: {
    slug: string;
    title: string;
    image: string;
  };
};

export const productions: Production[] = [
  {
    slug: "lonely-londoners",
    title: "The Lonely Londoners",
    venue: "Kiln Theatre",
    description:
      "Dress rehearsal photography created for the production’s publicity campaign.",
    hero:
      "ProofOnly-LonelyLondoners-113-Enhanced-NR-Edit.jpg",
    heroAlt:
      "The Lonely Londoners at Kiln Theatre, photographed by Steve Gregson",
    credits: [
      {
        role: "Venue",
        name: "Kiln Theatre",
      },
      {
        role: "Director",
        name: "Ebenezer Bamgboye",
      },
      {
        role: "Lighting Design",
        name: "Elliot Griggs",
      },
      {
        role: "Set & Costume Design",
        name: "Laura Ann Price",
      },
      {
        role: "Commissioned by",
        name: "Kiln Theatre",
      },
      {
        role: "Photography",
        name: "Steve Gregson",
      },
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
  },
];

export function getProduction(slug: string) {
  return productions.find((production) => production.slug === slug);
}