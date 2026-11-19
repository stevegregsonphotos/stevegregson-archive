import { NextResponse } from "next/server";

import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  createClientArchiveViewUrl,
  listClientArchive,
  listClientArchiveFilesRecursive,
} from "@/lib/client-archive/storage";
import { matchPhotos, scoreShowFolder } from "@/lib/production-download/match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Backstage › Productions › Edit › Download photos.
 * Finds the production's folder in Storage and pairs each website photo with
 * Steve's Full and Web JPEGs there. Only hands out links: the browser builds
 * the zip itself (files stream straight from Storage), so nothing large
 * passes through Vercel.
 */

type Folder = { name: string; path: string };

async function allSubfolders(path: string) {
  const folders: Folder[] = [];
  let cursor: string | undefined;
  do {
    const page = await listClientArchive(path, cursor);
    folders.push(...page.folders);
    cursor = page.truncated ? page.nextCursor : undefined;
  } while (cursor && folders.length < 2000);
  return folders;
}

/** Client folders, then the show folders inside each (and inside any year folders). */
async function findShowFolder(show: { title: string; venue: string; month: number | null; year: number }) {
  const clients = await allSubfolders("");
  const candidates: Folder[] = [];
  await Promise.all(clients.map(async (client) => {
    const shows = await allSubfolders(client.path);
    candidates.push(...shows);
    const yearFolders = shows.filter((folder) => /^(19|20)\d\d$/.test(folder.name.trim()));
    for (const yearFolder of yearFolders) candidates.push(...await allSubfolders(yearFolder.path));
  }));
  const venueWords = show.venue.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
  const scored = candidates
    .map((folder) => {
      const client = folder.path.split("/")[0].toLowerCase();
      const venueBonus = venueWords.some((word) => client.includes(word)) ? 0.3 : 0;
      return { folder, score: scoreShowFolder(folder.name, show) + venueBonus };
    })
    .filter((item) => item.score >= 0.75)
    .sort((a, b) => b.score - a.score || a.folder.path.localeCompare(b.folder.path));
  return scored[0]?.folder.path ?? null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) return createUnauthorizedResponse();
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const action = text(body.action);

  try {
    if (action === "folders") {
      // For "Choose a folder": one level of Storage at a time.
      const path = text(body.path).replace(/^\/+|\/+$/g, "");
      if (path.split("/")[0] === ".trash") return NextResponse.json({ ok: false, message: "Invalid folder." }, { status: 400 });
      return NextResponse.json({ ok: true, path, folders: await allSubfolders(path) });
    }

    if (action !== "match") return NextResponse.json({ ok: false, message: "Unknown action." }, { status: 400 });

    const filenames = Array.isArray(body.filenames) ? body.filenames.map(String).filter(Boolean).slice(0, 500) : [];
    const show = {
      title: text(body.title),
      venue: text(body.venue),
      month: typeof body.month === "number" ? body.month : null,
      year: Number(body.year) || 0,
    };
    if (!filenames.length || !show.title) return NextResponse.json({ ok: false, message: "Nothing to match." }, { status: 400 });

    const chosen = text(body.folder).replace(/^\/+|\/+$/g, "");
    if (chosen.split("/")[0] === ".trash") return NextResponse.json({ ok: false, message: "Invalid folder." }, { status: 400 });
    const folder = chosen || await findShowFolder(show);
    if (!folder) return NextResponse.json({ ok: true, folder: null, photos: filenames.map(() => ({})) });

    let files;
    try {
      files = (await listClientArchiveFilesRecursive(folder, 8000)).filter((file) => file.name !== ".folder");
    } catch (error) {
      const message = error instanceof Error && /more than/.test(error.message)
        ? "That folder is too big to search (over 8,000 files). Choose the show's own folder."
        : "Couldn't read that Storage folder.";
      return NextResponse.json({ ok: false, message }, { status: 400 });
    }

    const matches = matchPhotos(filenames, files, show.title);
    const link = async (file: { name: string; path: string; objectKey: string; sizeBytes: number } | undefined) => file && ({
      name: file.name,
      path: file.path,
      objectKey: file.objectKey,
      size: file.sizeBytes,
      url: await createClientArchiveViewUrl(file.objectKey, 12 * 60 * 60),
    });
    const photos = await Promise.all(matches.map(async (match) => ({
      full: await link(match.full),
      web: await link(match.web),
    })));
    return NextResponse.json({ ok: true, folder, photos });
  } catch (error) {
    console.error("Production download request failed", error);
    return NextResponse.json(
      { ok: false, message: "Storage couldn't be reached: " + (error instanceof Error ? error.message : "unknown error") },
      { status: 500 },
    );
  }
}
