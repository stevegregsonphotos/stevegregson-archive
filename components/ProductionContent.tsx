import Link from "next/link";

import type { Production } from "../content/productions/types";
import {
  getDirectoryUrlFromData,
  type DirectoryData,
} from "../lib/directory-data";
import {
  getProductionCardImageUrl,
  getProductionImageUrl,
} from "../lib/production-image-url";
import type {
  ProductionNavigationEntry,
} from "../lib/productions-repository";
import { splitCreditNames } from "../lib/credit-names";

import { ProductionGallery } from "./ProductionGallery";

type ProductionContentProps = {
  production: Production;
  directory: DirectoryData;
  nextProduction?: ProductionNavigationEntry;
  /** Credited name → /people/<slug>, for names that have a person page. */
  personSlugs?: Record<string, string>;
  /** Set when the venue has its own /venues/<slug> page. */
  venueSlug?: string;
  /** A sector page (drama schools, opera) that fits this production better than /production. */
  serviceLink?: { href: string; label: string };
};

export default function ProductionContent({
  production,
  directory,
  nextProduction,
  personSlugs = {},
  venueSlug,
  serviceLink = { href: "/production", label: "Explore production photography" },
}: ProductionContentProps) {
  const productionUrl =
    `https://www.stevegregson.com/productions/${production.slug}`;

  const heroImageUrl =
    getProductionImageUrl(
      production.slug,
      production.hero,
    );

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CreativeWork",
        "@id": `${productionUrl}#production`,
        url: productionUrl,
        name: production.title,
        ...(production.description
          ? {
              description:
                production.description,
            }
          : {}),
        dateCreated:
          production.month
            ? `${production.year}-${String(
                production.month,
              ).padStart(2, "0")}`
            : String(production.year),
        locationCreated: {
          "@type": "Place",
          name: production.venue,
        },
        image: {
          "@id": `${productionUrl}#hero-image`,
        },
        mainEntityOfPage: productionUrl,
      },
      {
        "@type": "ImageObject",
        "@id": `${productionUrl}#hero-image`,
        contentUrl: heroImageUrl,
        url: heroImageUrl,
        caption: production.heroAlt,
        creator: {
          "@id":
            "https://www.stevegregson.com/#steve-gregson",
        },
        creditText: "Steve Gregson",
        copyrightNotice:
          "© Steve Gregson Photography",
        license:
          "https://www.stevegregson.com/policies/terms",
        acquireLicensePage:
          "https://www.stevegregson.com/contact",
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${productionUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item:
              "https://www.stevegregson.com/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Archive",
            item:
              "https://www.stevegregson.com/archive",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: production.title,
            item: productionUrl,
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            structuredData,
          ).replace(/</g, "\\u003c"),
        }}
      />

      <main className="curated-production-page">
        <section className="curated-production-hero">
          <picture className="curated-production-hero-picture">
            <source
              media="(max-width: 760px)"
              srcSet={getProductionCardImageUrl(
                production.slug,
                production.hero,
              )}
            />
            <img
              src={heroImageUrl}
              alt={production.heroAlt}
              fetchPriority="high"
              loading="eager"
              decoding="async"
              className="curated-production-hero-image"
            />
          </picture>

          <div className="curated-production-hero-overlay" />

          <div className="curated-production-hero-title">
            <p>
              {venueSlug ? (
                <Link href={`/venues/${venueSlug}`}>
                  {production.venue}
                </Link>
              ) : (
                production.venue
              )}
              <span aria-hidden="true">
                {" · "}
              </span>
              {production.year}
            </p>

            <h1>{production.title}</h1>
          </div>
        </section>

        <section className="curated-production-summary">
          <div className="curated-production-summary-copy">
            <p className="curated-production-label">
              The Production
            </p>

            <p className="curated-production-description">
              {production.description}
            </p>

            <p className="curated-production-count">
              {production.images.length + 1}{" "}
              photographs in the curated edit
            </p>
          </div>

          <dl className="curated-production-credits">
            {production.credits.map(
              (credit) => {
                const creditUrl =
                  credit.website ??
                  getDirectoryUrlFromData(
                    directory,
                    credit.name,
                  );

                return (
                  <div
                    key={`${credit.role}-${credit.name}`}
                  >
                    <dt>{credit.role}</dt>

                    <dd>
                      {(() => {
                        const names = splitCreditNames(credit.name);
                        const linked = names.length > 0 && names.every((name) => personSlugs[name]);

                        if (!linked) return null;

                        return (
                          <>
                            {names.map((name, index) => (
                              <span key={name}>
                                {index > 0 ? ", " : ""}
                                <Link href={`/people/${personSlugs[name]}`}>
                                  {name}
                                </Link>
                              </span>
                            ))}
                            {creditUrl && names.length === 1 ? (
                              <>
                                {" "}
                                <a
                                  href={creditUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`${names[0]}’s website`}
                                >
                                  <span aria-hidden="true">↗</span>
                                </a>
                              </>
                            ) : null}
                          </>
                        );
                      })() ?? (creditUrl ? (
                        <a
                          href={creditUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {credit.name}{" "}
                          <span aria-hidden="true">
                            ↗
                          </span>
                        </a>
                      ) : (
                        credit.name
                      ))}
                    </dd>
                  </div>
                );
              },
            )}
          </dl>
        </section>

        <ProductionGallery
          title={production.title}
          productionSlug={production.slug}
          hero={{
            src: production.hero,
            alt: production.heroAlt,
          }}
          images={production.images}
        />

        {nextProduction ? (
          <Link
            href={`/productions/${nextProduction.slug}`}
            className="curated-production-next"
            style={{
              backgroundImage: `
                linear-gradient(
                  90deg,
                  rgba(8, 7, 6, 0.84),
                  rgba(8, 7, 6, 0.12)
                ),
                url("${getProductionCardImageUrl(
                  nextProduction.slug,
                  nextProduction.hero,
                )}")
              `,
            }}
          >
            <span>Continue exploring</span>

            <h2>{nextProduction.title}</h2>

            <p>
              {nextProduction.venue}
              <span aria-hidden="true">
                {" · "}
              </span>
              {nextProduction.year}
              <b aria-hidden="true">
                {" ↗"}
              </b>
            </p>
          </Link>
        ) : (
          <section className="production-archive-return">
            <p>Continue exploring</p>

            <Link href="/archive">
              Return to archive
              <span aria-hidden="true">
                →
              </span>
            </Link>
          </section>
        )}

        <div className="production-service-link">
          <Link href={serviceLink.href}>
            {serviceLink.label}
            <span aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </main>
    </>
  );
}
