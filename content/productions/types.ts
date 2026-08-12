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
  blurDataURL?: string;
  suggestedFilename?: string;
};

export type Production = {
  slug: string;
  title: string;
  venue: string;
  month?: number;
  year: number;
  description: string;
  hero: string;
  heroAlt: string;
  heroBlurDataURL?: string;

  access?: "public" | "password";
  accessPasswordHash?: string;
  accessPasswordEncrypted?: string;
  credits: ProductionCredit[];
  images: ProductionImage[];
};