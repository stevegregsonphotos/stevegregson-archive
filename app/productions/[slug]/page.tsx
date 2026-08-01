import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDirectoryUrl } from "../../../lib/directory";
import { ProductionGallery } from "../../../components/ProductionGallery";
import { getProduction } from "../../../lib/productions";

type ProductionPageProps = {
  params: Promise<{
    slug: string;
  }>;
};



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
              {credit.name} <span aria-hidden="true">↗</span>
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

     {production.nextProduction ? (
  <Link
    href={`/productions/${production.nextProduction.slug}`}
    className="next-production-panel"
    style={{
      backgroundImage: `
        linear-gradient(
          90deg,
          rgba(5, 5, 5, 0.82) 0%,
          rgba(5, 5, 5, 0.38) 48%,
          rgba(5, 5, 5, 0.12) 100%
        ),
        url("${production.nextProduction.image}")
      `,
    }}
  >
    <div className="next-production-content">
      <p className="next-production-label">
        Continue exploring
      </p>

      <h2>{production.nextProduction.title}</h2>

      <p className="next-production-meta">
        {production.nextProduction.venue}
        <span aria-hidden="true"> · </span>
        {production.nextProduction.year}
      </p>

      <span className="next-production-enter">
        Enter production
        <span aria-hidden="true">→</span>
      </span>
    </div>

    <span
      className="next-production-number"
      aria-hidden="true"
    >
      Next
    </span>
  </Link>
) : (
  <section className="production-archive-return">
    <p>Continue exploring</p>

    <Link href="/productions">
      Return to productions
      <span aria-hidden="true">→</span>
    </Link>
  </section>
)}
    </main>
  );
}