import {
  createHash,
  timingSafeEqual,
} from "node:crypto";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import ProductionAccessGate from "../../../components/ProductionAccessGate";
import { ProductionGallery } from "../../../components/ProductionGallery";
import { getDirectoryUrl } from "../../../lib/directory";
import {
  getNextProduction,
  getProduction,
  productions,
} from "../../../lib/productions";

export const dynamic = "force-dynamic";

type ProductionPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function createAccessToken(
  slug: string,
  passwordHash: string,
) {
  return createHash("sha256")
    .update(
      `steve-gregson-production-access:${slug}:${passwordHash}`,
      "utf8",
    )
    .digest("hex");
}

function cookieName(slug: string) {
  return `sg-production-access-${slug}`;
}

function safeCompare(
  first: string,
  second: string,
) {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);

  if (
    firstBuffer.length !==
    secondBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    firstBuffer,
    secondBuffer,
  );
}

export function generateStaticParams() {
  return productions.map((production) => ({
    slug: production.slug,
  }));
}

export async function generateMetadata({
  params,
}: ProductionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const production = getProduction(slug);

  if (!production) {
    return {
      title: "Production not found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  if (production.access === "password") {
    return {
      title: production.title,
      robots: {
        index: false,
        follow: false,
        noarchive: true,
      },
    };
  }

  const canonicalPath =
    `/productions/${production.slug}`;

  const title =
    `${production.title} — Theatre Photography at ${production.venue}`;

  const description =
    `${production.title} at ${production.venue} (${production.year}), photographed by London theatre photographer Steve Gregson. ${production.description}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: "article",
      url: canonicalPath,
      title,
      description,
      images: [
        {
          url: `/images/productions/${production.slug}/${production.hero}`,
          alt: production.heroAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        `/images/productions/${production.slug}/${production.hero}`,
      ],
    },
  };
}

export default async function ProductionPage({
  params,
}: ProductionPageProps) {
  const { slug } = await params;
  const production = getProduction(slug);

  if (!production) {
    notFound();
  }

  if (
    production.access === "password"
  ) {
    const passwordHash =
      production.accessPasswordHash;

    let hasAccess = false;

    if (passwordHash) {
      const cookieStore =
        await cookies();

      const storedToken =
        cookieStore.get(
          cookieName(production.slug),
        )?.value;

      if (storedToken) {
        const expectedToken =
          createAccessToken(
            production.slug,
            passwordHash,
          );

        hasAccess = safeCompare(
          storedToken,
          expectedToken,
        );
      }
    }

    if (!hasAccess) {
      return (
        <ProductionAccessGate
          slug={production.slug}
          title={production.title}
          venue={production.venue}
          year={production.year}
        />
      );
    }
  }

  const nextProduction =
    getNextProduction(slug);

  const imageDirectory =
    `/images/productions/${production.slug}`;

  const productionUrl =
    `https://www.stevegregson.com/productions/${production.slug}`;

  const heroImageUrl =
    `https://www.stevegregson.com${imageDirectory}/${production.hero}`;

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
        dateCreated: String(production.year),
        locationCreated: {
          "@type": "Place",
          name: production.venue,
        },
        creator: {
          "@id":
            "https://www.stevegregson.com/#steve-gregson",
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
          src={`${imageDirectory}/${production.hero}`}
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
              {" "}
              ·{" "}
            </span>
            {production.year}
          </p>

          <h1>
            {production.title}
          </h1>
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
                getDirectoryUrl(
                  credit.name,
                );

              return (
                <div
                  key={`${credit.role}-${credit.name}`}
                >
                  <dt>
                    {credit.role}
                  </dt>

                  <dd>
                    {creditUrl ? (
                      <a
                        href={creditUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {credit.name}{" "}
                        <span
                          aria-hidden="true"
                        >
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
        imageDirectory={
          imageDirectory
        }
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
              url("/images/productions/${nextProduction.slug}/${nextProduction.hero}")
            `,
          }}
        >
          <span>
            Continue exploring
          </span>

          <h2>
            {nextProduction.title}
          </h2>

          <p>
            {nextProduction.venue}
            <span aria-hidden="true">
              {" "}
              ·{" "}
            </span>
            {nextProduction.year}
            <b aria-hidden="true">
              {" "}
              ↗
            </b>
          </p>
        </Link>
      ) : (
        <section className="production-archive-return">
          <p>
            Continue exploring
          </p>

          <Link href="/archive">
            Return to archive
            <span aria-hidden="true">
              →
            </span>
          </Link>
        </section>
      )}
    </main>
    </>
  );
}