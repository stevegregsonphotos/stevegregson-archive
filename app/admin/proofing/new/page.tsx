import { redirect } from "next/navigation";

import {
  getProofingGalleries,
  saveProofingGallery,
} from "../../../../lib/proofing/repository";
import type { ProofingGallery } from "../../../../lib/proofing/types";
import { getDefaultProofingIntroTemplate } from "../../../../lib/proofing/intro-templates";

export default function NewProofingGalleryPage() {
  async function createGallery(formData: FormData) {
    "use server";

    const title = String(
      formData.get("title") ?? "",
    ).trim();

    const clientName = String(
      formData.get("clientName") ?? "",
    ).trim();

    const venue = String(
      formData.get("venue") ?? "",
    ).trim();

    if (!title) {
      return;
    }

    const id = crypto.randomUUID();

    const requestedSlug = String(
      formData.get("slug") ?? "",
    ).trim();

    const slugSource = requestedSlug || title;

    const slug = slugSource
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const duplicateGallery = (await getProofingGalleries()).find(
      (gallery) =>
        gallery.slug.trim().toLowerCase() === slug,
    );

    if (duplicateGallery) {
      return;
    }

    const now = new Date().toISOString();

    const defaultIntroTemplate =
      getDefaultProofingIntroTemplate();

    const gallery: ProofingGallery = {
      id,
      slug,

      title,

      clientName: clientName || undefined,
      venue: venue || undefined,

      introMessage:
        defaultIntroTemplate?.message ?? "",

      createdAt: now,
      updatedAt: now,

      status: "draft",

      downloadPermission: "none",
      watermarkEnabled: false,

      images: [],

visitors: [],

selection: {
  status: "not-started",
  favourites: [],
},
    };

    await saveProofingGallery(gallery);

    redirect(`/admin/proofing/${id}`);
  }

  return (
    <main className="proofing-new-gallery">
      <div className="proofing-new-gallery-shell">
        <header className="proofing-new-gallery-header">
          <p className="proofing-new-gallery-eyebrow">
            Client Proofing
          </p>

          <h1>New Proofing Gallery</h1>

          <p className="proofing-new-gallery-intro">
            Create a private gallery for your client.
            Photographs and presentation can be added
            after the gallery has been created.
          </p>
        </header>

        <form
          action={createGallery}
          className="proofing-new-gallery-form"
        >
          <div className="proofing-new-gallery-field">
            <label htmlFor="title">
              Gallery title
            </label>

            <input
              id="title"
              name="title"
              type="text"
              required
            />
          </div>

          <div className="proofing-new-gallery-field">
            <label htmlFor="slug">
              Gallery URL
            </label>

            <div className="proofing-new-gallery-url">
              <span>/proofing/</span>

              <input
                id="slug"
                name="slug"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            <p className="proofing-new-gallery-help">
              Optional — leave blank and the URL will
              be created automatically from the gallery
              title. You can change it later.
            </p>
          </div>

          <div className="proofing-new-gallery-row">
            <div className="proofing-new-gallery-field">
              <label htmlFor="clientName">
                Client
              </label>

              <input
                id="clientName"
                name="clientName"
                type="text"
              />
            </div>

            <div className="proofing-new-gallery-field">
              <label htmlFor="venue">
                Venue
              </label>

              <input
                id="venue"
                name="venue"
                type="text"
              />
            </div>
          </div>

          <div className="proofing-new-gallery-actions">
            <button type="submit">
              Create gallery
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
