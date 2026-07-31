import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduction, productions } from "@/lib/productions";

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
          <p>{production.venue}</p>
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
          {production.credits.map((credit) => (
            <div key={credit.role}>
              <dt>{credit.role}</dt>
              <dd>{credit.name}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        className="curated-production-gallery"
        aria-label={`${production.title} photography`}
      >
        {production.images.map((image, index) => (
          <figure
            className={`curated-production-shot curated-production-shot-${image.layout}`}
            key={image.src}
          >
            <Image
              src={`${imageDirectory}/${image.src}`}
              alt={image.alt}
              width={2000}
              height={1333}
              sizes="(max-width: 768px) 100vw, 90vw"
            />

            <figcaption>
              {String(index + 2).padStart(2, "0")} /{" "}
              {String(production.images.length + 1).padStart(2, "0")}
            </figcaption>
          </figure>
        ))}
      </section>

      {production.nextProduction ? (
        <Link
          href={`/productions/${production.nextProduction.slug}`}
          className="curated-production-next"
          style={{
            backgroundImage: `
              linear-gradient(
                90deg,
                rgba(8, 7, 6, 0.84),
                rgba(8, 7, 6, 0.12)
              ),
              url("${production.nextProduction.image}")
            `,
          }}
        >
          <span>Continue exploring</span>
          <h2>{production.nextProduction.title}</h2>
          <p>
            Enter production <b aria-hidden="true">↗</b>
          </p>
        </Link>
      ) : (
        <section className="production-archive-return">
          <p>Continue exploring</p>

          <Link href="/productions">
            Return to productions <span>→</span>
          </Link>
        </section>
      )}
    </main>
  );
}