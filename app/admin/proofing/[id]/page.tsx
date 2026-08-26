import Link from "next/link";
import { notFound } from "next/navigation";

import { getProofingGallery } from "../../../../lib/proofing/repository";
import ProofingUpload from "./ProofingUpload";
import ProofingSelectionCopy from "./ProofingSelectionCopy";

export const dynamic = "force-dynamic";

type ProofingGalleryPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProofingGalleryPage({
  params,
}: ProofingGalleryPageProps) {
  const { id } = await params;
  const gallery = getProofingGallery(id);

  if (!gallery) {
    notFound();
  }

  const visitorFavouriteCount =
    gallery.visitors?.reduce(
      (total, visitor) =>
        total +
        visitor.selection.favourites.length,
      0,
    ) ?? 0;

  const legacyFavouriteCount =
    gallery.selection?.favourites.length ?? 0;

  const totalFavouriteCount =
    visitorFavouriteCount || legacyFavouriteCount;

  return (
    <main className="proofing-admin">
      <header className="proofing-header">
        <div>
          <p className="proofing-eyebrow">
            Client Proofing
          </p>

          <h1>{gallery.title}</h1>

          <p className="proofing-subtitle">
            {gallery.clientName ?? "No client name"}

            {gallery.venue ? (
              <>
                <span aria-hidden="true">
                  {" "}
                  ·{" "}
                </span>

                {gallery.venue}
              </>
            ) : null}
          </p>
        </div>

        <Link
          href="/admin/proofing"
          className="proofing-back-link"
        >
          ← Proofing galleries
        </Link>
      </header>

      <section className="proofing-section">
        <h2>Gallery overview</h2>

        <dl className="proofing-details">
          <div>
            <dt>Status</dt>
            <dd>{gallery.status}</dd>
          </div>

          <div>
            <dt>Photographs</dt>
            <dd>{gallery.images.length}</dd>
          </div>

          <div>
            <dt>Visitors</dt>
            <dd>{gallery.visitors?.length ?? 0}</dd>
          </div>

          <div>
            <dt>Total favourites</dt>
            <dd>{totalFavouriteCount}</dd>
          </div>

          <div>
            <dt>Gallery slug</dt>
            <dd>{gallery.slug}</dd>
          </div>

          <div>
            <dt>Downloads</dt>
            <dd>{gallery.downloadPermission}</dd>
          </div>

          <div>
            <dt>Watermark</dt>
            <dd>
              {gallery.watermarkEnabled
                ? "Enabled"
                : "Disabled"}
            </dd>
          </div>

          <div>
            <dt>Access</dt>
            <dd>
              {gallery.passwordHash
                ? "Password protected"
                : "Not protected"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="proofing-section">
        <h2>Photographs</h2>

        <div className="proofing-upload">
          <ProofingUpload galleryId={gallery.id} />
        </div>

        {gallery.images.length === 0 ? (
          <p className="proofing-empty">
            No photographs have been uploaded to this
            proofing gallery yet.
          </p>
        ) : (
          <div className="proofing-image-grid">
            {gallery.images.map((image) => (
              <article
                key={image.id}
                className="proofing-image-card"
              >
                <div className="proofing-image-frame">
                  <img
                    src={`/api/admin/proofing/image?galleryId=${encodeURIComponent(
                      gallery.id,
                    )}&imageId=${encodeURIComponent(
                      image.id,
                    )}`}
                    alt={image.alt}
                    loading="lazy"
                  />
                </div>

                <div className="proofing-image-meta">
                  <p>{image.originalFilename}</p>

                  <span>
                    {image.width} × {image.height}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="proofing-section">
        <h2>Client selections</h2>

        {gallery.visitors &&
        gallery.visitors.length > 0 ? (
          <div>
            {gallery.visitors.map((visitor) => (
              <article key={visitor.id}>
                <h3>{visitor.email}</h3>

                <p>
                  {
                    visitor.selection.favourites
                      .length
                  }{" "}
                  favourite
                  {visitor.selection.favourites
                    .length === 1
                    ? ""
                    : "s"}
                </p>
<ProofingSelectionCopy
  filenames={visitor.selection.favourites
    .map((favourite) => {
      const image = gallery.images.find(
        (candidate) =>
          candidate.id === favourite.imageId,
      );

      return image?.originalFilename;
    })
    .filter(
      (filename): filename is string =>
        Boolean(filename),
    )}
/>

                {visitor.selection.favourites.length >
                0 ? (
                  <ul>
                    {visitor.selection.favourites.map(
                      (favourite) => {
                        const image =
                          gallery.images.find(
                            (candidate) =>
                              candidate.id ===
                              favourite.imageId,
                          );

                        if (!image) {
                          return null;
                        }

                        return (
                          <li key={favourite.imageId}>
                            {image.originalFilename}
                          </li>
                        );
                      },
                    )}
                  </ul>
                ) : (
                  <p className="proofing-empty">
                    No favourites yet.
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : gallery.selection?.favourites.length ? (
          <div>
            <p className="proofing-empty">
              Legacy anonymous selection
            </p>

            <ul>
              {gallery.selection.favourites.map(
                (favourite) => {
                  const image = gallery.images.find(
                    (candidate) =>
                      candidate.id ===
                      favourite.imageId,
                  );

                  if (!image) {
                    return null;
                  }

                  return (
                    <li key={favourite.imageId}>
                      {image.originalFilename}
                    </li>
                  );
                },
              )}
            </ul>
          </div>
        ) : (
          <p className="proofing-empty">
            No client selections yet.
          </p>
        )}
      </section>
    </main>
  );
}