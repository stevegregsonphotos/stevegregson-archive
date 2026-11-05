import { revalidatePath, revalidateTag } from "next/cache";

import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  ABOUT_PORTRAIT_FOLDER,
  cleanAboutPortrait,
  getAboutPortrait,
  isSafeAboutFilename,
  saveAboutPortrait,
} from "@/lib/about-portrait";
import { PUBLIC_SELECTED_WORK_TAG } from "@/lib/public-data-cache";
import {
  createSelectedWorkUploadUrl,
  selectedWorkObjectExists,
  selectedWorkStorageKey,
} from "@/lib/selected-work-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Backstage › Settings › About page photo. The browser edits the photo and
// uploads straight to the image store; this only hands out upload links and
// saves which files the About page should show.

const CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  try {
    const action = String(body.action ?? "");

    if (action === "current") {
      return Response.json({ ok: true, portrait: await getAboutPortrait() });
    }

    if (action === "presign") {
      const contentType = String(body.contentType ?? "");
      const extension = CONTENT_TYPES[contentType];
      const kind = body.kind === "original" ? "original" : "display";
      if (!extension) {
        return Response.json({ ok: false, message: "Please use a JPEG, PNG or WebP photo." }, { status: 400 });
      }
      const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
      const filename = `steve-gregson-${kind}-${stamp}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
      const uploadUrl = await createSelectedWorkUploadUrl(
        selectedWorkStorageKey(ABOUT_PORTRAIT_FOLDER, filename),
        contentType,
      );
      return Response.json({ ok: true, filename, uploadUrl });
    }

    if (action === "save") {
      const portrait = cleanAboutPortrait({ ...(body.portrait as object), updatedAt: new Date().toISOString() });
      if (!portrait) {
        return Response.json({ ok: false, message: "The photo details weren't complete." }, { status: 400 });
      }
      for (const filename of [portrait.original, portrait.display]) {
        if (!isSafeAboutFilename(filename) || !(await selectedWorkObjectExists(selectedWorkStorageKey(ABOUT_PORTRAIT_FOLDER, filename)))) {
          return Response.json({ ok: false, message: "The photo didn't finish uploading. Please try again." }, { status: 400 });
        }
      }
      await saveAboutPortrait(portrait);
      revalidateTag(PUBLIC_SELECTED_WORK_TAG, { expire: 0 });
      revalidatePath("/about");
      return Response.json({ ok: true, portrait });
    }

    return Response.json({ ok: false, message: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("About page photo request failed", error);
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : "Something went wrong." },
      { status: 500 },
    );
  }
}
