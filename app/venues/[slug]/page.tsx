import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import "../../directory.css";
import PhotoLicenseJsonLd from "../../../components/PhotoLicenseJsonLd";
import {
  breadcrumbJsonLd,
  Breadcrumbs,
  JsonLd,
  NameRow,
  ProductionCard,
  SITE_URL,
} from "../../../components/directory/DirectoryParts";
import { getProductionImageUrl } from "../../../lib/production-image-url";
import {
  getDirectoryData,
  MIN_VENUE_PRODUCTIONS,
  productionCountLabel,
  yearRange,
} from "../../../lib/people-directory";
import { isDramaSchoolVenue } from "../../../lib/sectors";

export const revalidate = false; // Rebuilt only when Backstage changes something (on-demand revalidation).

export async function generateStaticParams() {
  return [];
}

type VenuePageProps = {
  params: Promise<{ slug: string }>;
};

async function findVenue(slug: string) {
  const { venues } = await getDirectoryData();
  return venues.find(
    (item) => item.slug === slug && item.productions.length >= MIN_VENUE_PRODUCTIONS,
  );
}

function titlesSentence(titles: string[]) {
  if (titles.length === 1) return titles[0];
  return `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
}

export async function generateMetadata({
  params,
}: VenuePageProps): Promise<Metadata> {
  const { slug } = await params;
  const venue = await findVenue(slug);

  if (!venue) {
    return { title: "Venue not found", robots: { index: false, follow: false } };
  }

  const years = yearRange(venue.productions);
  const title = `${venue.name} Production Photography`;
  const description = `${productionCountLabel(venue.productions.length)} at ${venue.name} photographed by London theatre photographer Steve Gregson (${years}), including ${titlesSentence(venue.productions.slice(0, 2).map((p) => p.title))}.`;
  const image = getProductionImageUrl(venue.productions[0].slug, venue.productions[0].hero);

  return {
    title,
    description,
    alternates: { canonical: `/venues/${venue.slug}` },
    openGraph: {
      type: "website",
      url: `/venues/${venue.slug}`,
      title: `${title} | Steve Gregson`,
      description,
      images: [{ url: image, alt: venue.productions[0].heroAlt || venue.productions[0].title }],
    },
    twitter: { card: "summary_large_image", title: `${title} | Steve Gregson`, description, images: [image] },
  };
}

export default async function VenuePage({ params }: VenuePageProps) {
  const { slug } = await params;
  const venue = await findVenue(slug);

  if (!venue) notFound();

  const [feature, ...rest] = venue.productions;
  const years = [...new Set(venue.productions.map((production) => production.year))];
  const restYears = [...new Set(rest.map((production) => production.year))];
  const crumbs = [
    { name: "Archive", href: "/archive" },
    { name: "Venues", href: "/venues" },
    { name: venue.name, href: `/venues/${venue.slug}` },
  ];

  return (
    <main className="dir-page">
      <PhotoLicenseJsonLd
        pagePath={`/venues/${venue.slug}`}
        photos={venue.productions.map((production) => ({
          src: getProductionImageUrl(production.slug, production.hero),
          alt: production.heroAlt || production.title,
        }))}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              "@id": `${SITE_URL}/venues/${venue.slug}`,
              name: `${venue.name}: productions photographed by Steve Gregson`,
              url: `${SITE_URL}/venues/${venue.slug}`,
              about: { "@type": "PerformingArtsTheater", name: venue.name },
              hasPart: venue.productions.map((production) => ({
                "@type": "CreativeWork",
                name: production.title,
                url: `${SITE_URL}/productions/${production.slug}`,
                dateCreated: String(production.year),
              })),
            },
            breadcrumbJsonLd(crumbs),
          ],
        }}
      />

      <div className="dir-wrap">
        <Breadcrumbs items={crumbs.map((crumb, index) => (index === crumbs.length - 1 ? { name: crumb.name } : crumb))} />

        <section className="dir-intro">
          <div className="dir-intro-copy">
            <p className="dir-eyebrow">Venue</p>
            <h1>{venue.name}</h1>
            <p className="dir-lead">
              {productionCountLabel(venue.productions.length)} photographed at{" "}
              {venue.name}, including{" "}
              {titlesSentence(venue.productions.slice(0, 3).map((production) => production.title))}.
            </p>
          </div>

          <dl className="dir-stats">
            <div>
              <dt>Productions</dt>
              <dd>{venue.productions.length}</dd>
            </div>
            <div>
              <dt>{years.length === 1 ? "Year" : "Years"}</dt>
              <dd>{yearRange(venue.productions)}</dd>
            </div>
            {venue.directors.length > 0 ? (
              <div>
                <dt>Directors</dt>
                <dd>{venue.directors.length}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <Link className="dir-feature" href={`/productions/${feature.slug}`}>
          <Image
            src={getProductionImageUrl(feature.slug, feature.hero)}
            alt={feature.heroAlt || feature.title}
            fill
            sizes="(max-width: 1600px) 88vw, 1400px"
            priority
          />
          <span className="dir-feature-caption">
            <span>
              <span className="dir-label">Most recent</span>
              <h2>{feature.title}</h2>
              <span className="dir-card-meta">{feature.year}</span>
            </span>
            <span className="dir-label">View production →</span>
          </span>
        </Link>

        <section className="dir-section" aria-labelledby="productions-heading">
          <div className="dir-section-head">
            <h2 id="productions-heading">Productions</h2>
            {years.length > 1 ? (
              <ul className="dir-chips" style={{ marginTop: 0 }}>
                {restYears.map((year) => (
                  <li key={year}>
                    <a href={`#year-${year}`}>
                      {year} · {rest.filter((production) => production.year === year).length}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {restYears.map((year) => (
            <div key={year} id={`year-${year}`}>
              {restYears.length > 1 ? <h3 className="dir-label dir-letter">{year}</h3> : null}
              <ul className="dir-cards">
                {rest
                  .filter((production) => production.year === year)
                  .map((production) => (
                    <ProductionCard
                      key={production.slug}
                      production={production}
                      meta={production.director ? `${production.year} · Dir. ${production.director}` : String(production.year)}
                    />
                  ))}
              </ul>
            </div>
          ))}
        </section>

        <div className="dir-two-col">
          {venue.directors.length > 0 ? (
            <section className="dir-list" aria-labelledby="directors-heading">
              <div className="dir-list-heading">
                <h2 className="dir-label" id="directors-heading">Directors at {venue.name}</h2>
              </div>
              <ul>
                {venue.directors.slice(0, 8).map((director) => (
                  <NameRow
                    key={director.slug}
                    href={`/people/${director.slug}`}
                    name={director.name}
                    meta={productionCountLabel(director.count)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          <section className="dir-cta" style={{ marginTop: 0, alignSelf: "start" }}>
            {isDramaSchoolVenue(venue.name) ? (
              <div>
                <h2>Planning your next season?</h2>
                <p>
                  Production and rehearsal photography for drama schools and
                  conservatoires.{" "}
                  <Link href="/drama-school-photography" style={{ textDecoration: "underline" }}>
                    How I work with schools
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <div>
                <h2>Producing at {venue.name}?</h2>
                <p>
                  Production, rehearsal and press photography for companies playing{" "}
                  {venue.name}.
                </p>
              </div>
            )}
            <Link className="dir-button" href="/contact">
              Start a conversation →
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
