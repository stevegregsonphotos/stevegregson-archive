export type VisionImage = {
  filename: string;
  previewUrl: string;
  heroScore: number;
  technicalScore: number;
  width: number | null;
  height: number | null;
  orientation: "landscape" | "portrait" | "square" | "unknown";
};

export type VisionProduction = {
  title: string;
  venue: string;
  year: string;
  description: string;
};

export type VisionReviewRequest = {
  production: VisionProduction;
  images: VisionImage[];
};

export type VisionReviewResponse = {
  hero: string;
  heroReason: string;

  keep: string[];
  remove: string[];

  sequence: string[];

  editorialSummary: string;
};