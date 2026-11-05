import "server-only";

import { getCachedAboutPortraitRaw } from "./public-data-cache";
import { getSelectedWorkImageUrl } from "./selected-work-image-url";
import { getSiteContent, saveSiteContent } from "./site-content-repository";

/*
 * The photo on the About page. Edited in Backstage › Settings › About page
 * photo with the same editor as Selected Work (crop, zoom, auto, brightness).
 * Files live in the Selected Work image store under selected-work/about/:
 * the untouched original (so it can be re-edited from scratch) and the
 * edited version the page shows. Until one is saved, the page uses the
 * photo built into the site.
 */

export const ABOUT_PORTRAIT_KEY = "about-portrait";
export const ABOUT_PORTRAIT_FOLDER = "about";
export const DEFAULT_ABOUT_PORTRAIT_SRC = "/images/portrait/steve-gregson.webp";

export type AboutPortraitSettings = {
  aspect: "original" | "3:2" | "4:5" | "1:1" | "16:9";
  zoom: number;
  panX: number;
  panY: number;
  brightness: number;
  autoStrength: number;
};

export type AboutPortrait = {
  original: string; // filename in selected-work/about/
  display: string; // filename in selected-work/about/
  width: number;
  height: number;
  settings: AboutPortraitSettings;
  updatedAt: string;
};

const ASPECTS = ["original", "3:2", "4:5", "1:1", "16:9"] as const;
const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp)$/i;

export function isSafeAboutFilename(value: unknown): value is string {
  return typeof value === "string" && SAFE_FILENAME.test(value);
}

function num(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function cleanAboutPortrait(value: unknown): AboutPortrait | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const s = (v.settings && typeof v.settings === "object" ? v.settings : {}) as Record<string, unknown>;
  if (!isSafeAboutFilename(v.original) || !isSafeAboutFilename(v.display)) return null;
  const width = Math.round(Number(v.width));
  const height = Math.round(Number(v.height));
  if (!(width > 0 && height > 0)) return null;
  return {
    original: v.original,
    display: v.display,
    width,
    height,
    settings: {
      aspect: ASPECTS.includes(s.aspect as (typeof ASPECTS)[number]) ? (s.aspect as AboutPortraitSettings["aspect"]) : "original",
      zoom: num(s.zoom, 1, 8, 1),
      panX: num(s.panX, -1, 1, 0),
      panY: num(s.panY, -1, 1, 0),
      brightness: num(s.brightness, 20, 200, 100),
      autoStrength: num(s.autoStrength, 0, 100, 0),
    },
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : new Date().toISOString(),
  };
}

export function aboutPortraitUrl(filename: string) {
  return getSelectedWorkImageUrl(ABOUT_PORTRAIT_FOLDER, filename);
}

/** For Backstage (always fresh). */
export async function getAboutPortrait() {
  return cleanAboutPortrait(await getSiteContent<unknown>(ABOUT_PORTRAIT_KEY));
}

export async function saveAboutPortrait(portrait: AboutPortrait) {
  await saveSiteContent(ABOUT_PORTRAIT_KEY, portrait);
}

/** For the public About page (cached until Backstage saves a new one). */
export async function getPublicAboutPortrait(): Promise<{ src: string; width?: number; height?: number }> {
  try {
    const portrait = cleanAboutPortrait(await getCachedAboutPortraitRaw());
    if (portrait) {
      return { src: aboutPortraitUrl(portrait.display), width: portrait.width, height: portrait.height };
    }
  } catch (error) {
    console.error("Could not read the About page photo", error);
  }
  return { src: DEFAULT_ABOUT_PORTRAIT_SRC };
}
