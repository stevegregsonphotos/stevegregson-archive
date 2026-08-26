import Link from "next/link";

import { getProofingGalleries } from "../../../lib/proofing/repository";

export const dynamic = "force-dynamic";

export default function ProofingPage() {
  const galleries = getProofingGalleries();

  return (
    <main className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-eyebrow">
            Client Proofing
          </p>

          <h1>Proofing Galleries</h1>

          <p>
            Create private client galleries, review
            selections and export favourites for
            Lightroom.
          </p>
        </div>

        <Link
          href="/admin/proofing/new"
          className="admin-button"
        >
          New gallery
        </Link>
      </div>

      {galleries.length === 0 ? (
        <section className="admin-empty-state">
          <p>No proofing galleries yet.</p>

          <Link href="/admin/proofing/new">
            Create your first client gallery →
          </Link>
        </section>
      ) : (
        <section>
          {galleries.map((gallery) => (
            <Link
              key={gallery.id}
              href={`/admin/proofing/${gallery.id}`}
            >
              <article>
                <div>
                  <h2>{gallery.title}</h2>

                  {gallery.clientName ? (
                    <p>{gallery.clientName}</p>
                  ) : null}
                </div>

                <div>
                  <p>
                    {gallery.images.length} photographs
                  </p>

                  <p>
  {gallery.visitors?.length ?? 0} visitors
</p>

<p>
  {gallery.visitors?.length
    ? `${gallery.visitors.reduce(
        (total, visitor) =>
          total +
          visitor.selection.favourites.length,
        0,
      )} favourites`
    : `${gallery.selection?.favourites.length ?? 0} favourites`}
</p>
                </div>
              </article>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
