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
};

export default async function ProofingClientPage({
  params,
}: ProofingClientPageProps) {
  const { slug } = await params;

  const gallery =
    getProofingGalleryBySlug(slug);

  if (!gallery) {
    notFound();
  }

  /*
   * The browser never stores the visitor's
   * email address in the cookie.
   *
   * It only stores the opaque visitor UUID
   * created by /api/proofing/enter.
   */
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
   * show the email entry screen instead
   * of exposing the photographs.
   */
  if (!visitor) {
    return (
      <main className="proofing-client-page">
        <ProofingGalleryEntry
          gallerySlug={gallery.slug}
        />
      </main>
    );
  }

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
              {gallery.clientName ?? "Client gallery"}

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
            No photographs are currently available
            in this gallery.
          </p>
        ) : (
          <ProofingGalleryClient
            gallerySlug={gallery.slug}
            images={gallery.images.map(
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
          />
        )}
      </div>
    </main>
  );
}