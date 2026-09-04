import {
  getProofingCompanies,
  getProofingContacts,
} from "../../../../lib/proofing/contacts-repository";

import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getProofingGallery,
} from "../../../../lib/proofing/repository";

import {
  getProofingWatermarks,
} from "../../../../lib/proofing/watermarks";

import {
  getProofingIntroTemplates,
} from "../../../../lib/proofing/intro-templates";

import ProofingMediaWorkspace from "./ProofingMediaWorkspace";
import ProofingPresentationEditor from "./ProofingPresentationEditor";
import ProofingSelectionCopy from "./ProofingSelectionCopy";
import ProofingSettingsEditor from "./ProofingSettingsEditor";
import ProofingUrlEditor from "./ProofingUrlEditor";
import ProofingWorkspace from "./ProofingWorkspace";

export const dynamic = "force-dynamic";

type ProofingGalleryPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatShootDate(
  shootDate?: string,
  createdAt?: string,
) {
  const value =
    shootDate || createdAt;

  if (!value) {
    return "Not set";
  }

  const date = new Date(
    shootDate
      ? `${shootDate}T12:00:00`
      : value,
  );

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );
}

export default async function ProofingGalleryPage({
  params,
}: ProofingGalleryPageProps) {
  const { id } = await params;

  const gallery =
    await getProofingGallery(id);

  if (!gallery) {
    notFound();
  }

  const introTemplates =
    getProofingIntroTemplates();

  const watermarks =
    await getProofingWatermarks();

    const contacts = await getProofingContacts();
    const companies = await getProofingCompanies();

  const orderedImages =
    [...gallery.images].sort(
      (a, b) =>
        a.sortOrder - b.sortOrder,
    );

  const visitorFavouriteCount =
    gallery.visitors?.reduce(
      (total, visitor) =>
        total +
        visitor.selection.favourites.length,
      0,
    ) ?? 0;

  const legacyFavouriteCount =
    gallery.selection?.favourites.length ??
    0;

  const totalFavouriteCount =
    visitorFavouriteCount ||
    legacyFavouriteCount;

  const coverImage =
    gallery.coverImageId
      ? gallery.images.find(
          (image) =>
            image.id ===
            gallery.coverImageId,
        )
      : orderedImages[0];

  const coverImageUrl =
    coverImage
      ? `/api/admin/proofing/image?galleryId=${encodeURIComponent(
          gallery.id,
        )}&imageId=${encodeURIComponent(
          coverImage.id,
        )}`
      : null;

  const latestVisitor =
    [...(gallery.visitors ?? [])].sort(
      (first, second) =>
        new Date(
          second.lastSeenAt,
        ).getTime() -
        new Date(
          first.lastSeenAt,
        ).getTime(),
    )[0];

  const media = (
    <ProofingMediaWorkspace
      galleryId={gallery.id}
      introMessage={
        gallery.introMessage ?? ""
      }
      images={orderedImages.map(
        (image) => ({
          id: image.id,
          originalFilename:
            image.originalFilename,
          alt: image.alt,
          createdAt:
            image.createdAt,
          sortOrder:
            image.sortOrder,
          imageUrl: `/api/admin/proofing/image?galleryId=${encodeURIComponent(
            gallery.id,
          )}&imageId=${encodeURIComponent(
            image.id,
          )}`,
          isCover:
            gallery.coverImageId ===
            image.id,
        }),
      )}
    />
  );

  const settings = (
    <div className="sp-workspace-panel sp-workspace-settings">
      <div className="sp-workspace-section-heading">
        <div>
          <p className="proofing-section-label">
            Gallery settings
          </p>

          <h2>Settings</h2>
        </div>

        <p>
          Control access, delivery and
          availability for this gallery.
        </p>
      </div>

      <div className="sp-workspace-url-panel">
        <div>
          <span>Gallery URL</span>

          <p>
            Change the private link used
            by your client.
          </p>
        </div>

        <ProofingUrlEditor
          galleryId={gallery.id}
          initialSlug={gallery.slug}
        />
      </div>

      <ProofingSettingsEditor
        galleryId={gallery.id}
        initialStatus={gallery.status}
        initialDownloadPermission={
          gallery.downloadPermission ===
          "full"
            ? "web"
            : gallery.downloadPermission
        }
        initialWatermarkEnabled={
          gallery.watermarkEnabled
        }
        initialWatermarkId={
          gallery.watermarkId
        }
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
        initialExpiresAt={
          gallery.expiresAt
        }
        initialRecipients={gallery.recipients ?? []}
        contacts={contacts}
        companies={companies}
        watermarks={watermarks.map(
          (watermark) => ({
            id: watermark.id,
            name: watermark.name,
          }),
        )}
      />
    </div>
  );

  const branding = (
    <div className="sp-workspace-panel">
      <div className="sp-workspace-section-heading">
        <div>
          <p className="proofing-section-label">
            Client experience
          </p>

          <h2>Branding</h2>
        </div>

        <p>
          Choose the cover and introduction
          shown to your client.
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
        introTemplates={
          introTemplates
        }
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
    </div>
  );

  const selections = (
    <div className="sp-workspace-panel">
      <div className="sp-workspace-section-heading">
        <div>
          <p className="proofing-section-label">
            Client activity
          </p>

          <h2>Selections</h2>
        </div>

        <p>
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
                    > =>
                      Boolean(image),
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
                        {selectedImages.length ===
                        1
                          ? ""
                          : "s"}{" "}
                        selected
                        <span aria-hidden="true">
                          {" "}
                          ·{" "}
                        </span>
                        {visitor.selection
                          .status ===
                        "submitted"
                          ? "Submitted"
                          : visitor.selection
                                .status ===
                              "in-progress"
                            ? "Selection in progress"
                            : "No selection started"}
                      </p>
                    </div>

                    <div className="proofing-selection-count">
                      <strong>
                        {
                          selectedImages.length
                        }
                      </strong>

                      <span>Selected</span>
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
      ) : (
        <div className="sp-selections-empty">
          <p>
            No client selections yet.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <main className="sp-gallery-admin-page">
      <header className="sp-gallery-admin-header">
        <div className="sp-gallery-admin-title">
          <Link
            href="/admin/proofing"
            aria-label="Back to galleries"
          >
            ←
          </Link>

          <div>
            <h1>{gallery.title}</h1>

            <p>
              {gallery.clientName ??
                "No client"}
            </p>
          </div>
        </div>

        <div className="sp-gallery-admin-actions">
          <Link
            href={`/proofing/${gallery.slug}`}
            target="_blank"
            className="sp-gallery-preview-link"
          >
            Preview
          </Link>

          <Link
            href={`/proofing/${gallery.slug}`}
            target="_blank"
            className="sp-gallery-share-link"
          >
            Share Gallery
          </Link>
        </div>
      </header>

      <div className="sp-gallery-admin-body">
        <aside className="sp-gallery-admin-sidebar">
          <div className="sp-gallery-sidebar-cover">
            {coverImageUrl ? (
              <img
                src={coverImageUrl}
                alt=""
              />
            ) : (
              <div>
                No cover image
              </div>
            )}
          </div>

          <div className="sp-gallery-sidebar-card">
            <div className="sp-gallery-sidebar-stat">
              <strong>
                {gallery.images.length}
              </strong>

              <span>
                Item
                {gallery.images.length ===
                1
                  ? ""
                  : "s"}
              </span>
            </div>

            <dl>
              <div>
                <dt>Shoot Date</dt>

                <dd>
                  {formatShootDate(
                    gallery.shootDate,
                    gallery.createdAt,
                  )}
                </dd>
              </div>

              <div>
                <dt>Favourites</dt>

                <dd>
                  {totalFavouriteCount}
                </dd>
              </div>
            </dl>
          </div>

          <div className="sp-gallery-sidebar-card">
            <span className="sp-gallery-sidebar-label">
              Client
            </span>

            <strong>
              {gallery.clientName ??
                "No client assigned"}
            </strong>

            {gallery.venue ? (
              <p>{gallery.venue}</p>
            ) : null}
          </div>

          <div className="sp-gallery-sidebar-card">
            <span className="sp-gallery-sidebar-label">
              Recipients
            </span>

            {gallery.recipients?.length ? (
              <div className="sp-gallery-sidebar-recipients">
                {gallery.recipients.map(
                  (recipient) => (
                    <div
                      className="sp-gallery-sidebar-recipient"
                      key={recipient.id}
                    >
                      <strong>
                        {recipient.name ??
                          recipient.email}
                      </strong>

                      {recipient.name ? (
                        <p>
                          {recipient.company
                            ? `${recipient.company} · `
                            : ""}
                          {recipient.email}
                        </p>
                      ) : (
                        <p>
                          One-off recipient
                        </p>
                      )}
                    </div>
                  ),
                )}
              </div>
            ) : (
              <strong>
                No recipients assigned
              </strong>
            )}
          </div>

          <div className="sp-gallery-sidebar-card">
            <span className="sp-gallery-sidebar-label">
              Last Visit
            </span>

            <strong>
              {latestVisitor
                ? new Date(
                    latestVisitor.lastSeenAt,
                  ).toLocaleDateString(
                    "en-GB",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    },
                  )
                : "No visits yet"}
            </strong>

            {latestVisitor ? (
              <p>
                {latestVisitor.email}
              </p>
            ) : null}
          </div>

          <div className="sp-gallery-sidebar-status">
            <span>Status</span>

            <strong>
              {gallery.status}
            </strong>
          </div>
        </aside>

        <section className="sp-gallery-admin-workspace">
          <ProofingWorkspace
            imageCount={
              gallery.images.length
            }
            visitorCount={
              gallery.visitors?.length ??
              0
            }
            media={media}
            settings={settings}
            branding={branding}
            selections={selections}
          />
        </section>
      </div>
    </main>
  );
}
