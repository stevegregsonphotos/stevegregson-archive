import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductionGallery } from "../../../components/ProductionGallery";
import { getDirectoryUrl } from "../../../lib/directory";
import {
  getNextProduction,
  getProduction,
  productions,
} from "../../../lib/productions";

type ProductionPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

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

  const nextProduction = getNextProduction(slug);
  const imageDirectory = `/images/productions/${production.slug}`;

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
        />

        <div className="curated-production-hero-overlay" />

        <div className="curated-production-hero-title">
          <p>
  {production.venue}
  <span aria-hidden="true"> · </span>
  {production.year}
</p>

<h1>{production.title}</h1>
        </div>
      </section>

      <section className="curated-production-summary">
        <div className="curated-production-summary-copy">
          <p className="curated-production-label">The Production</p>

          <p className="curated-production-description">
            {production.description}
          </p>

          <p className="curated-production-count">
            {production.images.length + 1} photographs in the curated edit
          </p>
        </div>

        <dl className="curated-production-credits">
          {production.credits.map((credit) => {
            const creditUrl =
              credit.website ?? getDirectoryUrl(credit.name);

            return (
              <div key={`${credit.role}-${credit.name}`}>
                <dt>{credit.role}</dt>

                <dd>
                  {creditUrl ? (
                    <a
                      href={creditUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {credit.name}{" "}
                      <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    credit.name
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <ProductionGallery
        title={production.title}
        imageDirectory={imageDirectory}
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
          <span>Continue exploring</span>

          <h2>{nextProduction.title}</h2>

          <p>
            {nextProduction.venue}
            <span aria-hidden="true"> · </span>
            {nextProduction.year}
            <b aria-hidden="true"> ↗</b>
          </p>
        </Link>
      ) : (
        <section className="production-archive-return">
          <p>Continue exploring</p>

          <Link href="/archive">
            Return to archive
            <span aria-hidden="true">→</span>
          </Link>
        </section>
      )}
    </main>
  );
}