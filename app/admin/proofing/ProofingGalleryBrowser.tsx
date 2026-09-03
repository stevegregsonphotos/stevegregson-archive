"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
} from "react";

type GalleryStatus =
  | "draft"
  | "live"
  | "expired"
  | "archived";

type GalleryBrowserItem = {
  id: string;
  title: string;
  clientName?: string;
  venue?: string;
  status: GalleryStatus;
  createdAt: string;
  expiresAt?: string;
  imageCount: number;
  visitorCount: number;
  favouriteCount: number;
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

                      <span
                        className="sp-gallery-card-menu"
                        aria-hidden="true"
                      >
                        ⋮
                      </span>
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
              </article>
            ),
          )}
        </div>
      )}
    </div>
  );
}
