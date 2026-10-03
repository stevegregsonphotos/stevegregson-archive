import "server-only";

import { getSiteContent, saveSiteContent } from "./site-content-repository";
import {
  UPCOMING_LIMITS,
  UPCOMING_PRODUCTIONS_KEY,
  createUpcomingId,
  readUpcomingStore,
  sortUpcoming,
  tidyCreditsForSave,
  type UpcomingDraft,
  type UpcomingDraftInput,
} from "./upcoming-productions";

/*
 * Backstage-only storage for Upcoming productions (see
 * lib/upcoming-productions.ts). Only the /api/admin/upcoming-productions
 * route and the Backstage Productions page use this file.
 */

export class UpcomingStoreError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function listUpcomingDrafts() {
  const store = readUpcomingStore(await getSiteContent<unknown>(UPCOMING_PRODUCTIONS_KEY));
  return sortUpcoming(store.drafts);
}

export async function getUpcomingDraft(id: string) {
  const store = readUpcomingStore(await getSiteContent<unknown>(UPCOMING_PRODUCTIONS_KEY));
  return store.drafts.find((draft) => draft.id === id) ?? null;
}

async function writeDrafts(drafts: UpcomingDraft[]) {
  const value = { version: 1, drafts };
  if (JSON.stringify(value).length > UPCOMING_LIMITS.totalJson) {
    throw new UpcomingStoreError(
      "There isn't room to save this. Try shortening the notes, or delete drafts you no longer need.",
      413,
    );
  }
  await saveSiteContent(UPCOMING_PRODUCTIONS_KEY, value);
}

async function loadForWrite() {
  return readUpcomingStore(await getSiteContent<unknown>(UPCOMING_PRODUCTIONS_KEY)).drafts;
}

export async function createUpcomingDraft(input: UpcomingDraftInput) {
  const drafts = await loadForWrite();
  if (drafts.length >= UPCOMING_LIMITS.drafts) {
    throw new UpcomingStoreError("You've reached the limit for upcoming drafts. Delete some old ones first.");
  }
  const now = new Date().toISOString();
  const draft: UpcomingDraft = {
    id: createUpcomingId(),
    ...input,
    credits: tidyCreditsForSave(input.credits),
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
  await writeDrafts([...drafts, draft]);
  return draft;
}

export async function updateUpcomingDraft(id: string, input: UpcomingDraftInput) {
  const drafts = await loadForWrite();
  const existing = drafts.find((draft) => draft.id === id);
  if (!existing) throw new UpcomingStoreError("That upcoming production could not be found.", 404);
  const updated: UpcomingDraft = {
    ...existing,
    ...input,
    credits: tidyCreditsForSave(input.credits),
    updatedAt: new Date().toISOString(),
  };
  await writeDrafts(drafts.map((draft) => (draft.id === id ? updated : draft)));
  return updated;
}

export async function markUpcomingDraftPublished(id: string, publishedUrl: string) {
  const drafts = await loadForWrite();
  const existing = drafts.find((draft) => draft.id === id);
  if (!existing) throw new UpcomingStoreError("That upcoming production could not be found.", 404);
  const now = new Date().toISOString();
  const updated: UpcomingDraft = {
    ...existing,
    status: "published",
    publishedAt: now,
    updatedAt: now,
  };
  if (publishedUrl.startsWith("/")) updated.publishedUrl = publishedUrl.slice(0, 300);
  await writeDrafts(drafts.map((draft) => (draft.id === id ? updated : draft)));
  return updated;
}

export async function deleteUpcomingDraft(id: string) {
  const drafts = await loadForWrite();
  if (!drafts.some((draft) => draft.id === id)) {
    throw new UpcomingStoreError("That upcoming production could not be found.", 404);
  }
  await writeDrafts(drafts.filter((draft) => draft.id !== id));
}
