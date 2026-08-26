import { redirect } from "next/navigation";

import { saveProofingGallery } from "../../../../lib/proofing/repository";
import type { ProofingGallery } from "../../../../lib/proofing/types";

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

    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const now = new Date().toISOString();

    const gallery: ProofingGallery = {
      id,
      slug,

      title,

      clientName: clientName || undefined,
      venue: venue || undefined,

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

    saveProofingGallery(gallery);

    redirect(`/admin/proofing/${id}`);
  }

  return (
    <main className="admin-page">
      <p className="admin-eyebrow">
        Client Proofing
      </p>

      <h1>New Proofing Gallery</h1>

      <p>
        Create the gallery first. Photographs and
        client access will be added afterwards.
      </p>

      <form action={createGallery}>
        <div>
          <label htmlFor="title">
            Gallery title
          </label>

          <input
            id="title"
            name="title"
            type="text"
            required
            placeholder="The Importance of Being Earnest"
          />
        </div>

        <div>
          <label htmlFor="clientName">
            Client
          </label>

          <input
            id="clientName"
            name="clientName"
            type="text"
            placeholder="National Theatre"
          />
        </div>

        <div>
          <label htmlFor="venue">
            Venue
          </label>

          <input
            id="venue"
            name="venue"
            type="text"
            placeholder="National Theatre, London"
          />
        </div>

        <button type="submit">
          Create gallery
        </button>
      </form>
    </main>
  );
}