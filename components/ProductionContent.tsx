import Image from "next/image";
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

import { ProductionGallery } from "./ProductionGallery";

type ProductionContentProps = {
  production: Production;
  directory: DirectoryData;
  nextProduction?: ProductionNavigationEntry;
};

export default function ProductionContent({
  production,
  directory,
  nextProduction,
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
          <Image
            src={heroImageUrl}
            alt={production.heroAlt}
            fill
            priority
            sizes="100vw"
            className="curated-production-hero-image"
            placeholder={
              production.heroBlurDataURL
                ? "blur"
                : "empty"
            }
            blurDataURL={
              production.heroBlurDataURL
            }
          />

          <div className="curated-production-hero-overlay" />

          <div className="curated-production-hero-title">
            <p>
              {production.venue}
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
                      {creditUrl ? (
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
                      )}
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
          <Link href="/production">
            Explore production photography
            <span aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </main>
    </>
  );
}
