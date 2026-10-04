import type { Metadata } from "next";
import Link from "next/link";

import "../directory.css";
import {
  NameRow,
} from "../../components/directory/DirectoryParts";
import PeopleSearch from "../../components/directory/PeopleSearch";
import {
  getDirectoryData,
  MIN_VENUE_PRODUCTIONS,
  primaryRoleLabel,
  ROLE_GROUPS,
} from "../../lib/people-directory";

export const revalidate = false; // Rebuilt only when Backstage changes something (on-demand revalidation).

const DESCRIPTION =
  "Directors, designers, choreographers and theatre-makers photographed by London theatre photographer Steve Gregson, with every production they worked on.";

export const metadata: Metadata = {
  title: "People in the Archive",
  description: DESCRIPTION,
  alternates: { canonical: "/people" },
  openGraph: {
    type: "website",
    url: "/people",
    title: "People in the Archive | Steve Gregson",
    description: DESCRIPTION,
    images: [{ url: "/images/homepage-hero.webp", width: 2048, height: 1365, alt: "Theatre production photography by Steve Gregson" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "People in the Archive | Steve Gregson",
    description: DESCRIPTION,
    images: ["/images/homepage-hero.webp"],
  },
};

const TOP_PER_GROUP = 6;

export default async function PeoplePage() {
  const { people, venues, productionCount } = await getDirectoryData();

  const groups = ROLE_GROUPS.map((group) => {
    const members = people.filter((person) =>
      person.groups.includes(group.key),
    );
    const top = [...members]
      .sort(
        (a, b) =>
          b.productions.length - a.productions.length ||
          a.name.localeCompare(b.name),
      )
      .slice(0, TOP_PER_GROUP);
    return { ...group, count: members.length, top };
  }).filter((group) => group.count > 0);

  const searchIndex = people.map((person) => ({
    n: person.name,
    s: person.slug,
    r: primaryRoleLabel(person),
    c: person.productions.length,
  }));

  const venueLinks = venues
    .filter((venue) => venue.productions.length >= MIN_VENUE_PRODUCTIONS)
    .slice(0, 6);

  return (
    <main className="dir-page">
      <div className="dir-wrap">
        <section className="dir-intro">
          <div className="dir-intro-copy">
            <p className="dir-eyebrow">The creative community</p>
            <h1>People</h1>
            <p className="dir-lead">
              The directors, designers, choreographers and musicians behind the
              productions in this archive. Each has a page gathering every show
              photographed with them.
            </p>
          </div>

          <dl className="dir-stats">
            <div>
              <dt>People</dt>
              <dd>{people.length}</dd>
            </div>
            <div>
              <dt>Productions</dt>
              <dd>{productionCount}</dd>
            </div>
          </dl>
        </section>

        <section className="dir-tools" aria-label="Find people">
          <PeopleSearch people={searchIndex} />

          <ul className="dir-chips">
            <li>
              <Link href="/people" aria-current="page">
                All
              </Link>
            </li>
            {groups.map((group) => (
              <li key={group.key}>
                <Link href={`/people/roles/${group.key}`}>
                  {group.plural} · {group.count}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="dir-columns">
          {groups.map((group) => (
            <section className="dir-list" key={group.key} aria-labelledby={`group-${group.key}`}>
              <div className="dir-list-heading">
                <h2 className="dir-label" id={`group-${group.key}`}>
                  {group.plural}
                </h2>
                <span className="dir-label">{group.count}</span>
              </div>
              <ul>
                {group.top.map((person) => (
                  <NameRow
                    key={person.slug}
                    href={`/people/${person.slug}`}
                    name={person.name}
                    meta={String(person.productions.length)}
                  />
                ))}
              </ul>
              {group.count > group.top.length ? (
                <Link className="dir-more" href={`/people/roles/${group.key}`}>
                  All {group.count} {group.plural.toLowerCase()} →
                </Link>
              ) : null}
            </section>
          ))}
        </div>

        {venueLinks.length > 0 ? (
          <p className="dir-section dir-muted">
            Venues:{" "}
            {venueLinks.map((venue, index) => (
              <span key={venue.slug}>
                {index > 0 ? " · " : ""}
                <Link href={`/venues/${venue.slug}`}>{venue.name}</Link>
              </span>
            ))}
            {" · "}
            <Link className="dir-more" href="/venues">
              All venues →
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}
