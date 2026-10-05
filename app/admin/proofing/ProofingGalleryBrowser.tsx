"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

import styles from "./proofing-galleries.module.css";

type GalleryStatus =
  | "draft"
  | "live"
  | "expired"
  | "archived";

type GalleryBrowserItem = {
  id: string;
  slug: string;
  title: string;
  clientName?: string;
  venue?: string;
  status: GalleryStatus;
  createdAt: string;
  expiresAt?: string;
  imageCount: number;
  visitorCount: number;
  favouriteCount: number;
  recipientCount: number;
  coverImageUrl: string | null;
};

type GalleryFilter =
  | "all"
  | "unarchived"
  | "active"
  | "inactive"
  | "prereleased"
  | "archived";

type Props = {
  galleries: GalleryBrowserItem[];
};

function galleryIsExpired(
  gallery: GalleryBrowserItem,
) {
  if (gallery.status === "expired") {
    return true;
  }

  if (!gallery.expiresAt) {
    return false;
  }

  return (
    new Date(gallery.expiresAt).getTime() <
    Date.now()
  );
}

function matchesFilter(
  gallery: GalleryBrowserItem,
  filter: GalleryFilter,
) {
  switch (filter) {
    case "unarchived":
      return gallery.status !== "archived";

    case "active":
      return (
        gallery.status === "live" &&
        !galleryIsExpired(gallery)
      );

    case "inactive":
      return galleryIsExpired(gallery);

    case "prereleased":
      return gallery.status === "draft";

    case "archived":
      return gallery.status === "archived";

    case "all":
    default:
      return true;
  }
}

function statusLabel(
  gallery: GalleryBrowserItem,
) {
  if (gallery.status === "archived") {
    return "Archived";
  }

  if (
    gallery.status === "expired" ||
    galleryIsExpired(gallery)
  ) {
    return "Inactive";
  }

  if (gallery.status === "draft") {
    return "Pre-Released";
  }

  return "Active";
}

export default function ProofingGalleryBrowser({
  galleries,
}: Props) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<GalleryFilter>("all");

  const [view, setView] =
    useState<"grid" | "list">("grid");

  const counts = useMemo(() => {
    const count = (
      target: GalleryFilter,
    ) =>
      galleries.filter((gallery) =>
        matchesFilter(gallery, target),
      ).length;

    return {
      all: count("all"),
      unarchived: count("unarchived"),
      active: count("active"),
      inactive: count("inactive"),
      prereleased: count("prereleased"),
      archived: count("archived"),
    };
  }, [galleries]);

  const visibleGalleries = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return galleries.filter((gallery) => {
      if (!matchesFilter(gallery, filter)) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        gallery.title,
        gallery.clientName,
        gallery.venue,
      ]
        .filter(Boolean)
        .some((value) =>
          value!
            .toLowerCase()
            .includes(query),
        );
    });
  }, [galleries, filter, search]);

  const filters: Array<{
    id: GalleryFilter;
    label: string;
    count: number;
  }> = [
    {
      id: "all",
      label: "All",
      count: counts.all,
    },
    {
      id: "active",
      label: "Active",
      count: counts.active,
    },
    {
      id: "prereleased",
      label: "Pre-released",
      count: counts.prereleased,
    },
    {
      id: "inactive",
      label: "Inactive",
      count: counts.inactive,
    },
    {
      id: "archived",
      label: "Archived",
      count: counts.archived,
    },
  ];

  function closeMenu(
    element: HTMLElement,
  ) {
    element
      .closest("details")
      ?.removeAttribute("open");
  }

  async function shareGallery(
    gallery: GalleryBrowserItem,
    button: HTMLButtonElement,
  ) {
    closeMenu(button);

    if (gallery.recipientCount === 0) {
      window.alert(
        "This gallery has no recipients assigned.",
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Send "${gallery.title}" to ${gallery.recipientCount} recipient${
          gallery.recipientCount === 1
            ? ""
            : "s"
        } now?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      const response =
        await fetch(
          "/api/admin/proofing/share",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              galleryId: gallery.id,
            }),
          },
        );

      const result =
        (await response.json()) as {
          ok?: boolean;
          message?: string;
          sent?: number;
        };

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ||
            "Gallery could not be shared.",
        );
      }

      window.alert(
        result.message ||
          `Gallery sent to ${result.sent ?? gallery.recipientCount} recipient${
            (result.sent ??
              gallery.recipientCount) === 1
              ? ""
              : "s"
          }.`,
      );
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Gallery could not be shared.",
      );
    }
  }

  async function copyGalleryUrl(
    gallery: GalleryBrowserItem,
    button: HTMLButtonElement,
  ) {
    closeMenu(button);

    const url =
      `${window.location.origin}/proofing/${gallery.slug}`;

    try {
      await navigator.clipboard.writeText(
        url,
      );

      window.alert(
        "Gallery URL copied.",
      );
    } catch {
      window.prompt(
        "Copy gallery URL:",
        url,
      );
    }
  }

  async function toggleGalleryStatus(
    gallery: GalleryBrowserItem,
    button: HTMLButtonElement,
  ) {
    closeMenu(button);

    const nextStatus =
      gallery.status === "live"
        ? "archived"
        : "live";

    const actionLabel =
      nextStatus === "archived"
        ? "Deactivate"
        : "Reactivate";

    const confirmed =
      window.confirm(
        `${actionLabel} "${gallery.title}"?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      const response =
        await fetch(
          "/api/admin/proofing/status",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              galleryId: gallery.id,
              status: nextStatus,
            }),
          },
        );

      const result =
        (await response.json()) as {
          ok?: boolean;
          message?: string;
        };

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ||
            "Gallery status could not be updated.",
        );
      }

      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Gallery status could not be updated.",
      );
    }
  }

  async function deleteGallery(
    gallery: GalleryBrowserItem,
    button: HTMLButtonElement,
  ) {
    closeMenu(button);

    const confirmed =
      window.confirm(
        `Permanently delete "${gallery.title}"?\n\nThis will delete the gallery, its client selections and its proofing photographs from storage. This cannot be undone.`,
      );

    if (!confirmed) {
      return;
    }

    try {
      const response =
        await fetch(
          "/api/admin/proofing/delete-gallery",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              galleryId: gallery.id,
            }),
          },
        );

      const result =
        (await response.json()) as {
          ok?: boolean;
          message?: string;
        };

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ||
            "Gallery could not be deleted.",
        );
      }

      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Gallery could not be deleted.",
      );
    }
  }

  function formatCardDate(value: string) {
    return new Date(value).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function stateClass(gallery: GalleryBrowserItem) {
    const label = statusLabel(gallery);

    if (label === "Pre-Released") {
      return `${styles.state} ${styles.stateDraft}`;
    }

    if (label === "Inactive" || label === "Archived") {
      return `${styles.state} ${styles.stateOff}`;
    }

    return styles.state;
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search gallery, client or venue…"
            aria-label="Search galleries"
          />
        </label>

        <div
          className={styles.filters}
          role="tablist"
          aria-label="Gallery filters"
        >
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={
                filter === item.id ? styles.on : undefined
              }
              onClick={() => setFilter(item.id)}
            >
              {item.label}
              <span>{item.count}</span>
            </button>
          ))}
        </div>

        <div className={styles.views}>
          <button
            type="button"
            className={view === "grid" ? styles.on : undefined}
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <rect width="6" height="6" />
              <rect x="8" width="6" height="6" />
              <rect y="8" width="6" height="6" />
              <rect x="8" y="8" width="6" height="6" />
            </svg>
          </button>

          <button
            type="button"
            className={view === "list" ? styles.on : undefined}
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <rect width="14" height="2" />
              <rect y="6" width="14" height="2" />
              <rect y="12" width="14" height="2" />
            </svg>
          </button>
        </div>
      </div>

      {visibleGalleries.length === 0 ? (
        <div className={styles.empty}>
          <p>No galleries match this view.</p>
        </div>
      ) : (
        <div
          className={
            view === "grid"
              ? styles.cards
              : `${styles.cards} ${styles.list}`
          }
        >
          {visibleGalleries.map((gallery) => {
            const label = statusLabel(gallery);
            const isOff =
              label === "Inactive" || label === "Archived";

            return (
              <article key={gallery.id} className={styles.card}>
                <Link
                  href={`/admin/proofing/${gallery.id}`}
                  className={styles.cardMain}
                >
                  <div
                    className={
                      isOff
                        ? `${styles.image} ${styles.dimmed}`
                        : styles.image
                    }
                  >
                    {gallery.coverImageUrl ? (
                      <img src={gallery.coverImageUrl} alt="" />
                    ) : (
                      <div className={styles.placeholder}>
                        <span>No photographs</span>
                      </div>
                    )}

                    <span className={stateClass(gallery)}>
                      <i aria-hidden="true" />
                      {label === "Pre-Released" ? "Pre-released" : label}
                    </span>

                    <span className={styles.photoCount}>
                      {gallery.imageCount}{" "}
                      {gallery.imageCount === 1 ? "photo" : "photos"}
                    </span>
                  </div>

                  <div className={styles.copy}>
                    <h2>{gallery.title}</h2>

                    <p className={styles.meta}>
                      {formatCardDate(gallery.createdAt)}
                      {" · "}
                      {gallery.clientName ? (
                        <b>{gallery.clientName}</b>
                      ) : (
                        <span>No client</span>
                      )}
                      {gallery.venue ? (
                        <>
                          {" · "}
                          {gallery.venue}
                        </>
                      ) : null}
                    </p>
                  </div>

                  <div className={styles.foot}>
                    <span className={styles.stats}>
                      <span>
                        <b>{gallery.visitorCount}</b>{" "}
                        {gallery.visitorCount === 1 ? "visitor" : "visitors"}
                      </span>

                      <span className={styles.heart}>
                        <b>{gallery.favouriteCount}</b> ♥
                      </span>
                    </span>

                    <span className={styles.open}>Open →</span>
                  </div>
                </Link>

                <details className={styles.actions}>
                  <summary
                    aria-label={`Actions for ${gallery.title}`}
                    title="Gallery actions"
                  >
                    ⋮
                  </summary>

                  <div className={styles.menu} role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(event) =>
                        void shareGallery(gallery, event.currentTarget)
                      }
                    >
                      Share gallery
                    </button>

                    <Link
                      role="menuitem"
                      href={`/admin/proofing/${gallery.id}?tab=selections`}
                    >
                      Visitors &amp; selections
                    </Link>

                    <Link
                      role="menuitem"
                      href={`/proofing/${gallery.slug}`}
                      target="_blank"
                    >
                      Preview gallery ↗
                    </Link>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={(event) =>
                        void copyGalleryUrl(gallery, event.currentTarget)
                      }
                    >
                      Copy gallery link
                    </button>

                    <Link
                      role="menuitem"
                      href={`/admin/proofing/${gallery.id}?tab=settings`}
                    >
                      Settings
                    </Link>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={(event) =>
                        void toggleGalleryStatus(gallery, event.currentTarget)
                      }
                    >
                      {gallery.status === "live"
                        ? "Deactivate gallery"
                        : "Reactivate gallery"}
                    </button>

                    <div className={styles.menuDivider} aria-hidden="true" />

                    <button
                      type="button"
                      role="menuitem"
                      className={styles.danger}
                      onClick={(event) =>
                        void deleteGallery(gallery, event.currentTarget)
                      }
                    >
                      Delete
                    </button>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
