import Link from "next/link";
import { notFound } from "next/navigation";

import { getProofingGallery } from "../../../../lib/proofing/repository";

import ProofingPresentationEditor from "./ProofingPresentationEditor";
import ProofingSelectionCopy from "./ProofingSelectionCopy";
import ProofingUpload from "./ProofingUpload";

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
      {/* Header */}

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

      {/* Gallery overview */}

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
            <dd>
              {gallery.visitors?.length ?? 0}
            </dd>
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
            <dd>
              {gallery.downloadPermission}
            </dd>
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

      {/* Gallery presentation */}

      <section className="proofing-section">
        <div className="proofing-presentation-heading">
          <div>
            <p className="proofing-section-label">
              Client experience
            </p>

            <h2>Gallery presentation</h2>
          </div>

          <p className="proofing-presentation-heading-copy">
            Choose the opening image and welcome
            message your client sees when entering
            this gallery.
          </p>
        </div>

        <ProofingPresentationEditor
          galleryId={gallery.id}
          initialIntroMessage={
            gallery.introMessage ?? ""
          }
          initialCoverImageId={
            gallery.coverImageId ?? null
          }
          images={gallery.images.map(
            (image) => ({
              id: image.id,

              filename:
                image.originalFilename,

              imageUrl: `/api/admin/proofing/image?galleryId=${encodeURIComponent(
                gallery.id,
              )}&imageId=${encodeURIComponent(
                image.id,
              )}`,
            }),
          )}
        />
      </section>

      {/* Photographs */}

      <section className="proofing-section">
        <h2>Photographs</h2>

        <div className="proofing-upload">
          <ProofingUpload
            galleryId={gallery.id}
          />
        </div>

        {gallery.images.length === 0 ? (
          <p className="proofing-empty">
            No photographs have been uploaded
            to this proofing gallery yet.
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
                  <p>
                    {image.originalFilename}
                  </p>

                  <span>
                    {image.width} ×{" "}
                    {image.height}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Client selections */}

      <section className="proofing-section">
        <div className="proofing-selection-heading">
          <div>
            <p className="proofing-section-label">
              Client activity
            </p>

            <h2>Client selections</h2>
          </div>

          <p className="proofing-selection-total">
            {gallery.visitors?.length ?? 0}{" "}
            identified visitor
            {(gallery.visitors?.length ??
              0) === 1
              ? ""
              : "s"}
          </p>
        </div>

        {gallery.visitors &&
        gallery.visitors.length > 0 ? (
          <div className="proofing-selection-list">
            {gallery.visitors.map(
              (visitor) => {
                const selectedImages =
                  visitor.selection.favourites
                    .map((favourite) =>
                      gallery.images.find(
                        (image) =>
                          image.id ===
                          favourite.imageId,
                      ),
                    )
                    .filter(
                      (
                        image,
                      ): image is NonNullable<
                        typeof image
                      > => Boolean(image),
                    );

                const filenames =
                  selectedImages.map(
                    (image) =>
                      image.originalFilename,
                  );

                return (
                  <article
                    key={visitor.id}
                    className="proofing-selection-card"
                  >
                    <header className="proofing-selection-card-header">
                      <div>
                        <p className="proofing-selection-email">
                          {visitor.email}
                        </p>

                        <p className="proofing-selection-meta">
  {selectedImages.length} photograph
  {selectedImages.length === 1
    ? ""
    : "s"}{" "}
  selected

  <span aria-hidden="true">
    {" "}
    ·{" "}
  </span>

  {visitor.selection.status === "submitted"
    ? "Submitted"
    : visitor.selection.status === "in-progress"
      ? "Selection in progress"
      : "No selection started"}

  {visitor.selection.status === "submitted" &&
  visitor.selection.submittedAt ? (
    <>
      <span aria-hidden="true">
        {" "}
        ·{" "}
      </span>

      {new Date(
        visitor.selection.submittedAt,
      ).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })}
    </>
  ) : null}
</p>
                      </div>

                      <div className="proofing-selection-count">
                        <strong>
                          {
                            selectedImages.length
                          }
                        </strong>

                        <span>
                          Selected
                        </span>
                      </div>
                    </header>

                    {selectedImages.length >
                    0 ? (
                      <>
                        <div className="proofing-selection-thumbnails">
                          {selectedImages.map(
                            (image) => (
                              <figure
                                key={
                                  image.id
                                }
                                className="proofing-selection-thumbnail"
                              >
                                <div className="proofing-selection-thumbnail-image">
                                  <img
                                    src={`/api/admin/proofing/image?galleryId=${encodeURIComponent(
                                      gallery.id,
                                    )}&imageId=${encodeURIComponent(
                                      image.id,
                                    )}`}
                                    alt={
                                      image.alt
                                    }
                                    loading="lazy"
                                  />
                                </div>

                                <figcaption>
                                  {
                                    image.originalFilename
                                  }
                                </figcaption>
                              </figure>
                            ),
                          )}
                        </div>

                        <div className="proofing-selection-actions">
                          <ProofingSelectionCopy
                            filenames={
                              filenames
                            }
                          />
                        </div>
                      </>
                    ) : (
                      <p className="proofing-empty">
                        This visitor has not
                        selected any photographs
                        yet.
                      </p>
                    )}
                  </article>
                );
              },
            )}
          </div>
        ) : gallery.selection?.favourites
            .length ? (
          <div className="proofing-selection-card">
            <p className="proofing-selection-email">
              Legacy anonymous selection
            </p>

            <p className="proofing-selection-meta">
              Created before visitor
              identification was enabled.
            </p>

            <ul className="proofing-legacy-selection">
              {gallery.selection.favourites.map(
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
                    <li
                      key={
                        favourite.imageId
                      }
                    >
                      {
                        image.originalFilename
                      }
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