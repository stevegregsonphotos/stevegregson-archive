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
  getProofingConsolidatedSelection,
} from "../../../../lib/proofing/consolidated-repository";

import {
  getProofingDownloadEvents,
} from "../../../../lib/proofing/download-events-repository";

import {
  getProofingImageNotes,
} from "../../../../lib/proofing/image-notes-repository";

import {
  getProofingImageAnnotations,
} from "../../../../lib/proofing/image-annotations-repository";

import {
  getSelectedWorkImageUrl,
} from "../../../../lib/selected-work-image-url";

import {
  getProofingWatermarks,
} from "../../../../lib/proofing/watermarks";

import {
  getProofingIntroTemplates,
} from "../../../../lib/proofing/intro-templates";

import ProofingMediaWorkspace from "./ProofingMediaWorkspace";
import ProofingPresentationEditor from "./ProofingPresentationEditor";
import ProofingSelectionCopy from "./ProofingSelectionCopy";
import ProofingConsolidationEditor from "./ProofingConsolidationEditor";
import ProofingSidebarStatus from "./ProofingSidebarStatus";
import ProofingSettingsEditor from "./ProofingSettingsEditor";
import ProofingUrlEditor from "./ProofingUrlEditor";
import ProofingWorkspace from "./ProofingWorkspace";
import ShareGalleryButton from "./ShareGalleryButton";
import DeleteGalleryButton from "./DeleteGalleryButton";

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

function formatDownloadDate(
  value: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Unknown time";
  }

  return date.toLocaleString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone:
        "Europe/London",
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

  const consolidated =
    await getProofingConsolidatedSelection(
      gallery.id,
    );

  const definitiveImages =
    consolidated
      ? consolidated.definitiveImageIds
          .map((imageId) =>
            gallery.images.find(
              (image) =>
                image.id === imageId,
            ),
          )
          .filter(
            (
              image,
            ): image is NonNullable<
              typeof image
            > =>
              Boolean(image),
          )
      : [];

  const definitiveFilenames =
    definitiveImages.map(
      (image) =>
        image.originalFilename,
    );

  const downloadEvents =
    await getProofingDownloadEvents(
      gallery.id,
    );

  const imageNotes =
    await getProofingImageNotes(
      gallery.id,
    );

  const resolvedImageNotes =
    imageNotes
      .map((note) => {
        const visitor =
          gallery.visitors.find(
            (candidate) =>
              candidate.id ===
              note.visitorId,
          );

        const image =
          gallery.images.find(
            (candidate) =>
              candidate.id ===
              note.imageId,
          );

        if (
          !visitor ||
          !image
        ) {
          return null;
        }

        return {
          ...note,
          visitorEmail:
            visitor.email,
          image,
        };
      })
      .filter(
        (
          note,
        ): note is NonNullable<
          typeof note
        > =>
          Boolean(note),
      );

  const imageAnnotations =
    await getProofingImageAnnotations(
      gallery.id,
    );

  const editingRequestMap =
    new Map<
      string,
      {
        id: string;
        visitorId: string;
        visitorEmail: string;
        image: (typeof gallery.images)[number];
        note?: string;
        annotation?: (typeof imageAnnotations)[number]["annotation"];
        updatedAt: string;
      }
    >();

  for (const note of resolvedImageNotes) {
    const key =
      `${note.visitorId}:${note.imageId}`;

    editingRequestMap.set(
      key,
      {
        id: key,
        visitorId:
          note.visitorId,
        visitorEmail:
          note.visitorEmail,
        image:
          note.image,
        note:
          note.note,
        updatedAt:
          note.updatedAt,
      },
    );
  }

  for (
    const annotation of
    imageAnnotations
  ) {
    const visitor =
      gallery.visitors.find(
        (candidate) =>
          candidate.id ===
          annotation.visitorId,
      );

    const image =
      gallery.images.find(
        (candidate) =>
          candidate.id ===
          annotation.imageId,
      );

    if (
      !visitor ||
      !image ||
      annotation.annotation.marks.length ===
        0
    ) {
      continue;
    }

    const key =
      `${annotation.visitorId}:${annotation.imageId}`;

    const existing =
      editingRequestMap.get(
        key,
      );

    editingRequestMap.set(
      key,
      {
        id: key,
        visitorId:
          annotation.visitorId,
        visitorEmail:
          visitor.email,
        image,
        note:
          existing?.note,
        annotation:
          annotation.annotation,
        updatedAt:
          existing &&
          new Date(
            existing.updatedAt,
          ).getTime() >
            new Date(
              annotation.updatedAt,
            ).getTime()
            ? existing.updatedAt
            : annotation.updatedAt,
      },
    );
  }

  const editingRequests =
    [...editingRequestMap.values()]
      .sort(
        (first, second) =>
          new Date(
            second.updatedAt,
          ).getTime() -
          new Date(
            first.updatedAt,
          ).getTime(),
      );

  const introTemplates =
    await getProofingIntroTemplates();

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
        initialShowFilenames={
          gallery.showFilenames === true
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
            : getSelectedWorkImageUrl(
                "rehearsal",
                "full-echo-rehearsals-stevegregson-04138.jpg",
              )
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

      {consolidated ? (
        <article className="proofing-selection-card">
          <header className="proofing-selection-card-header">
            <div>
              <p className="proofing-selection-email">
                {consolidated.title}
              </p>

              <p className="proofing-selection-meta">
                {consolidated.participants.length}{" "}
                participant
                {consolidated.participants.length ===
                1
                  ? ""
                  : "s"}
                <span aria-hidden="true">
                  {" "}
                  ·{" "}
                </span>
                {consolidated.visible
                  ? "Visible to clients"
                  : "Hidden from clients"}
              </p>
            </div>

            <div className="proofing-selection-count">
              <strong>
                {definitiveImages.length}
              </strong>

              <span>Definitive</span>
            </div>
          </header>

          {definitiveImages.length > 0 ? (
            <>
              <div className="proofing-selection-thumbnails">
                {definitiveImages.map(
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
                        {image.originalFilename}
                      </figcaption>
                    </figure>
                  ),
                )}
              </div>

              <div className="proofing-selection-actions">
                <ProofingSelectionCopy
                  filenames={
                    definitiveFilenames
                  }
                />
              </div>
            </>
          ) : (
            <p className="proofing-empty">
              No definitive photographs selected
              yet.
            </p>
          )}
        </article>
      ) : null}

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

      <ProofingConsolidationEditor
        galleryId={gallery.id}
      />
    </div>
  );

  const editingRequestsWorkspace = (
    <div className="sp-workspace-panel">
      <div className="sp-workspace-section-heading">
        <div>
          <p className="proofing-section-label">
            Client feedback
          </p>

          <h2>Editing requests</h2>
        </div>

        <p>
          {editingRequests.length}{" "}
          request
          {editingRequests.length === 1
            ? ""
            : "s"}
        </p>
      </div>

      <section className="proofing-client-notes">
        {editingRequests.length > 0 ? (
          <div className="proofing-client-notes-title-row">
            <Link
              href={`/admin/proofing/${gallery.id}/notes-report`}
              className="proofing-client-notes-report-link"
            >
              Export PDF
            </Link>
          </div>
        ) : null}

        {editingRequests.length > 0 ? (
          <div className="proofing-client-notes-list">
            {editingRequests.map(
              (request) => (
                <article
                  key={request.id}
                  className="proofing-client-note-card"
                >
                  <header className="proofing-client-note-card-header">
                    <div>
                      <p className="proofing-selection-email">
                        {request.visitorEmail}
                      </p>

                      <p className="proofing-selection-meta">
                        Updated{" "}
                        {formatDownloadDate(
                          request.updatedAt,
                        )}
                      </p>
                    </div>

                    <span className="proofing-client-note-label">
                      {request.annotation &&
                      request.note
                        ? "Note + markup"
                        : request.annotation
                          ? "Markup"
                          : "Note"}
                    </span>
                  </header>

                  <div className="proofing-client-note-body">
                    <figure className="proofing-client-note-image">
                      <div className="proofing-client-note-image-frame">
                        <img
                          src={`/api/admin/proofing/image?galleryId=${encodeURIComponent(
                            gallery.id,
                          )}&imageId=${encodeURIComponent(
                            request.image.id,
                          )}`}
                          alt={request.image.alt}
                          loading="lazy"
                        />

                        {request.annotation ? (
                          <svg
                            className="proofing-client-note-annotation"
                            viewBox="0 0 1000 1000"
                            preserveAspectRatio="none"
                            aria-label="Client markup"
                          >
                            {request.annotation.marks.map(
                              (mark) => {
                                if (
                                  mark.type !==
                                  "pen"
                                ) {
                                  return null;
                                }

                                const path =
                                  mark.points
                                    .map(
                                      (
                                        point,
                                        index,
                                      ) =>
                                        `${
                                          index ===
                                          0
                                            ? "M"
                                            : "L"
                                        } ${
                                          point.x *
                                          1000
                                        } ${
                                          point.y *
                                          1000
                                        }`,
                                    )
                                    .join(
                                      " ",
                                    );

                                return (
                                  <path
                                    key={
                                      mark.id
                                    }
                                    d={
                                      path
                                    }
                                    className="proofing-client-note-annotation-path"
                                  />
                                );
                              },
                            )}
                          </svg>
                        ) : null}
                      </div>

                      <figcaption>
                        {
                          request.image
                            .originalFilename
                        }
                      </figcaption>
                    </figure>

                    <div className="proofing-client-note-content">
                      {request.note ? (
                        <p className="proofing-client-note-text">
                          {request.note}
                        </p>
                      ) : (
                        <p className="proofing-client-note-markup-only">
                          Client supplied visual markup without a written note.
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              ),
            )}
          </div>
        ) : (
          <div className="sp-selections-empty">
            <p>
              No editing requests yet.
            </p>
          </div>
        )}
      </section>

    </div>
  );

  const downloadsWorkspace = (
    <div className="sp-workspace-panel">
      <div className="sp-workspace-section-heading">
        <div>
          <p className="proofing-section-label">
            Delivery activity
          </p>

          <h2>Downloads</h2>
        </div>

        <p>
          {downloadEvents.length}{" "}
          recorded download
          {downloadEvents.length === 1
            ? ""
            : "s"}
        </p>
      </div>

      <section className="proofing-download-activity">

        {downloadEvents.length > 0 ? (
          <div className="proofing-download-activity-list">
            {downloadEvents.map(
              (event) => (
                <article
                  key={event.id}
                  className="proofing-download-activity-card"
                >
                  <header className="proofing-download-activity-card-header">
                    <div>
                      <p className="proofing-selection-email">
                        {event.visitorEmail}
                      </p>

                      <p className="proofing-selection-meta">
                        {event.downloadType ===
                        "archive"
                          ? event.downloadPermission ===
                            "selected"
                            ? `Downloaded ${event.fileCount} selected photograph${
                                event.fileCount === 1
                                  ? ""
                                  : "s"
                              }`
                            : `Downloaded ${event.fileCount} photograph${
                                event.fileCount === 1
                                  ? ""
                                  : "s"
                              }`
                          : "Downloaded 1 photograph"}
                        <span aria-hidden="true">
                          {" "}
                          ·{" "}
                        </span>
                        {formatDownloadDate(
                          event.createdAt,
                        )}
                      </p>
                    </div>

                    <div className="proofing-download-activity-type">
                      {event.downloadType ===
                      "archive"
                        ? "ZIP"
                        : "Single"}
                    </div>
                  </header>

                  {event.archiveFilename ? (
                    <p className="proofing-download-archive-name">
                      Archive:{" "}
                      <strong>
                        {
                          event.archiveFilename
                        }
                      </strong>
                    </p>
                  ) : null}

                  {event.downloadType ===
                  "archive" ? (
                    <details className="proofing-download-files-details">
                      <summary>
                        View {event.fileCount}{" "}
                        photograph
                        {event.fileCount === 1
                          ? ""
                          : "s"}
                      </summary>

                      <ul className="proofing-download-filenames">
                        {event.filenames.map(
                          (
                            filename,
                            index,
                          ) => (
                            <li
                              key={`${event.id}-${index}`}
                            >
                              {filename}
                            </li>
                          ),
                        )}
                      </ul>
                    </details>
                  ) : (
                    <ul className="proofing-download-filenames">
                      {event.filenames.map(
                        (
                          filename,
                          index,
                        ) => (
                          <li
                            key={`${event.id}-${index}`}
                          >
                            {filename}
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                </article>
              ),
            )}
          </div>
        ) : (
          <div className="sp-selections-empty">
            <p>
              No downloads recorded yet.
            </p>
          </div>
        )}
      </section>

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

          <ShareGalleryButton
            galleryId={gallery.id}
            recipientCount={
              gallery.recipients?.length ?? 0
            }
          />
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

          <ProofingSidebarStatus
            galleryId={gallery.id}
            initialStatus={gallery.status}
          />
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
            editingRequests={
              editingRequestsWorkspace
            }
            downloads={
              downloadsWorkspace
            }
            editingRequestCount={
              editingRequests.length
            }
            downloadCount={
              downloadEvents.length
            }
          />

          <section className="sp-gallery-danger-zone">
            <div>
              <span className="sp-gallery-sidebar-label">
                Danger Zone
              </span>

              <h2>
                Delete this gallery
              </h2>

              <p>
                Permanently remove this proofing gallery,
                its selections and its stored proofing images.
              </p>
            </div>

            <DeleteGalleryButton
              galleryId={gallery.id}
              galleryTitle={gallery.title}
            />
          </section>
        </section>
      </div>
    </main>
  );
}
