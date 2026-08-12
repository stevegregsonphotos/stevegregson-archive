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
    };
  }

  return {
    title: `${production.title} | Steve Gregson`,
    description: `${production.title} at ${production.venue}, photographed by Steve Gregson.`,
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

  return (
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
  );
}