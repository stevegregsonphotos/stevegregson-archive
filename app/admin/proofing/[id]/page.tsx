import Link from "next/link";
import { notFound } from "next/navigation";

import { getProofingGallery } from "../../../../lib/proofing/repository";
import { getProofingWatermarks } from "../../../../lib/proofing/watermarks";
import { getProofingIntroTemplates } from "../../../../lib/proofing/intro-templates";
import ProofingImageActions from "./ProofingImageActions";
import ProofingImageSort from "./ProofingImageSort";
import ProofingPresentationEditor from "./ProofingPresentationEditor";
import ProofingSelectionCopy from "./ProofingSelectionCopy";
import ProofingUrlEditor from "./ProofingUrlEditor";
import ProofingSettingsEditor from "./ProofingSettingsEditor";
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

  const introTemplates =
    getProofingIntroTemplates();

  const gallery = getProofingGallery(id);

  if (!gallery) {
    notFound();
  }

  const watermarks = getProofingWatermarks();

  const orderedImages = [...gallery.images].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

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
      {/* Gallery workspace header */}

      <div className="proofing-gallery-workspace-top">
        <Link
          href="/admin/proofing"
          className="proofing-back-link"
        >
          ← All galleries
        </Link>

        <div className="proofing-gallery-workspace-heading">
          <div>
            <div className="proofing-gallery-title-row">
              <h1>{gallery.title}</h1>

              <span
                className={`proofing-workspace-status proofing-workspace-status-${gallery.status}`}
              >
                {gallery.status}
              </span>
            </div>

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

          <div className="proofing-gallery-workspace-actions">
            <Link
              href={`/proofing/${gallery.slug}`}
              className="proofing-button proofing-button-secondary"
              target="_blank"
            >
              View Client Gallery
            </Link>
          </div>
        </div>

        <nav
          className="proofing-gallery-workspace-nav"
          aria-label="Gallery management"
        >
          <a href="#overview">
            Overview
          </a>

          <a href="#photos">
            Photos
            <span>{gallery.images.length}</span>
          </a>

          <a href="#presentation">
            Presentation
          </a>

          <a href="#selections">
            Selections
            <span>
              {gallery.visitors?.length ?? 0}
            </span>
          </a>
        </nav>
      </div>

      {/* Overview */}

      <section
        className="proofing-section"
        id="overview"
      >
        <div className="proofing-section-heading-row">
          <div>
            <p className="proofing-section-label">
              Gallery
            </p>

            <h2>Overview</h2>
          </div>
        </div>

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
            <dt>Gallery URL</dt>
            <dd>
              <ProofingUrlEditor
                galleryId={gallery.id}
                initialSlug={gallery.slug}
              />
            </dd>
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
                : "Email access"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Access and delivery */}

      <section
        className="proofing-section"
        id="access"
      >
        <div className="proofing-presentation-heading">
          <div>
            <p className="proofing-section-label">
              Client access
            </p>

            <h2>Access &amp; delivery</h2>
          </div>

          <p className="proofing-presentation-heading-copy">
            Control when this gallery is available and
            what your client can do with the photographs.
          </p>
        </div>

        <ProofingSettingsEditor
          galleryId={gallery.id}
          initialStatus={gallery.status}
          initialDownloadPermission={
            gallery.downloadPermission === "full"
              ? "web"
              : gallery.downloadPermission
          }
          initialWatermarkEnabled={
            gallery.watermarkEnabled
          }
          initialWatermarkId={gallery.watermarkId}
          initialWatermarkPosition={
            gallery.watermarkPosition
          }
          initialWatermarkSize={
            gallery.watermarkSize
          }
          initialWatermarkOpacity={
            gallery.watermarkOpacity
          }
          previewImageUrl={
            orderedImages[0]
              ? `/api/admin/proofing/image?galleryId=${encodeURIComponent(
                  gallery.id,
                )}&imageId=${encodeURIComponent(
                  orderedImages[0].id,
                )}`
              : "/images/selected-work/rehearsal/full-echo-rehearsals-stevegregson-04138.jpg"
          }
          initialExpiresAt={gallery.expiresAt}
          watermarks={watermarks.map(
            (watermark) => ({
              id: watermark.id,
              name: watermark.name,
            }),
          )}
        />
      </section>

      {/* Gallery presentation */}

      <section
        className="proofing-section"
        id="presentation"
      >
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
          introTemplates={introTemplates}
          images={orderedImages.map(
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

      <section
        className="proofing-section"
        id="photos"
      >
        <div className="proofing-section-heading-row">
          <div>
            <p className="proofing-section-label">
              Gallery images
            </p>

            <h2>Photographs</h2>
          </div>

          <p className="proofing-selection-total">
            {gallery.images.length} photograph
            {gallery.images.length === 1
              ? ""
              : "s"}
          </p>
        </div>
        
<ProofingImageSort
  galleryId={gallery.id}
  images={orderedImages.map((image) => ({
    id: image.id,
    originalFilename:
      image.originalFilename,
    createdAt: image.createdAt,
    sortOrder: image.sortOrder,
  }))}
/>
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
            {orderedImages.map((image) => (
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
                  <div>
                    <p>
                      {image.originalFilename}
                    </p>

                    <span>
                      {image.width} ×{" "}
                      {image.height}
                    </span>
                  </div>

                  <ProofingImageActions
                    galleryId={gallery.id}
                    imageId={image.id}
                    introMessage={
                      gallery.introMessage ?? ""
                    }
                    isCover={
                      gallery.coverImageId ===
                      image.id
                    }
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Client selections */}

      <section
        className="proofing-section"
        id="selections"
      >
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
            {(gallery.visitors?.length ?? 0) === 1
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
                          {selectedImages.length}{" "}
                          photograph
                          {selectedImages.length === 1
                            ? ""
                            : "s"}{" "}
                          selected

                          <span aria-hidden="true">
                            {" "}
                            ·{" "}
                          </span>

                          {visitor.selection.status ===
                          "submitted"
                            ? "Submitted"
                            : visitor.selection.status ===
                                "in-progress"
                              ? "Selection in progress"
                              : "No selection started"}

                          {visitor.selection.status ===
                            "submitted" &&
                          visitor.selection
                            .submittedAt ? (
                            <>
                              <span aria-hidden="true">
                                {" "}
                                ·{" "}
                              </span>

                              {new Date(
                                visitor.selection
                                  .submittedAt,
                              ).toLocaleString(
                                "en-GB",
                                {
                                  dateStyle:
                                    "medium",
                                  timeStyle:
                                    "short",
                                },
                              )}
                            </>
                          ) : null}
                        </p>
                      </div>

                      <div className="proofing-selection-count">
                        <strong>
                          {selectedImages.length}
                        </strong>

                        <span>
                          Selected
                        </span>
                      </div>
                    </header>

                    {selectedImages.length > 0 ? (
                      <>
                        <div className="proofing-selection-thumbnails">
                          {selectedImages.map(
                            (image) => (
                              <figure
                                key={image.id}
                                className="proofing-selection-thumbnail"
                              >
                                <div className="proofing-selection-thumbnail-image">
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
                      key={favourite.imageId}
                    >
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
