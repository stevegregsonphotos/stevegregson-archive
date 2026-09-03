import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getProofingGalleries,
  saveProofingGallery,
} from "../../../lib/proofing/repository";

import type {
  ProofingGallery,
} from "../../../lib/proofing/types";

import {
  getDefaultProofingIntroTemplate,
} from "../../../lib/proofing/intro-templates";

import ProofingGalleryBrowser from "./ProofingGalleryBrowser";
import NewGalleryModal from "./NewGalleryModal";

export const dynamic = "force-dynamic";

export default function ProofingPage() {
  async function createGallery(
    formData: FormData,
  ) {
    "use server";

    const title = String(
      formData.get("title") ?? "",
    ).trim();

    const clientName = String(
      formData.get("clientName") ?? "",
    ).trim();

    const shootDate = String(
      formData.get("shootDate") ?? "",
    ).trim();

    if (!title || !shootDate) {
      return;
    }

    const id = crypto.randomUUID();

    const baseSlug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!baseSlug) {
      return;
    }

    const existingSlugs = new Set(
      getProofingGalleries().map(
        (gallery) =>
          gallery.slug
            .trim()
            .toLowerCase(),
      ),
    );

    let slug = baseSlug;
    let suffix = 2;

    while (existingSlugs.has(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const now = new Date().toISOString();

    const defaultIntroTemplate =
      getDefaultProofingIntroTemplate();

    const gallery: ProofingGallery = {
      id,
      slug,
      title,

      clientName:
        clientName || undefined,

      shootDate,

      introMessage:
        defaultIntroTemplate?.message ??
        "",

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

    redirect(
      `/admin/proofing/${id}`,
    );
  }

  const galleries =
    getProofingGalleries().sort(
      (first, second) =>
        new Date(
          second.createdAt,
        ).getTime() -
        new Date(
          first.createdAt,
        ).getTime(),
    );

  const galleryItems = galleries.map(
    (gallery) => {
      const visitorCount =
        gallery.visitors?.length ?? 0;

      const favouriteCount =
        gallery.visitors?.length
          ? gallery.visitors.reduce(
              (total, visitor) =>
                total +
                visitor.selection
                  .favourites.length,
              0,
            )
          : gallery.selection?.favourites
              .length ?? 0;

      const coverImage =
        gallery.coverImageId
          ? gallery.images.find(
              (image) =>
                image.id ===
                gallery.coverImageId,
            )
          : gallery.images[0];

      const coverImageUrl = coverImage
        ? `/api/admin/proofing/image?galleryId=${encodeURIComponent(
            gallery.id,
          )}&imageId=${encodeURIComponent(
            coverImage.id,
          )}`
        : null;

      return {
        id: gallery.id,
        title: gallery.title,
        clientName: gallery.clientName,
        venue: gallery.venue,
        status: gallery.status,
        createdAt: gallery.createdAt,
        expiresAt: gallery.expiresAt,
        imageCount: gallery.images.length,
        visitorCount,
        favouriteCount,
        coverImageUrl,
      };
    },
  );

  return (
    <main className="sp-galleries-page">
      <div className="sp-galleries-shell">
        <header className="sp-galleries-header">
          <div className="sp-galleries-heading">
            <div
              className="sp-galleries-heading-icon"
              aria-hidden="true"
            >
              <span />
              <span />
            </div>

            <div>
              <p className="proofing-eyebrow">
                Client proofing
              </p>

              <h1>Galleries</h1>

              <p>
                Manage your galleries and
                deliver proofs to your clients.
              </p>
            </div>
          </div>

          <div className="sp-galleries-header-actions">
            <Link
              href="/admin/proofing/watermarks"
              className="sp-galleries-text-action"
            >
              Watermarks
            </Link>

            <NewGalleryModal
              createGallery={createGallery}
            />
          </div>
        </header>

        {galleries.length === 0 ? (
          <section className="sp-gallery-first">
            <h2>
              Create your first gallery
            </h2>

            <p>
              Upload photographs, invite a
              client and collect their
              selections.
            </p>

            <NewGalleryModal
              createGallery={createGallery}
            />
          </section>
        ) : (
          <ProofingGalleryBrowser
            galleries={galleryItems}
          />
        )}
      </div>
    </main>
  );
}
