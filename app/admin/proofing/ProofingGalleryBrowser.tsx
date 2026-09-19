"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  );
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
      id: "unarchived",
      label: "Unarchived",
      count: counts.unarchived,
    },
    {
      id: "active",
      label: "Active",
      count: counts.active,
    },
    {
      id: "inactive",
      label: "Inactive",
      count: counts.inactive,
    },
    {
      id: "prereleased",
      label: "Pre-Released",
      count: counts.prereleased,
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

  return (
    <div className="sp-gallery-browser">
      <div className="sp-gallery-search-row">
        <div className="sp-gallery-search">
          <span aria-hidden="true">
            ⌕
          </span>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search gallery, client or venue…"
            aria-label="Search galleries"
          />
        </div>
      </div>

      <div className="sp-gallery-browser-controls">
        <div
          className="sp-gallery-filters"
          role="tablist"
          aria-label="Gallery filters"
        >
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={
                filter === item.id
              }
              className={
                filter === item.id
                  ? "is-active"
                  : ""
              }
              onClick={() =>
                setFilter(item.id)
              }
            >
              {item.label}
              <span>{item.count}</span>
            </button>
          ))}
        </div>

        <div className="sp-gallery-view-controls">
          <span>
            {visibleGalleries.length}{" "}
            {visibleGalleries.length === 1
              ? "gallery"
              : "galleries"}
          </span>

          <button
            type="button"
            className={
              view === "grid"
                ? "is-active"
                : ""
            }
            aria-label="Grid view"
            onClick={() => setView("grid")}
          >
            <span className="sp-gallery-grid-icon">
              <i />
              <i />
              <i />
              <i />
            </span>
          </button>

          <button
            type="button"
            className={
              view === "list"
                ? "is-active"
                : ""
            }
            aria-label="List view"
            onClick={() => setView("list")}
          >
            <span className="sp-gallery-list-icon">
              <i />
              <i />
              <i />
            </span>
          </button>
        </div>
      </div>

      {visibleGalleries.length === 0 ? (
        <div className="sp-gallery-empty">
          <p>
            No galleries match this view.
          </p>
        </div>
      ) : (
        <div
          className={
            view === "grid"
              ? "sp-gallery-cards"
              : "sp-gallery-cards is-list"
          }
        >
          {visibleGalleries.map(
            (gallery) => (
              <article
                key={gallery.id}
                className="sp-gallery-card"
              >
                <Link
                  href={`/admin/proofing/${gallery.id}`}
                  className="sp-gallery-card-main"
                >
                  <div className="sp-gallery-card-image">
                    {gallery.coverImageUrl ? (
                      <img
                        src={
                          gallery.coverImageUrl
                        }
                        alt=""
                      />
                    ) : (
                      <div className="sp-gallery-card-placeholder">
                        <span>
                          No photographs
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="sp-gallery-card-copy">
                    <div className="sp-gallery-card-title-row">
                      <h2>
                        {gallery.title}
                      </h2>

                    </div>

                    <div className="sp-gallery-card-details">
                      <div>
                        <span>
                          {formatDate(
                            gallery.createdAt,
                          )}
                        </span>

                        <span>
                          {gallery.imageCount}{" "}
                          {gallery.imageCount === 1
                            ? "photo"
                            : "photos"}
                        </span>
                      </div>

                      <div className="sp-gallery-card-client">
                        {gallery.clientName ? (
                          <span>
                            {gallery.clientName}
                          </span>
                        ) : (
                          <span className="is-muted">
                            No client
                          </span>
                        )}

                        {gallery.venue ? (
                          <span>
                            {gallery.venue}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="sp-gallery-card-footer">
                      <span
                        className={`sp-gallery-state sp-gallery-state-${gallery.status}`}
                      >
                        {statusLabel(gallery)}
                      </span>

                      <div>
                        <span>
                          {gallery.visitorCount}{" "}
                          {gallery.visitorCount === 1
                            ? "visitor"
                            : "visitors"}
                        </span>

                        <span>
                          {gallery.favouriteCount} ♥
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>

                <details className="sp-gallery-card-actions">
                  <summary
                    aria-label={`Actions for ${gallery.title}`}
                    title="Gallery actions"
                  >
                    ⋮
                  </summary>

                  <div
                    className="sp-gallery-card-actions-menu"
                    role="menu"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(event) =>
                        void shareGallery(
                          gallery,
                          event.currentTarget,
                        )
                      }
                    >
                      Share Gallery
                    </button>

                    <Link
                      role="menuitem"
                      href={`/admin/proofing/${gallery.id}?tab=selections`}
                    >
                      View Visitors &amp; Selections
                    </Link>

                    <Link
                      role="menuitem"
                      href={`/proofing/${gallery.slug}`}
                      target="_blank"
                    >
                      Preview Gallery
                    </Link>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={(event) =>
                        void copyGalleryUrl(
                          gallery,
                          event.currentTarget,
                        )
                      }
                    >
                      Copy Gallery URL
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
                        void toggleGalleryStatus(
                          gallery,
                          event.currentTarget,
                        )
                      }
                    >
                      {gallery.status === "live"
                        ? "Deactivate Gallery"
                        : "Reactivate Gallery"}
                    </button>

                    <div
                      className="sp-gallery-card-actions-divider"
                      aria-hidden="true"
                    />

                    <button
                      type="button"
                      role="menuitem"
                      className="is-destructive"
                      onClick={(event) =>
                        void deleteGallery(
                          gallery,
                          event.currentTarget,
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                </details>
              </article>
            ),
          )}
        </div>
      )}
    </div>
  );
}
