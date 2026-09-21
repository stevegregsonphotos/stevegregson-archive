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
  originalSrc?: string;
  editAspect?: "original" | "3:2" | "4:5" | "1:1" | "16:9";
  editZoom?: number;
  editPanX?: number;
  editPanY?: number;
  editBrightness?: number;
  editAutoStrength?: number;
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
  showHeroWhenLocked?: boolean;
    accessPasswordEncrypted?: string;
  credits: ProductionCredit[];
  images: ProductionImage[];
};