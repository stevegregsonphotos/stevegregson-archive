import type { Metadata } from "next";

import "../directory.css";
import {
  Breadcrumbs,
  NameRow,
} from "../../components/directory/DirectoryParts";
import {
  getDirectoryData,
  MIN_VENUE_PRODUCTIONS,
  productionCountLabel,
  yearRange,
} from "../../lib/people-directory";

export const revalidate = 3600;

const DESCRIPTION =
  "Theatres and venues photographed by London theatre photographer Steve Gregson, with every production shot at each one.";

export const metadata: Metadata = {
  title: "Venues",
  description: DESCRIPTION,
  alternates: { canonical: "/venues" },
  openGraph: { type: "website", url: "/venues", title: "Venues | Steve Gregson", description: DESCRIPTION },
};

export default async function VenuesPage() {
  const { venues } = await getDirectoryData();
  const listed = venues.filter((venue) => venue.productions.length >= MIN_VENUE_PRODUCTIONS);
  const half = Math.ceil(listed.length / 2);

  return (
    <main className="dir-page">
      <div className="dir-wrap">
        <Breadcrumbs items={[{ name: "Archive", href: "/archive" }, { name: "Venues" }]} />

        <section className="dir-intro">
          <div className="dir-intro-copy">
            <p className="dir-eyebrow">Where the work happens</p>
            <h1>Venues</h1>
            <p className="dir-lead">
              Theatres, drama schools and opera houses where productions in the
              archive were photographed, with the most frequent first.
            </p>
          </div>
          <dl className="dir-stats">
            <div>
              <dt>Venues</dt>
              <dd>{listed.length}</dd>
            </div>
          </dl>
        </section>

        <div className="dir-columns">
          {[listed.slice(0, half), listed.slice(half)].map((column, index) => (
            <section className="dir-list" key={index} aria-label={index === 0 ? "Venues, part one" : "Venues, part two"}>
              <ul>
                {column.map((venue) => (
                  <NameRow
                    key={venue.slug}
                    href={`/venues/${venue.slug}`}
                    name={venue.name}
                    meta={`${productionCountLabel(venue.productions.length)} · ${yearRange(venue.productions)}`}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
