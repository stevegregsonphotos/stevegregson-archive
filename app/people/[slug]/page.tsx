import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import "../../directory.css";
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
  ROLE_GROUPS,
  yearRange,
  type PersonEntry,
} from "../../../lib/people-directory";

export const revalidate = false; // Rebuilt only when Backstage changes something (on-demand revalidation).

export async function generateStaticParams() {
  return [];
}

type PersonPageProps = {
  params: Promise<{ slug: string }>;
};

async function findPerson(slug: string) {
  const { people, venues } = await getDirectoryData();
  const person = people.find((item) => item.slug === slug);
  const movedTo = person ? undefined : people.find((item) => item.altSlugs.includes(slug))?.slug;
  return { person, venues, movedTo };
}

function roleLabels(person: PersonEntry) {
  const labels = person.groups
    .map((key) => ROLE_GROUPS.find((group) => group.key === key)?.label)
    .filter((label): label is (typeof ROLE_GROUPS)[number]["label"] => Boolean(label));
  return labels.length > 0 ? labels : person.roles.slice(0, 2);
}

function listTitles(titles: string[]) {
  const unique = [...new Set(titles)];
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")} and ${unique[unique.length - 1]}`;
}

function summary(person: PersonEntry) {
  const count = person.productions.length;
  const titles = person.productions.slice(0, 3).map((production) => production.title);
  const venueNames = person.venues.slice(0, 2).map((venue) => venue.name);
  const where = venueNames.length > 0 ? ` at ${listTitles(venueNames)}` : "";

  if (count === 1) {
    return `${person.productions[0].title}${where}, ${person.productions[0].year}, photographed by Steve Gregson.`;
  }

  const years = person.productions.map((production) => production.year);
  const first = Math.min(...years);
  const last = Math.max(...years);
  const when = first === last ? `in ${first}` : `from ${first} to ${last}`;

  return `${count} productions photographed${where} ${when}, including ${listTitles(titles)}.`;
}

export async function generateMetadata({
  params,
}: PersonPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { person } = await findPerson(slug);

  if (!person) {
    return { title: "Person not found", robots: { index: false, follow: false } };
  }

  const role = roleLabels(person)[0];
  const title = `${person.name}, ${role}`;
  const description = `${productionCountLabel(person.productions.length)} with ${person.name} photographed by London theatre photographer Steve Gregson, including ${listTitles(person.productions.slice(0, 3).map((p) => p.title))}.`;
  const image = getProductionImageUrl(person.productions[0].slug, person.productions[0].hero);

  return {
    title,
    description,
    alternates: { canonical: `/people/${person.slug}` },
    openGraph: {
      type: "profile",
      url: `/people/${person.slug}`,
      title: `${title} | Steve Gregson`,
      description,
      images: [{ url: image, alt: person.productions[0].heroAlt || person.productions[0].title }],
    },
    twitter: { card: "summary_large_image", title: `${title} | Steve Gregson`, description, images: [image] },
  };
}

/** "https://www.alexmusgrave.co.uk/lighting" → "alexmusgrave.co.uk" */
function displayDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
  }
}

export default async function PersonPage({ params }: PersonPageProps) {
  const { slug } = await params;
  const { person, venues, movedTo } = await findPerson(slug);

  if (!person && movedTo) permanentRedirect(`/people/${movedTo}`);
  if (!person) notFound();

  const roles = roleLabels(person);
  const [feature, ...rest] = person.productions;
  const venuePages = new Set(
    venues.filter((venue) => venue.productions.length >= MIN_VENUE_PRODUCTIONS).map((venue) => venue.slug),
  );
  const firstGroup = ROLE_GROUPS.find((group) => group.key === person.groups[0]);

  const crumbs = [
    { name: "People", href: "/people" },
    ...(firstGroup ? [{ name: firstGroup.plural, href: `/people/roles/${firstGroup.key}` }] : []),
    { name: person.name, href: `/people/${person.slug}` },
  ];

  return (
    <main className="dir-page">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              "@id": `${SITE_URL}/people/${person.slug}`,
              name: `${person.name}: productions photographed by Steve Gregson`,
              url: `${SITE_URL}/people/${person.slug}`,
              about: {
                "@type": "Person",
                name: person.name,
                jobTitle: roles[0],
                ...(person.website ? { sameAs: [person.website] } : {}),
              },
              hasPart: person.productions.map((production) => ({
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
            <p className="dir-eyebrow">{roles.join(" · ")}</p>
            <h1>{person.name}</h1>
            <p className="dir-lead">{summary(person)}</p>
            {person.website ? (
              <a
                className="dir-person-site"
                href={person.website}
                target="_blank"
                rel="noopener"
                aria-label={`${person.name}’s website (opens in a new tab)`}
              >
                <span>{displayDomain(person.website)}</span>
                <span className="dir-person-site-arrow" aria-hidden="true">→</span>
              </a>
            ) : null}
          </div>

          <dl className="dir-stats">
            <div>
              <dt>{person.productions.length === 1 ? "Production" : "Productions"}</dt>
              <dd>{person.productions.length}</dd>
            </div>
            {person.venues.length > 1 ? (
              <div>
                <dt>Venues</dt>
                <dd>{person.venues.length}</dd>
              </div>
            ) : null}
            <div>
              <dt>{person.productions.length === 1 ? "Year" : "Years"}</dt>
              <dd>{yearRange(person.productions)}</dd>
            </div>
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
              <span className="dir-card-meta">
                {feature.venue} · {feature.year}
              </span>
            </span>
            <span className="dir-label">View production →</span>
          </span>
        </Link>

        {rest.length > 0 ? (
          <section className="dir-section" aria-labelledby="productions-heading">
            <div className="dir-section-head">
              <h2 id="productions-heading">Productions</h2>
              <span className="dir-label">Newest first</span>
            </div>
            <ul className="dir-cards">
              {rest.map((production) => (
                <ProductionCard
                  key={production.slug}
                  production={production}
                  meta={`${production.venue} · ${production.year}`}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {person.collaborators.length > 0 || person.venues.length > 0 ? (
          <div className="dir-two-col">
            {person.collaborators.length > 0 ? (
              <section className="dir-list" aria-labelledby="collaborators-heading">
                <div className="dir-list-heading">
                  <h2 className="dir-label" id="collaborators-heading">Often works with</h2>
                </div>
                <ul>
                  {person.collaborators.map((collaborator) => (
                    <NameRow
                      key={`${collaborator.slug}-${collaborator.role}`}
                      href={`/people/${collaborator.slug}`}
                      name={collaborator.name}
                      meta={`${collaborator.role} · ${collaborator.count} together`}
                    />
                  ))}
                </ul>
              </section>
            ) : null}

            {person.venues.length > 0 ? (
              <section className="dir-list" aria-labelledby="venues-heading">
                <div className="dir-list-heading">
                  <h2 className="dir-label" id="venues-heading">Venues</h2>
                </div>
                <ul>
                  {person.venues.map((venue) =>
                    venuePages.has(venue.slug) ? (
                      <NameRow
                        key={venue.slug}
                        href={`/venues/${venue.slug}`}
                        name={venue.name}
                        meta={productionCountLabel(venue.count)}
                      />
                    ) : (
                      <li key={venue.slug} className="dir-row">
                        <span className="dir-row-name">{venue.name}</span>
                        <span className="dir-row-meta">{productionCountLabel(venue.count)}</span>
                      </li>
                    ),
                  )}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}

        <section className="dir-cta">
          <div>
            <h2>Working on a new production?</h2>
            <p>
              Production, rehearsal and press photography from a photographer who
              has worked inside theatre for over 25 years.
            </p>
          </div>
          <Link className="dir-button" href="/contact">
            Start a conversation →
          </Link>
        </section>
      </div>
    </main>
  );
}
