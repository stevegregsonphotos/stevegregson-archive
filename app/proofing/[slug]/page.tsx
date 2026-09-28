import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import {
  getProofingGalleryBaseBySlug,
  getProofingGalleryBySlug,
  getProofingGalleryImageBySlug,
} from "../../../lib/proofing/repository";

import {
  getProofingConsolidatedSelection,
} from "../../../lib/proofing/consolidated-repository";

import ProofingGalleryClient from "./ProofingGalleryClient";
import ProofingGalleryEntry from "./ProofingGalleryEntry";

export const dynamic = "force-dynamic";

type ProofingClientPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    welcome?: string;
  }>;
};

export default async function ProofingClientPage({
  params,
  searchParams,
}: ProofingClientPageProps) {
  const { slug } = await params;
  const { welcome } = await searchParams;

  const galleryBase =
    await getProofingGalleryBaseBySlug(
      slug,
    );

  if (!galleryBase) {
    notFound();
  }

  const hasExpiredByDate =
    Boolean(galleryBase.expiresAt) &&
    new Date(
      galleryBase.expiresAt as string,
    ).getTime() < Date.now();

  const unavailableReason =
    galleryBase.status === "draft"
      ? {
          title: "This gallery is not yet available.",
          message:
            "The gallery is still being prepared. Please check back later, or contact me if you were expecting access.",
        }
      : galleryBase.status === "expired" ||
          hasExpiredByDate
        ? {
            title: "This gallery has expired.",
            message:
              "If you need access again, please get in touch and I can reopen the gallery for you.",
          }
        : galleryBase.status === "archived"
          ? {
              title: "This gallery is no longer available.",
              message:
                "If you need access again, please get in touch and I can reopen the gallery for you.",
            }
          : null;

  if (unavailableReason) {
    return (
      <main className="proofing-client-page">
        <div className="proofing-client-shell">
          <section className="proofing-client-unavailable">
            <p className="proofing-client-eyebrow">
              Private Client Gallery
            </p>

            <h1>{galleryBase.title}</h1>

            <h2>{unavailableReason.title}</h2>

            <p>
              {unavailableReason.message}
            </p>

            <a
              href="/contact"
              className="proofing-client-unavailable-cta"
            >
              Contact Steve
            </a>
          </section>
        </div>
      </main>
    );
  }

  const cookieStore =
    await cookies();

  const visitorId =
    cookieStore.get(
      `proofing_${galleryBase.id}`,
    )?.value;

  const visitor =
    visitorId
      ? galleryBase.visitors?.find(
          (candidate) =>
            candidate.id === visitorId,
        )
      : undefined;

  const watermarkUrl =
    galleryBase.watermarkEnabled &&
    galleryBase.watermarkId
      ? `/api/proofing/watermark?gallery=${encodeURIComponent(
          galleryBase.slug,
        )}`
      : undefined;

  /*
   * No valid visitor session:
   * do not load every gallery photograph.
   * Resolve only the configured cover image.
   */
  if (!visitor) {
    const coverImage =
      galleryBase.coverImageId
        ? (
            await getProofingGalleryImageBySlug(
              galleryBase.slug,
              galleryBase.coverImageId,
            )
          )?.image
        : undefined;

    const coverImageUrl =
      coverImage
        ? `/api/proofing/image?gallery=${encodeURIComponent(
            galleryBase.slug,
          )}&image=${encodeURIComponent(
            coverImage.id,
          )}`
        : undefined;

    return (
      <main className="proofing-client-page">
        <ProofingGalleryEntry
          gallerySlug={galleryBase.slug}
          title={galleryBase.title}
          clientName={galleryBase.clientName}
          venue={galleryBase.venue}
          coverImageUrl={coverImageUrl}
          watermarkUrl={watermarkUrl}
          watermarkPosition={
            galleryBase.watermarkPosition
          }
          watermarkSize={
            galleryBase.watermarkSize
          }
          watermarkOpacity={
            galleryBase.watermarkOpacity
          }
        />
      </main>
    );
  }

  /*
   * Only authenticated gallery visitors need
   * the complete ordered image collection.
   */
  const gallery =
    await getProofingGalleryBySlug(
      slug,
    );

  if (!gallery) {
    notFound();
  }

  const orderedImages =
    [...gallery.images].sort(
      (a, b) =>
        a.sortOrder - b.sortOrder,
    );

  const consolidatedSelection =
    await getProofingConsolidatedSelection(
      gallery.id,
    );

  /*
   * Older submitted selections were created
   * before submittedFavourites existed.
   *
   * If that is the case, treat their current
   * favourites as the last submitted snapshot
   * until they next submit.
   */
  const submittedFavouriteIds =
    visitor.selection.submittedFavourites?.map(
      (favourite) =>
        favourite.imageId,
    ) ??
    (
      visitor.selection.status === "submitted"
        ? visitor.selection.favourites.map(
            (favourite) =>
              favourite.imageId,
          )
        : []
    );

  /*
   * Consolidated client data is deliberately
   * derived server-side.
   *
   * Visitor IDs and email addresses are not
   * included in the client payload.
   */
  const clientConsolidatedSelection =
    consolidatedSelection?.visible &&
    consolidatedSelection.participants.length > 0
      ? (() => {
          const participantCount =
            consolidatedSelection.participants.length;

          const imageSelections =
            new Map<
              string,
              {
                participantCount: number;
                labels: Set<string>;
              }
            >();

          for (
            const participant
            of consolidatedSelection.participants
          ) {
            for (
              const imageId
              of participant.imageIds
            ) {
              const current =
                imageSelections.get(
                  imageId,
                ) ?? {
                  participantCount: 0,
                  labels:
                    new Set<string>(),
                };

              current.participantCount += 1;

              if (
                participant.publicLabel
              ) {
                current.labels.add(
                  participant.publicLabel,
                );
              }

              imageSelections.set(
                imageId,
                current,
              );
            }
          }

          return {
            title:
              consolidatedSelection.title,
            definitiveImageIds:
              consolidatedSelection
                .definitiveImageIds,
            participantCount,
            images:
              orderedImages.flatMap(
                (image) => {
                  const metadata =
                    imageSelections.get(
                      image.id,
                    );

                  if (!metadata) {
                    return [];
                  }

                  return [
                    {
                      imageId:
                        image.id,
                      labels:
                        [
                          ...metadata.labels,
                        ],
                      participantCount:
                        metadata.participantCount,
                      selectedByAll:
                        metadata.participantCount ===
                        participantCount,
                    },
                  ];
                },
              ),
          };
        })()
      : undefined;

  return (
    <main className="proofing-client-page">
      <div className="proofing-client-shell">
        <header className="proofing-client-header">
          <div>
            <p className="proofing-client-eyebrow">
              Private Client Gallery
            </p>

            <h1>{gallery.title}</h1>

            <p className="proofing-client-meta">
              {gallery.clientName ??
                "Client gallery"}

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
        </header>

        {gallery.images.length === 0 ? (
          <p className="proofing-client-empty">
            No photographs are currently
            available in this gallery.
          </p>
        ) : (
          <ProofingGalleryClient
            gallerySlug={gallery.slug}
            introMessage={gallery.introMessage}
            showIntroOnLoad={welcome === "1"}
            downloadPermission={
              gallery.downloadPermission === "full"
                ? "web"
                : gallery.downloadPermission
            }
            showFilenames={
              gallery.showFilenames === true
            }
            watermarkUrl={watermarkUrl}
            watermarkPosition={
              gallery.watermarkPosition
            }
            watermarkSize={
              gallery.watermarkSize
            }
            watermarkOpacity={
              gallery.watermarkOpacity
            }
            images={orderedImages.map(
  (image) => ({
    id: image.id,
    originalFilename:
      image.originalFilename,
    alt: image.alt,
    width: image.width,
    height: image.height,
  }),
)}
            initialFavourites={
              visitor.selection.favourites.map(
                (favourite) =>
                  favourite.imageId,
              )
            }
            initialSelectionStatus={
              visitor.selection.status
            }
            initialSubmittedAt={
              visitor.selection.submittedAt
            }
            initialSubmittedFavourites={
              submittedFavouriteIds
            }
            consolidatedSelection={
              clientConsolidatedSelection
            }
          />
        )}
      </div>
    </main>
  );
}