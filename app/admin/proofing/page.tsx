import {
  getProofingCompanies,
  getProofingContacts,
} from "@/lib/proofing/contacts-repository";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getProofingGalleries,
  saveProofingGallery,
} from "../../../lib/proofing/repository";

import type {
  ProofingGallery,
} from "../../../lib/proofing/types";

import {
  getDefaultProofingIntroTemplate,
} from "../../../lib/proofing/intro-templates";

import ProofingGalleryBrowser from "./ProofingGalleryBrowser";
import NewGalleryModal from "./NewGalleryModal";
import styles from "./proofing-galleries.module.css";

export const dynamic = "force-dynamic";

function visitedInLastDay(value: string) {
  return Date.now() - new Date(value).getTime() < 24 * 60 * 60 * 1000;
}

export default async function ProofingPage() {
  async function createGallery(
    formData: FormData,
  ) {
    "use server";

    const title = String(
      formData.get("title") ?? "",
    ).trim();

    const clientName = String(
      formData.get("clientName") ?? "",
    ).trim();

    const shootDate = String(
      formData.get("shootDate") ?? "",
    ).trim();

      const recipientContactIds =
        formData
          .getAll("recipientContactId")
          .map((value) =>
            String(value).trim(),
          )
          .filter(Boolean);

      const recipientEmails =
        formData
          .getAll("recipientEmail")
          .map((value) =>
            String(value)
              .trim()
              .toLowerCase(),
          )
          .filter((email) =>
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
              email,
            ),
          );


    if (!title || !shootDate) {
      return;
    }

    const id = crypto.randomUUID();

    const baseSlug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!baseSlug) {
      return;
    }

    const existingSlugs = new Set(
      (await getProofingGalleries()).map(
        (gallery) =>
          gallery.slug
            .trim()
            .toLowerCase(),
      ),
    );

    let slug = baseSlug;
    let suffix = 2;

    while (existingSlugs.has(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const now = new Date().toISOString();

      const addressBookContacts =
        await getProofingContacts();

      const addressBookCompanies =
        await getProofingCompanies();

      const recipientEmailsSeen =
        new Set<string>();

      const recipients:
        NonNullable<
          ProofingGallery["recipients"]
        > = [];

      for (
        const contactId of new Set(
          recipientContactIds,
        )
      ) {
        const contact =
          addressBookContacts.find(
            (candidate) =>
              candidate.id === contactId,
          );

        if (!contact) {
          continue;
        }

        const email =
          contact.email
            .trim()
            .toLowerCase();

        if (
          !email ||
          recipientEmailsSeen.has(email)
        ) {
          continue;
        }

        const company = contact.companyId
          ? addressBookCompanies.find(
              (candidate) =>
                candidate.id ===
                contact.companyId,
            )?.name
          : undefined;

        recipients.push({
          id: crypto.randomUUID(),
          contactId: contact.id,
          name: contact.name,
          company,
          email,
          addedAt: now,
        });

        recipientEmailsSeen.add(email);
      }

      for (const email of recipientEmails) {
        if (recipientEmailsSeen.has(email)) {
          continue;
        }

        recipients.push({
          id: crypto.randomUUID(),
          email,
          addedAt: now,
        });

        recipientEmailsSeen.add(email);
      }


    const defaultIntroTemplate =
      await getDefaultProofingIntroTemplate();

    const gallery: ProofingGallery = {
      id,
      slug,
      title,

      clientName:
        clientName || undefined,

      shootDate,

      introMessage:
        defaultIntroTemplate?.message ??
        "",

      createdAt: now,
      updatedAt: now,

      status: "draft",

      downloadPermission: "none",
      watermarkEnabled: false,

      images: [],
      visitors: [],
      recipients,

      selection: {
        status: "not-started",
        favourites: [],
      },
    };

    await saveProofingGallery(gallery);

    redirect(
      `/admin/proofing/${id}`,
    );
  }

  const contacts = await getProofingContacts();
    const companies = await getProofingCompanies();

  const galleries =
    (await getProofingGalleries()).sort(
      (first, second) =>
        new Date(
          second.createdAt,
        ).getTime() -
        new Date(
          first.createdAt,
        ).getTime(),
    );

  const galleryActivity =
    galleries
      .flatMap((gallery) => {
        const visitors =
          (gallery.visitors ?? [])
            .slice()
            .sort(
              (first, second) =>
                new Date(
                  second.lastSeenAt,
                ).getTime() -
                new Date(
                  first.lastSeenAt,
                ).getTime(),
            );

        if (visitors.length === 0) {
          return [];
        }

        return [
          {
            galleryId: gallery.id,
            galleryTitle: gallery.title,
            visitors,
            latestVisit:
              visitors[0].lastSeenAt,
          },
        ];
      })
      .sort(
        (first, second) =>
          new Date(
            second.latestVisit,
          ).getTime() -
          new Date(
            first.latestVisit,
          ).getTime(),
      );

  function formatActivityDate(
    value: string,
  ) {
    return new Intl.DateTimeFormat(
      "en-GB",
      {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/London",
      },
    ).format(
      new Date(value),
    );
  }

  const galleryItems = galleries.map(
    (gallery) => {
      const visitorCount =
        gallery.visitors?.length ?? 0;

      const favouriteCount =
        gallery.visitors?.length
          ? gallery.visitors.reduce(
              (total, visitor) =>
                total +
                visitor.selection
                  .favourites.length,
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

      return {
        id: gallery.id,
        slug: gallery.slug,
        title: gallery.title,
        clientName: gallery.clientName,
        venue: gallery.venue,
        status: gallery.status,
        createdAt: gallery.createdAt,
        expiresAt: gallery.expiresAt,
        imageCount: gallery.images.length,
        visitorCount,
        favouriteCount,
        recipientCount:
          gallery.recipients?.length ?? 0,
        coverImageUrl,
      };
    },
  );

  const recentVisits = galleryActivity
    .flatMap((activityGallery) =>
      activityGallery.visitors.map((visitor) => ({
        galleryId: activityGallery.galleryId,
        galleryTitle: activityGallery.galleryTitle,
        visitor,
      })),
    )
    .sort(
      (first, second) =>
        new Date(second.visitor.lastSeenAt).getTime() -
        new Date(first.visitor.lastSeenAt).getTime(),
    )
    .slice(0, 3);

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Client proofing</p>

          <h1 className={styles.title}>Galleries</h1>

          <p className={styles.lead}>
            Upload proofs, send them to your client and see
            what they pick.
          </p>
        </div>

        <div className={styles.headActions}>
          <Link
            href="/admin/proofing/watermarks"
            className={styles.textLink}
          >
            Watermarks
          </Link>

          <NewGalleryModal
            createGallery={createGallery}
            contacts={contacts}
            companies={companies}
          />
        </div>
      </header>

      {galleryActivity.length > 0 ? (
        <section
          className={styles.activity}
          aria-label="Recent gallery activity"
        >
          <div className={styles.activityTop}>
            <div>
              <p className={styles.label}>Recent activity</p>

              <strong className={styles.activityCount}>
                {galleryActivity.length}{" "}
                {galleryActivity.length === 1
                  ? "gallery visited"
                  : "galleries visited"}
              </strong>
            </div>
          </div>

          {recentVisits.map(
            ({ galleryId, galleryTitle, visitor }) => (
              <div
                key={`${galleryId}-${visitor.id}`}
                className={styles.activityRow}
              >
                <span className={styles.activityWho}>
                  <span
                    className={
                      visitedInLastDay(visitor.lastSeenAt)
                        ? `${styles.dot} ${styles.dotRecent}`
                        : styles.dot
                    }
                    aria-hidden="true"
                  />
                  {visitor.email}
                </span>

                <Link
                  href={`/admin/proofing/${galleryId}?tab=selections`}
                  className={styles.activityGallery}
                >
                  {galleryTitle}
                </Link>

                <span className={styles.fav}>
                  {visitor.selection.favourites.length} ♥
                </span>

                <time
                  className={styles.when}
                  dateTime={visitor.lastSeenAt}
                >
                  {formatActivityDate(visitor.lastSeenAt)}
                </time>
              </div>
            ),
          )}

          <details className={styles.allActivity}>
            <summary>
              View all activity
              <span className={styles.chev} aria-hidden="true">
                ▾
              </span>
            </summary>

            <div className={styles.allActivityBody}>
              {galleryActivity.map((activityGallery) => (
                <details
                  key={activityGallery.galleryId}
                  className={styles.galleryActivity}
                >
                  <summary>
                    <strong>{activityGallery.galleryTitle}</strong>

                    <span>
                      {activityGallery.visitors.length}{" "}
                      {activityGallery.visitors.length === 1
                        ? "visitor"
                        : "visitors"}
                    </span>
                  </summary>

                  <div className={styles.visitorTable}>
                    <div
                      className={`${styles.visitorRow} ${styles.visitorHeader}`}
                    >
                      <span>Email</span>
                      <span>Favourites</span>
                      <span>Last activity</span>
                    </div>

                    {activityGallery.visitors.map((visitor) => (
                      <div
                        key={visitor.id}
                        className={styles.visitorRow}
                      >
                        <span>{visitor.email}</span>

                        <span className={styles.fav}>
                          {visitor.selection.favourites.length}
                        </span>

                        <time dateTime={visitor.lastSeenAt}>
                          {formatActivityDate(visitor.lastSeenAt)}
                        </time>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </details>
        </section>
      ) : null}

      {galleries.length === 0 ? (
        <section className={styles.first}>
          <h2>Create your first gallery</h2>

          <p>
            Upload photographs, invite a client and collect
            their selections.
          </p>

          <NewGalleryModal
            createGallery={createGallery}
            contacts={contacts}
            companies={companies}
          />
        </section>
      ) : (
        <ProofingGalleryBrowser galleries={galleryItems} />
      )}
    </main>
  );
}
