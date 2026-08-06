"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useMemo,
  useState,
} from "react";

type ProductionSummary = {
  slug: string;
  title: string;
  venue: string;
  month: number | null;
  year: number;
  hero: string;
  imageCount: number;
};

type ProductionMetrics = {
  productionCount: number;
  photographCount: number;
  earliestYear: number | null;
  latestYear: number | null;
  venueCount: number;
};

type ProductionManagerProps = {
  productions: ProductionSummary[];
  metrics: ProductionMetrics;
};

type SortOption =
  | "newest"
  | "oldest"
  | "title-ascending"
  | "title-descending";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function productionDate(
  month: number | null,
  year: number,
) {
  if (
    month === null ||
    month < 1 ||
    month > 12
  ) {
    return String(year);
  }

  return `${monthNames[month - 1]} ${year}`;
}

function compareProductionDates(
  first: ProductionSummary,
  second: ProductionSummary,
) {
  return (
    first.year - second.year ||
    (first.month ?? 0) -
      (second.month ?? 0)
  );
}

export default function ProductionManager({
  productions,
  metrics,
}: ProductionManagerProps) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] =
    useState<SortOption>("newest");
  const [yearFilter, setYearFilter] =
    useState("all");
  const [venueFilter, setVenueFilter] =
    useState("all");

  const normalisedQuery = query
    .trim()
    .toLowerCase();

  const years = useMemo(
    () =>
      [
        ...new Set(
          productions.map((production) =>
            String(production.year),
          ),
        ),
      ].sort(
        (first, second) =>
          Number(second) - Number(first),
      ),
    [productions],
  );

  const venues = useMemo(
    () =>
      [
        ...new Set(
          productions
            .map((production) =>
              production.venue.trim(),
            )
            .filter(Boolean),
        ),
      ].sort((first, second) =>
        first.localeCompare(second),
      ),
    [productions],
  );

  const filteredProductions = useMemo(() => {
    const matchingProductions =
      productions.filter((production) => {
        const searchableText = [
          production.title,
          production.venue,
          production.year,
          production.slug,
        ]
          .join(" ")
          .toLowerCase();

        if (
          normalisedQuery &&
          !searchableText.includes(
            normalisedQuery,
          )
        ) {
          return false;
        }

        if (
          yearFilter !== "all" &&
          String(production.year) !==
            yearFilter
        ) {
          return false;
        }

        if (
          venueFilter !== "all" &&
          production.venue.trim() !==
            venueFilter
        ) {
          return false;
        }

        return true;
      });

    return [...matchingProductions].sort(
      (first, second) => {
        switch (sortBy) {
          case "oldest":
            return compareProductionDates(
              first,
              second,
            );

          case "title-ascending":
            return first.title.localeCompare(
              second.title,
            );

          case "title-descending":
            return second.title.localeCompare(
              first.title,
            );

          case "newest":
          default:
            return compareProductionDates(
              second,
              first,
            );
        }
      },
    );
  }, [
    normalisedQuery,
    productions,
    sortBy,
    venueFilter,
    yearFilter,
  ]);

  const filtersActive =
    Boolean(normalisedQuery) ||
    yearFilter !== "all" ||
    venueFilter !== "all";

  function clearFilters() {
    setQuery("");
    setYearFilter("all");
    setVenueFilter("all");
  }

  return (
    <main className="production-manager">
      <div className="production-manager-shell">
        <header className="production-manager-header">
          <div className="production-manager-heading">
            <p className="production-manager-eyebrow">
              Archive management
            </p>

            <h1>Productions</h1>

            <p className="production-manager-lead">
              Review, filter, edit and open every
              production in the archive.
            </p>
          </div>

          <Link
            href="/admin/new-production"
            className="production-manager-new"
          >
            <span
              className="production-manager-new-symbol"
              aria-hidden="true"
            >
              +
            </span>

            <span className="production-manager-new-label">
              New production
            </span>
          </Link>
        </header>

        <section
          className="production-manager-metrics"
          aria-label="Private archive statistics"
        >
          <article>
            <strong>
              {metrics.productionCount}
            </strong>
            <span>Productions</span>
          </article>

          <article>
            <strong>
              {metrics.photographCount}
            </strong>
            <span>Photographs</span>
          </article>

          <article>
            <strong>
              {metrics.earliestYear ?? "—"}
            </strong>
            <span>First production</span>
          </article>

          <article>
            <strong>
              {metrics.latestYear ?? "—"}
            </strong>
            <span>Latest production</span>
          </article>

          <article>
            <strong>
              {metrics.venueCount}
            </strong>
            <span>Venues</span>
          </article>
        </section>

        <section
          className="production-manager-toolbar"
          aria-label="Production filters"
        >
          <label className="production-manager-search">
            <span>Search</span>

            <input
              type="search"
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search archive..."
            />
          </label>

          <div className="production-manager-selects">
            <label className="production-manager-filter">
              <span>Sort</span>

              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(
                    event.target
                      .value as SortOption,
                  )
                }
              >
                <option value="newest">
                  Newest
                </option>

                <option value="oldest">
                  Oldest
                </option>

                <option value="title-ascending">
                  A–Z
                </option>

                <option value="title-descending">
                  Z–A
                </option>
              </select>
            </label>

            <label className="production-manager-filter">
              <span>Year</span>

              <select
                value={yearFilter}
                onChange={(event) =>
                  setYearFilter(
                    event.target.value,
                  )
                }
              >
                <option value="all">
                  All years
                </option>

                {years.map((year) => (
                  <option
                    key={year}
                    value={year}
                  >
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className="production-manager-filter production-manager-venue-filter">
              <span>Venue</span>

              <select
                value={venueFilter}
                onChange={(event) =>
                  setVenueFilter(
                    event.target.value,
                  )
                }
              >
                <option value="all">
                  All venues
                </option>

                {venues.map((venue) => (
                  <option
                    key={venue}
                    value={venue}
                  >
                    {venue}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="production-manager-results">
            <p className="production-manager-count">
              Showing{" "}
              <strong>
                {filteredProductions.length}
              </strong>{" "}
              of{" "}
              <strong>
                {productions.length}
              </strong>{" "}
              {productions.length === 1
                ? "production"
                : "productions"}
            </p>

            {filtersActive ? (
              <button
                type="button"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </section>

        <section
          className="production-manager-list"
          aria-label="Productions"
        >
          {filteredProductions.length ===
          0 ? (
            <div className="production-manager-empty">
              <p>
                No productions match the selected
                filters.
              </p>

              <button
                type="button"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>
          ) : (
            filteredProductions.map(
              (production) => (
                <article
                  className="production-manager-row"
                  key={production.slug}
                >
                  <Link
                    href={`/admin/edit-production/${production.slug}`}
                    className="production-manager-image"
                    aria-label={`Edit ${production.title}`}
                  >
                    <Image
                      src={`/images/productions/${production.slug}/${production.hero}`}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1000px) 13rem, 16rem"
                    />
                  </Link>

                  <div className="production-manager-copy">
                    <h2>
                      <Link
                        href={`/admin/edit-production/${production.slug}`}
                      >
                        {production.title}
                      </Link>
                    </h2>

                    <p>
                      {production.venue}

                      <span aria-hidden="true">
                        {" "}
                        ·{" "}
                      </span>

                      {productionDate(
                        production.month,
                        production.year,
                      )}
                    </p>
                  </div>

                  <div className="production-manager-information">
                    <p>
                      <span>Gallery</span>
                      <strong>
                        {production.imageCount}{" "}
                        {production.imageCount === 1
                          ? "image"
                          : "images"}
                      </strong>
                    </p>

                    <p>
                      <span>Archive reference</span>
                      <strong>
                        {production.slug}
                      </strong>
                    </p>
                  </div>

                  <div className="production-manager-actions">
                    <Link
                      href={`/productions/${production.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="production-manager-view"
                    >
                      View
                    </Link>

                    <Link
                      href={`/admin/edit-production/${production.slug}`}
                      className="production-manager-edit"
                    >
                      <span>Edit</span>
                      <span aria-hidden="true">
                        →
                      </span>
                    </Link>
                  </div>
                </article>
              ),
            )
          )}
        </section>
      </div>

      <style>{`
        .production-manager {
          min-height: 100vh;
          background: #11100f;
          color: #f2eee6;
        }

        .production-manager-shell {
          width: min(92%, 92rem);
          margin: 0 auto;
          padding: 7rem 0;
        }

        .production-manager-header {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            minmax(15rem, 18rem);
          gap: clamp(3rem, 7vw, 8rem);
          align-items: end;
          margin-bottom: 5rem;
        }

        .production-manager-eyebrow {
          margin: 0;
          color: #c7a369;
          font-size: 0.54rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        .production-manager-header h1 {
          margin: 1.5rem 0 0;
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: clamp(
            5rem,
            10vw,
            10rem
          );
          font-weight: 400;
          letter-spacing: -0.07em;
          line-height: 0.82;
        }

        .production-manager-lead {
          max-width: 38rem;
          margin: 2.5rem 0 0;
          color: rgba(
            242,
            238,
            230,
            0.62
          );
          line-height: 1.75;
        }

        .production-manager-new {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 11rem;
          border: 1px solid #c7a369;
          padding: 1.7rem;
          background: #c7a369;
          color: #11100f;
          transition:
            background-color 180ms ease,
            transform 180ms ease;
        }

        .production-manager-new:hover {
          background: #f2eee6;
          transform: translateY(-0.25rem);
        }

        .production-manager-new-symbol {
          align-self: flex-end;
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: 3.5rem;
          font-weight: 400;
          line-height: 0.6;
        }

        .production-manager-new-label {
          font-size: 0.54rem;
          font-weight: 700;
          letter-spacing: 0.17em;
          text-transform: uppercase;
        }

        .production-manager-metrics {
          display: grid;
          grid-template-columns:
            repeat(
              5,
              minmax(0, 1fr)
            );
          gap: 1px;
          margin-bottom: 3rem;
          background: rgba(
            242,
            238,
            230,
            0.13
          );
        }

        .production-manager-metrics article {
          min-width: 0;
          min-height: 10rem;
          padding: 2rem;
          background: #171615;
        }

        .production-manager-metrics strong {
          display: block;
          margin-bottom: 1rem;
          color: #f2eee6;
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: clamp(
            3.25rem,
            5vw,
            5rem
          );
          font-weight: 400;
          letter-spacing: -0.045em;
          line-height: 0.85;
        }

        .production-manager-metrics span {
          color: rgba(
            242,
            238,
            230,
            0.48
          );
          font-size: 0.47rem;
          font-weight: 700;
          letter-spacing: 0.17em;
          text-transform: uppercase;
        }

        .production-manager-toolbar {
          display: grid;
          grid-template-columns:
            minmax(18rem, 1fr)
            minmax(28rem, 1.15fr);
          gap: 2rem 4rem;
          align-items: end;
          border-top:
            1px solid
            rgba(242, 238, 230, 0.18);
          border-bottom:
            1px solid
            rgba(242, 238, 230, 0.18);
          padding: 2.25rem 0 1.5rem;
        }

        .production-manager-search span,
        .production-manager-filter span {
          display: block;
          margin-bottom: 0.8rem;
          color: rgba(
            242,
            238,
            230,
            0.42
          );
          font-size: 0.48rem;
          font-weight: 700;
          letter-spacing: 0.17em;
          text-transform: uppercase;
        }

        .production-manager-search input {
          width: 100%;
          border: 0;
          border-bottom:
            1px solid
            rgba(242, 238, 230, 0.3);
          border-radius: 0;
          padding: 0.85rem 0;
          outline: none;
          background: transparent;
          color: #f2eee6;
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: 1.6rem;
        }

        .production-manager-search
          input:focus {
          border-color: #c7a369;
        }

        .production-manager-search
          input::placeholder {
          color: rgba(
            242,
            238,
            230,
            0.23
          );
        }

        .production-manager-selects {
          display: grid;
          grid-template-columns:
            minmax(7.5rem, 0.7fr)
            minmax(7.5rem, 0.7fr)
            minmax(14rem, 1.6fr);
          gap: 0;
          border:
            1px solid
            rgba(242, 238, 230, 0.22);
          background: #171615;
        }

        .production-manager-filter {
          min-width: 0;
          padding: 0.85rem 1rem;
          border-right:
            1px solid
            rgba(242, 238, 230, 0.16);
        }

        .production-manager-filter:last-child {
          border-right: 0;
        }

        .production-manager-filter span {
          margin-bottom: 0.4rem;
        }

        .production-manager-filter select {
          width: 100%;
          border: 0;
          border-radius: 0;
          padding: 0;
          outline: none;
          background: transparent;
          color: #f2eee6;
          font: inherit;
          font-size: 0.78rem;
        }

        .production-manager-filter
          select:focus {
          color: #c7a369;
        }

        .production-manager-results {
          grid-column: 1 / -1;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          padding-top: 0.5rem;
        }

        .production-manager-count {
          margin: 0;
          color: rgba(
            242,
            238,
            230,
            0.4
          );
          font-size: 0.49rem;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .production-manager-count strong {
          color: #f2eee6;
          font-weight: 700;
        }

        .production-manager-results button {
          border: 0;
          border-bottom:
            1px solid #c7a369;
          padding: 0 0 0.35rem;
          cursor: pointer;
          background: transparent;
          color: #c7a369;
          font-size: 0.48rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .production-manager-list {
          border-bottom:
            1px solid
            rgba(242, 238, 230, 0.16);
        }

        .production-manager-row {
          display: grid;
          grid-template-columns:
            16rem
            minmax(16rem, 1fr)
            minmax(12rem, 0.8fr)
            auto;
          gap: clamp(2rem, 4vw, 5rem);
          align-items: center;
          min-height: 18rem;
          border-bottom:
            1px solid
            rgba(242, 238, 230, 0.14);
          transition:
            background-color 180ms ease,
            padding 180ms ease;
        }

        .production-manager-row:hover {
          padding-inline: 1.2rem;
          background: rgba(
            255,
            255,
            255,
            0.027
          );
        }

        .production-manager-image {
          position: relative;
          width: 16rem;
          aspect-ratio: 4 / 3;
          overflow: hidden;
          background: #080808;
        }

        .production-manager-image img {
          object-fit: cover;
          transition:
            transform 600ms ease,
            filter 300ms ease;
        }

        .production-manager-row:hover
          .production-manager-image img {
          transform: scale(1.035);
        }

        .production-manager-copy h2 {
          margin: 0;
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: clamp(
            2.8rem,
            4vw,
            4.6rem
          );
          font-weight: 400;
          letter-spacing: -0.05em;
          line-height: 0.9;
        }

        .production-manager-copy h2 a {
          color: rgba(
            242,
            238,
            230,
            0.9
          );
          transition: color 180ms ease;
        }

        .production-manager-row:hover
          .production-manager-copy h2 a {
          color: #f2eee6;
        }

        .production-manager-copy p {
          margin: 1.1rem 0 0;
          color: rgba(
            242,
            238,
            230,
            0.53
          );
          font-size: 0.78rem;
          line-height: 1.75;
        }

        .production-manager-information {
          display: grid;
          gap: 1.6rem;
          min-width: 0;
        }

        .production-manager-information p {
          min-width: 0;
          margin: 0;
        }

        .production-manager-information span {
          display: block;
          margin-bottom: 0.5rem;
          color: rgba(
            242,
            238,
            230,
            0.34
          );
          font-size: 0.45rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .production-manager-information strong {
          display: block;
          overflow: hidden;
          color: rgba(
            242,
            238,
            230,
            0.57
          );
          font-size: 0.54rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          line-height: 1.5;
          text-overflow: ellipsis;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .production-manager-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 2rem;
          font-size: 0.49rem;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .production-manager-view {
          color: rgba(
            242,
            238,
            230,
            0.43
          );
          transition: color 180ms ease;
        }

        .production-manager-view:hover {
          color: #f2eee6;
        }

        .production-manager-edit {
          display: flex;
          align-items: center;
          gap: 1rem;
          color: #c7a369;
        }

        .production-manager-edit
          span:last-child {
          font-size: 1rem;
          transition:
            transform 180ms ease;
        }

        .production-manager-edit:hover
          span:last-child {
          transform:
            translateX(0.3rem);
        }

        .production-manager-empty {
          padding: 8rem 0;
          text-align: center;
        }

        .production-manager-empty p {
          margin: 0;
          color: rgba(
            242,
            238,
            230,
            0.55
          );
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: 2rem;
        }

        .production-manager-empty button {
          margin-top: 2rem;
          border: 0;
          border-bottom:
            1px solid #c7a369;
          padding: 0 0 0.4rem;
          cursor: pointer;
          background: transparent;
          color: #c7a369;
          font-size: 0.52rem;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        @media (max-width: 1180px) {
          .production-manager-row {
            grid-template-columns:
              13rem
              minmax(14rem, 1fr)
              minmax(10rem, 0.7fr)
              auto;
          }

          .production-manager-image {
            width: 13rem;
          }
        }

        @media (max-width: 1000px) {
          .production-manager-metrics {
            grid-template-columns:
              repeat(3, 1fr);
          }

          .production-manager-toolbar {
            grid-template-columns: 1fr;
          }

          .production-manager-row {
            grid-template-columns:
              11rem
              minmax(0, 1fr)
              auto;
            gap: 2.5rem;
          }

          .production-manager-image {
            width: 11rem;
          }

          .production-manager-information {
            display: none;
          }
        }

        @media (max-width: 820px) {
          .production-manager-header {
            grid-template-columns: 1fr;
            gap: 3rem;
          }

          .production-manager-new {
            min-height: 8rem;
          }

          .production-manager-metrics {
            grid-template-columns:
              repeat(2, 1fr);
          }
        }

        @media (max-width: 680px) {
          .production-manager-shell {
            width: calc(100% - 2.8rem);
            padding: 5rem 0;
          }

          .production-manager-header {
            margin-bottom: 4rem;
          }

          .production-manager-metrics {
            grid-template-columns: 1fr;
          }

          .production-manager-metrics article {
            min-height: auto;
            padding: 1.6rem;
          }

          .production-manager-selects {
            grid-template-columns: 1fr;
          }

          .production-manager-filter {
            border-right: 0;
            border-bottom:
              1px solid
              rgba(242, 238, 230, 0.16);
          }

          .production-manager-filter:last-child {
            border-bottom: 0;
          }

          .production-manager-results {
            align-items: flex-start;
            flex-direction: column;
          }

          .production-manager-row {
            grid-template-columns:
              8rem
              minmax(0, 1fr);
            gap: 1.75rem;
            min-height: auto;
            padding: 2.75rem 0;
          }

          .production-manager-row:hover {
            padding-inline: 0;
          }

          .production-manager-image {
            width: 8rem;
          }

          .production-manager-copy h2 {
            font-size: 2.5rem;
          }

          .production-manager-actions {
            grid-column: 2;
            justify-content: flex-start;
          }
        }

        @media (max-width: 480px) {
          .production-manager-row {
            grid-template-columns: 1fr;
          }

          .production-manager-image {
            width: 100%;
          }

          .production-manager-actions {
            grid-column: 1;
          }
        }
      `}</style>
    </main>
  );
}