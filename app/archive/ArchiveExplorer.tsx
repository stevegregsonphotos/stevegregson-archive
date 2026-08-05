"use client";

import Image from "next/image";
import Link from "next/link";
import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

type ProductionCredit = {
  role: string;
  name: string;
  website?: string;
};

type ArchiveProduction = {
  slug: string;
  title: string;
  venue: string;
  year: number;
  description: string;
  hero: string;
  heroAlt: string;
  credits: ProductionCredit[];
};

type ArchiveContextValue = {
  query: string;
  setQuery: (value: string) => void;
};

const ArchiveContext =
  createContext<ArchiveContextValue | null>(null);

export function ArchiveProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState("");

  return (
    <ArchiveContext.Provider
      value={{ query, setQuery }}
    >
      {children}
    </ArchiveContext.Provider>
  );
}

function useArchiveSearch() {
  const context = useContext(ArchiveContext);

  if (!context) {
    throw new Error(
      "ArchiveExplorer must be used inside ArchiveProvider.",
    );
  }

  return context;
}

type Props = {
  productions: ArchiveProduction[];
  mode: "search" | "results";
};

function normalise(value: string | number) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function searchableText(
  production: ArchiveProduction,
) {
  return normalise(
    [
      production.title,
      production.venue,
      production.year,
      production.description,
      ...production.credits.flatMap((credit) => [
        credit.role,
        credit.name,
      ]),
    ].join(" "),
  );
}

export default function ArchiveExplorer({
  productions,
  mode,
}: Props) {
  const { query, setQuery } = useArchiveSearch();

  const filteredProductions = useMemo(() => {
    const terms = normalise(query)
      .split(/\s+/)
      .filter(Boolean);

    if (terms.length === 0) {
      return productions;
    }

    return productions.filter((production) => {
      const haystack = searchableText(production);

      return terms.every((term) =>
        haystack.includes(term),
      );
    });
  }, [productions, query]);

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;

  if (mode === "search") {
    return (
      <>
        <section
          className="archive-search-compact"
          aria-label="Search production archive"
        >
          <label
            htmlFor="archive-search-input"
            className="archive-search-label"
          >
            Search the archive
          </label>

          <div className="archive-search-row">
            <input
              id="archive-search-input"
              type="search"
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search productions, venues, people or years"
              autoComplete="off"
              spellCheck={false}
            />

            {hasQuery ? (
              <button
                type="button"
                className="archive-search-clear"
                onClick={() => setQuery("")}
                aria-label="Clear archive search"
              >
                Clear
              </button>
            ) : (
              <span
                className="archive-search-icon"
                aria-hidden="true"
              >
                ⌕
              </span>
            )}
          </div>
        </section>

        <style jsx>{`
          .archive-search-compact {
            width: min(100%, 25rem);
          }

          .archive-search-label {
            position: absolute;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip: rect(0 0 0 0);
            white-space: nowrap;
          }

          .archive-search-row {
            display: grid;
            grid-template-columns:
              minmax(0, 1fr) auto;
            gap: 1rem;
            align-items: center;
            border-bottom: 1px solid
              rgba(242, 238, 230, 0.24);
            transition:
              border-color 300ms
              cubic-bezier(0.22, 1, 0.36, 1);
          }

          .archive-search-row:focus-within {
            border-color: #c7a369;
          }

          input {
            min-width: 0;
            border: 0;
            outline: 0;
            padding: 0.65rem 0 0.75rem;
            background: transparent;
            color: #f2eee6;
            font: inherit;
            font-size: 0.8rem;
            letter-spacing: 0.015em;
          }

          input::placeholder {
            color: rgba(242, 238, 230, 0.42);
          }

          input::-webkit-search-cancel-button {
            display: none;
          }

          .archive-search-icon {
            color: rgba(242, 238, 230, 0.5);
            font-size: 1rem;
            line-height: 1;
          }

          .archive-search-clear {
            border: 0;
            padding: 0;
            background: transparent;
            color: #c7a369;
            cursor: pointer;
            font: inherit;
            font-size: 0.51rem;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
          }

          .archive-search-clear:focus-visible {
            outline: 1px solid #c7a369;
            outline-offset: 0.35rem;
          }

          @media (max-width: 900px) {
            .archive-search-compact {
              width: 100%;
            }

            input {
              font-size: 0.85rem;
            }
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <section
        className="archive-results-header"
        aria-live="polite"
        aria-atomic="true"
      >
        <p>
          {filteredProductions.length}{" "}
          {filteredProductions.length === 1
            ? "production"
            : "productions"}
          {hasQuery ? (
            <span>
              {" "}
              matching “{trimmedQuery}”
            </span>
          ) : null}
        </p>
      </section>

      {filteredProductions.length > 0 ? (
        <section
          className="archive-grid"
          aria-label="Production archive"
        >
          {filteredProductions.map(
            (production, index) => (
              <article
                className="archive-card"
                key={production.slug}
              >
                <Link
                  href={`/productions/${production.slug}`}
                  className="archive-card-main"
                >
                  <div className="archive-card-image">
                    <Image
                      src={`/images/productions/${production.slug}/${production.hero}`}
                      alt={production.heroAlt}
                      fill
                      sizes="(max-width: 700px) calc(100vw - 2.8rem), (max-width: 1100px) 46vw, 29vw"
                      priority={index < 3}
                    />
                  </div>

                  <div className="archive-card-copy">
                    <p className="archive-card-meta">
                      <span>{production.venue}</span>
                      <span
                        className="archive-card-separator"
                        aria-hidden="true"
                      >
                        ·
                      </span>
                      <span>{production.year}</span>
                    </p>

                    <h2>{production.title}</h2>

                    <span className="archive-card-link">
                      View production
                      <span aria-hidden="true">
                        →
                      </span>
                    </span>
                  </div>
                </Link>
              </article>
            ),
          )}
        </section>
      ) : (
        <section
          className="archive-empty"
          aria-live="polite"
        >
          <p>No matches</p>

          <h2>
            Nothing in the archive matches
            “{trimmedQuery}”.
          </h2>

          <button
            type="button"
            onClick={() => setQuery("")}
          >
            Clear search
          </button>
        </section>
      )}

      <style jsx>{`
        .archive-results-header {
          border-top: 1px solid
            rgba(242, 238, 230, 0.1);
          padding: 1.35rem 0 2.25rem;
        }

        .archive-results-header p {
          margin: 0;
          color: #c7a369;
          font-size: 0.53rem;
          font-weight: 700;
          letter-spacing: 0.14em;
        }

        .archive-results-header span {
          color: rgba(242, 238, 230, 0.46);
          font-weight: 600;
        }

        .archive-grid {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: clamp(5.5rem, 7vw, 7.5rem)
            clamp(1.8rem, 3vw, 3.25rem);
        }

        .archive-card {
          min-width: 0;
        }

        .archive-card-main {
          display: block;
          color: inherit;
          text-decoration: none;
        }

        .archive-card-main:focus-visible {
          outline: none;
        }

        .archive-card-image {
          position: relative;
          aspect-ratio: 16 / 10;
          overflow: hidden;
          background: #191817;
        }

        .archive-card-image :global(img) {
          object-fit: cover;
          transition:
            transform 900ms
            cubic-bezier(0.22, 1, 0.36, 1),
            opacity 400ms ease;
        }

        .archive-card-copy {
          min-height: 10.5rem;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          border-top: 1px solid
            rgba(242, 238, 230, 0.12);
          padding-top: 1.2rem;
        }

        .archive-card-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          margin: 0 0 1rem;
          color: rgba(242, 238, 230, 0.46);
          font-size: 0.52rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          line-height: 1.5;
          text-transform: uppercase;
        }

        .archive-card-separator {
          color: rgba(199, 163, 105, 0.7);
        }

        .archive-card-copy h2 {
          max-width: 13ch;
          margin: 0;
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: clamp(2rem, 2.6vw, 3.15rem);
          font-weight: 400;
          letter-spacing: -0.05em;
          line-height: 0.96;
          text-wrap: balance;
        }

        .archive-card-link {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          margin-top: auto;
          padding-top: 1.5rem;
          color: #c7a369;
          font-size: 0.54rem;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .archive-card-link > span {
          transition:
            transform 300ms
            cubic-bezier(0.22, 1, 0.36, 1);
        }

        .archive-card-main:hover
          .archive-card-image
          :global(img) {
          transform: scale(1.018);
        }

        .archive-card-main:hover
          .archive-card-link
          > span {
          transform: translateX(0.3rem);
        }

        .archive-card-main:focus-visible
          .archive-card-image {
          outline: 1px solid #c7a369;
          outline-offset: 0.35rem;
        }

        .archive-card-main:focus-visible
          .archive-card-link {
          text-decoration: underline;
          text-underline-offset: 0.35rem;
        }

        .archive-empty {
          min-height: 44vh;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          border-top: 1px solid
            rgba(242, 238, 230, 0.12);
          padding: 4rem 0;
        }

        .archive-empty > p {
          margin: 0;
          color: #c7a369;
          font-size: 0.53rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .archive-empty h2 {
          max-width: 15ch;
          margin: 1.5rem 0 2.25rem;
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: clamp(2.5rem, 5vw, 5.5rem);
          font-weight: 400;
          letter-spacing: -0.045em;
          line-height: 0.95;
          overflow-wrap: anywhere;
          text-wrap: balance;
        }

        .archive-empty button {
          border: 0;
          border-bottom: 1px solid
            rgba(199, 163, 105, 0.7);
          padding: 0 0 0.45rem;
          background: transparent;
          color: #c7a369;
          cursor: pointer;
          font-size: 0.54rem;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .archive-empty button:focus-visible {
          outline: 1px solid #c7a369;
          outline-offset: 0.45rem;
        }

        @media (max-width: 1100px) {
          .archive-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .archive-card-copy h2 {
            max-width: 15ch;
          }
        }

        @media (max-width: 700px) {
          .archive-results-header {
            padding-bottom: 1.75rem;
          }

          .archive-grid {
            grid-template-columns: 1fr;
            gap: 4.75rem;
          }

          .archive-card-copy {
            min-height: auto;
          }

          .archive-card-copy h2 {
            max-width: 16ch;
            font-size: clamp(
              2.25rem,
              10vw,
              3.4rem
            );
          }

          .archive-card-link {
            margin-top: 0;
            padding-top: 1.5rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .archive-card-image :global(img),
          .archive-card-link > span {
            transition: none;
          }

          .archive-card-main:hover
            .archive-card-image
            :global(img) {
            transform: none;
          }
        }
      `}</style>
    </>
  );
}