import Link from "next/link";

import {
  getProofingGalleries,
} from "../../../lib/proofing/repository";

export const dynamic = "force-dynamic";

export default function ProofingPage() {
  const galleries = getProofingGalleries();

  return (
    <main className="proofing-admin">
      <header className="proofing-header">
        <div>
          <p className="proofing-eyebrow">
            Client Proofing
          </p>

          <h1>Proofing Galleries</h1>

          <p className="proofing-subtitle">
            Create private client galleries, review
            selections and export favourites for
            Lightroom.
          </p>
        </div>

        <Link
          href="/admin/proofing/new"
          className="proofing-button"
        >
          New Gallery
        </Link>
      </header>

      {galleries.length === 0 ? (
        <section className="proofing-section">
          <p className="proofing-empty">
            No proofing galleries yet.
          </p>

          <Link
            href="/admin/proofing/new"
            className="proofing-back-link"
          >
            Create your first client gallery →
          </Link>
        </section>
      ) : (
        <section className="proofing-gallery-browser">
          {galleries.map((gallery) => {
            const visitorCount =
              gallery.visitors?.length ?? 0;

            const favouriteCount =
              gallery.visitors?.length
                ? gallery.visitors.reduce(
                    (total, visitor) =>
                      total +
                      visitor.selection.favourites
                        .length,
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

            const createdDate =
              new Date(
                gallery.createdAt,
              ).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              });

            return (
              <article
                key={gallery.id}
                className="proofing-browser-card"
              >
                <Link
                  href={`/admin/proofing/${gallery.id}`}
                  className="proofing-browser-card-link"
                >
                  <div className="proofing-browser-cover">
                    {coverImageUrl ? (
                      <img
                        src={coverImageUrl}
                        alt=""
                      />
                    ) : (
                      <div className="proofing-browser-cover-empty">
                        No cover image
                      </div>
                    )}

                    <span
                      className={`proofing-browser-status proofing-browser-status-${gallery.status}`}
                    >
                      {gallery.status}
                    </span>
                  </div>

                  <div className="proofing-browser-info">
                    <div className="proofing-browser-heading">
                      <h2>{gallery.title}</h2>

                      <span aria-hidden="true">
                        ⋮
                      </span>
                    </div>

                    <div className="proofing-browser-meta">
                      <div>
                        <span>{createdDate}</span>

                        <span>
                          {gallery.images.length} item
                          {gallery.images.length === 1
                            ? ""
                            : "s"}
                        </span>
                      </div>

                      <div>
                        <span>
                          {gallery.clientName ??
                            "No client"}
                        </span>

                        {gallery.venue ? (
                          <span>{gallery.venue}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="proofing-browser-stats">
                      <span>
                        {visitorCount} visitor
                        {visitorCount === 1
                          ? ""
                          : "s"}
                      </span>

                      <span>
                        {favouriteCount} favourite
                        {favouriteCount === 1
                          ? ""
                          : "s"}
                      </span>
                    </div>
                  </div>
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}