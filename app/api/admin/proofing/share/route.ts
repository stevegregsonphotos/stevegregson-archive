import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";
import {
  sendProofingGalleryShareEmails,
} from "@/lib/proofing/email";
import {
  getProofingGallery,
  updateProofingGallery,
} from "@/lib/proofing/repository";
import {
  getProofingCompanies,
  getProofingContacts,
} from "@/lib/proofing/contacts-repository";
import type { ProofingGalleryRecipient } from "@/lib/proofing/types";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShareRequest = {
  galleryId?: unknown;
  /* "contacts": just return the address book for the share panel. */
  action?: unknown;
  /* People to add to the gallery's recipients before sending. */
  add?: unknown;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  request: Request,
) {
  if (!isBackstageRequestAuthenticated(request)) {
    return createUnauthorizedResponse();
  }

  let body: ShareRequest;

  try {
    body =
      (await request.json()) as ShareRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid request.",
      },
      {
        status: 400,
      },
    );
  }

  const galleryId =
    typeof body.galleryId === "string"
      ? body.galleryId.trim()
      : "";

  if (!galleryId) {
    return NextResponse.json(
      {
        ok: false,
        message: "Gallery is required.",
      },
      {
        status: 400,
      },
    );
  }

  /*
   * The share panel's address book (name, email, company) for suggestions.
   */
  if (body.action === "contacts") {
    const [contacts, companies] = await Promise.all([
      getProofingContacts(),
      getProofingCompanies(),
    ]);
    const companyNames = new Map(companies.map((c) => [c.id, c.name]));
    return NextResponse.json({
      ok: true,
      contacts: contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        company: contact.companyId
          ? companyNames.get(contact.companyId)
          : undefined,
      })),
    });
  }

  /*
   * Add the people chosen in the share panel to the gallery's recipients
   * (saved contacts by id, or one-off email addresses), then send.
   */
  const toAdd = Array.isArray(body.add) ? body.add : [];
  if (toAdd.length) {
    const [contacts, companies] = await Promise.all([
      getProofingContacts(),
      getProofingCompanies(),
    ]);
    const additions: ProofingGalleryRecipient[] = [];
    for (const item of toAdd.slice(0, 50)) {
      if (!item || typeof item !== "object") continue;
      const entry = item as { contactId?: unknown; email?: unknown };
      const contactId = String(entry.contactId ?? "").trim();
      if (contactId) {
        const contact = contacts.find((c) => c.id === contactId);
        if (!contact) continue;
        additions.push({
          id: randomUUID(),
          contactId: contact.id,
          name: contact.name,
          company: contact.companyId
            ? companies.find((c) => c.id === contact.companyId)?.name
            : undefined,
          email: contact.email.trim().toLowerCase(),
          addedAt: new Date().toISOString(),
        });
        continue;
      }
      const email = String(entry.email ?? "").trim().toLowerCase();
      if (EMAIL.test(email)) {
        additions.push({
          id: randomUUID(),
          email,
          addedAt: new Date().toISOString(),
        });
      }
    }

    if (additions.length) {
      const saved = await updateProofingGallery(galleryId, (current) => {
        const existing = current.recipients ?? [];
        const seen = new Set(existing.map((r) => r.email.toLowerCase()));
        const fresh = additions.filter((r) => {
          if (seen.has(r.email)) return false;
          seen.add(r.email);
          return true;
        });
        return { ...current, recipients: [...existing, ...fresh] };
      });
      if (!saved) {
        return NextResponse.json(
          { ok: false, message: "Gallery not found." },
          { status: 404 },
        );
      }
    }
  }

  const gallery =
    await getProofingGallery(
      galleryId,
    );

  if (!gallery) {
    return NextResponse.json(
      {
        ok: false,
        message: "Gallery not found.",
      },
      {
        status: 404,
      },
    );
  }

  const recipients =
    gallery.recipients ?? [];

  if (recipients.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Add at least one person to send the gallery to.",
      },
      {
        status: 400,
      },
    );
  }

  if (gallery.status !== "live") {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Make the gallery live before sharing it.",
      },
      {
        status: 409,
      },
    );
  }

  try {
    const origin =
      new URL(request.url).origin;

    const galleryUrl =
      `${origin}/proofing/${encodeURIComponent(
        gallery.slug,
      )}`;

    const result =
      await sendProofingGalleryShareEmails({
        galleryTitle:
          gallery.title,
        galleryUrl,
        recipients:
          recipients.map(
            (recipient) => ({
              email:
                recipient.email,
              name:
                recipient.name,
            }),
          ),
      });

    return NextResponse.json({
      ok: true,
      sent: result.sent,
      message:
        `Gallery sent to ${result.sent} recipient${
          result.sent === 1
            ? ""
            : "s"
        }.`,
    });
  } catch (error) {
    console.error(
      "Proofing gallery share failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Gallery could not be shared.",
      },
      {
        status: 500,
      },
    );
  }
}
