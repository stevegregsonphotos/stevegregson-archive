import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import {
  getProofingGalleryBySlug,
} from "../../../lib/proofing/repository";

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

  const gallery =
    await getProofingGalleryBySlug(slug);

  if (!gallery) {
    notFound();
  }

  const hasExpiredByDate =
    Boolean(gallery.expiresAt) &&
    new Date(gallery.expiresAt as string).getTime() <
      Date.now();

  const unavailableReason =
    gallery.status === "draft"
      ? {
          title: "This gallery is not yet available.",
          message:
            "The gallery is still being prepared. Please check back later, or contact me if you were expecting access.",
        }
      : gallery.status === "expired" ||
          hasExpiredByDate
        ? {
            title: "This gallery has expired.",
            message:
              "If you need access again, please get in touch and I can reopen the gallery for you.",
          }
        : gallery.status === "archived"
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

            <h1>{gallery.title}</h1>

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

  const orderedImages = [...gallery.images].sort(
  (a, b) => a.sortOrder - b.sortOrder,
);

  const cookieStore = await cookies();

  const visitorId =
    cookieStore.get(
      `proofing_${gallery.id}`,
    )?.value;

  const visitor = visitorId
    ? gallery.visitors?.find(
        (candidate) =>
          candidate.id === visitorId,
      )
    : undefined;

  /*
   * No valid visitor session:
   * show the cover + email entry screen.
   */
  if (!visitor) {
    const coverImage = gallery.coverImageId
      ? gallery.images.find(
          (image) =>
            image.id === gallery.coverImageId,
        )
      : undefined;

    const coverImageUrl = coverImage
      ? `/api/proofing/image?gallery=${encodeURIComponent(
          gallery.slug,
        )}&image=${encodeURIComponent(
          coverImage.id,
        )}`
      : undefined;

    return (
      <main className="proofing-client-page">
        <ProofingGalleryEntry
          gallerySlug={gallery.slug}
          title={gallery.title}
          clientName={gallery.clientName}
          venue={gallery.venue}
          coverImageUrl={coverImageUrl}
        />
      </main>
    );
  }

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
            images={orderedImages.map(
  (image) => ({
    id: image.id,
    originalFilename:
      image.originalFilename,
    alt: image.alt,
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
          />
        )}
      </div>
    </main>
  );
}