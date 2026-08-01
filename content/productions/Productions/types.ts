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

export type ProductionLink = {
  slug: string;
  title: string;
  image: string;
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
  nextProduction?: ProductionLink;
};