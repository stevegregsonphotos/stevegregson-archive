import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import "../directory.css";
import "../services.css";
import {
  breadcrumbJsonLd,
  Breadcrumbs,
  JsonLd,
  NameRow,
  ProductionCard,
} from "../../components/directory/DirectoryParts";
import {
  faqJsonLd,
  listSentence,
  Questions,
  serviceJsonLd,
  ToConfirm,
  type Question,
} from "../../components/services/ServiceParts";
import { getProductionImageUrl } from "../../lib/production-image-url";
import { productionCountLabel, yearRange } from "../../lib/people-directory";
import { getSectorData } from "../../lib/sectors";

export const revalidate = 3600;

const PAGE_URL = "/opera-photography";
const TITLE = "Opera Photography";
const DESCRIPTION =
  "Opera production and rehearsal photography by London photographer Steve Gregson, from staged Ring cycle operas to new opera, for companies and festivals.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: { type: "website", url: PAGE_URL, title: `${TITLE} | Steve Gregson`, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: `${TITLE} | Steve Gregson`, description: DESCRIPTION },
};

const QUESTIONS: Question[] = [
  {
    question: "Can you photograph during a performance?",
    answer: (
      <p>
        <ToConfirm>
          Say whether you shoot live performances, dress rehearsals or both, and that
          you use a silent shutter so nothing is heard from the stage or the pit.
        </ToConfirm>
      </p>
    ),
  },
  {
    question: "Do you photograph rehearsals as well?",
    answer: (
      <p>
        Yes. Rehearsal photography, from the music call to the stage and piano
        rehearsal, is often what a company needs first for press and social media.
        See <Link href="/rehearsals">rehearsal photography</Link>.
      </p>
    ),
    answerText:
      "Yes. Rehearsal photography, from the music call to the stage and piano rehearsal, is often what a company needs first for press and social media.",
  },
  {
    question: "Can the singers use the photographs?",
    answer: (
      <p>
        <ToConfirm>
          Explain how singers and creative teams can license images for their own
          websites and publicity.
        </ToConfirm>{" "}
        All use is licensed under my <Link href="/policies/terms">terms and conditions</Link>.
      </p>
    ),
  },
];

export default async function OperaPhotographyPage() {
  const { opera } = await getSectorData();
  const { productions, companies, venues } = opera;

  if (productions.length === 0) {
    return null;
  }

  const [feature] = productions;
  const crumbs = [
    { name: "Commissions", href: "/commissions" },
    { name: "Opera", href: PAGE_URL },
  ];
  const namedCompanies = companies.slice(0, 3).map((company) => company.name);

  return (
    <main className="dir-page">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            serviceJsonLd({
              url: PAGE_URL,
              name: TITLE,
              serviceType: "Opera production photography",
              description: DESCRIPTION,
            }),
            breadcrumbJsonLd(crumbs),
            ...[faqJsonLd(QUESTIONS, PAGE_URL)].filter(Boolean),
          ],
        }}
      />

      <div className="dir-wrap">
        <Breadcrumbs items={[crumbs[0], { name: crumbs[1].name }]} />

        <section className="dir-intro">
          <div className="dir-intro-copy">
            <p className="dir-eyebrow">Opera &amp; music theatre</p>
            <h1>Opera photography</h1>
            <p className="dir-lead">
              Production and rehearsal photography for opera companies and
              festivals. {productionCountLabel(productions.length)} photographed
              {namedCompanies.length > 0 ? <> for companies including {listSentence(namedCompanies)}</> : null},
              from staged Wagner to new opera.
            </p>
          </div>

          <dl className="dir-stats">
            <div>
              <dt>Productions</dt>
              <dd>{productions.length}</dd>
            </div>
            {venues.length > 1 ? (
              <div>
                <dt>Venues</dt>
                <dd>{venues.length}</dd>
              </div>
            ) : null}
            <div>
              <dt>Years</dt>
              <dd>{yearRange(productions)}</dd>
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

        <ul className="svc-points">
          <li>
            <p className="dir-label">Light and scale</p>
            <h2>Grand gestures, intimate spaces</h2>
            <p>
              Opera happens in Masonic temples, boxing halls, gardens and studio
              theatres as often as opera houses. My background in lighting and
              theatrical design helps me read a space and its light quickly.
            </p>
          </li>
          <li>
            <p className="dir-label">The music</p>
            <h2>Timed to the score</h2>
            <p>
              The strongest opera photographs land on the musical moment, not just
              the stage picture. I work with the creative team to know where those
              moments fall.
            </p>
          </li>
          <li>
            <p className="dir-label">Use</p>
            <h2>For press, programmes and seasons ahead</h2>
            <p>
              Images for reviews, programmes, funders and future fundraising, and a
              record of productions that often exist for only a handful of nights.
            </p>
          </li>
        </ul>

        <div className="dir-two-col">
          <section className="dir-list" aria-labelledby="companies-heading">
            {companies.length > 0 ? (
              <>
                <div className="dir-list-heading">
                  <h2 className="dir-label" id="companies-heading">Companies &amp; festivals</h2>
                </div>
                <ul>
                  {companies.map((company) => (
                    <li key={company.name} className="dir-row">
                      <span className="dir-row-name">{company.name}</span>
                      <span className="dir-row-meta">{productionCountLabel(company.count)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <div className="dir-list-heading" style={{ marginTop: companies.length > 0 ? "3.5rem" : 0 }}>
              <h2 className="dir-label">Venues</h2>
            </div>
            <ul>
              {venues.map((venue) =>
                venue.slug ? (
                  <NameRow
                    key={venue.name}
                    href={`/venues/${venue.slug}`}
                    name={venue.name}
                    meta={productionCountLabel(venue.count)}
                  />
                ) : (
                  <li key={venue.name} className="dir-row">
                    <span className="dir-row-name">{venue.name}</span>
                    <span className="dir-row-meta">{productionCountLabel(venue.count)}</span>
                  </li>
                ),
              )}
            </ul>
          </section>

          <section aria-labelledby="questions-heading">
            <div className="dir-list-heading">
              <h2 className="dir-label" id="questions-heading">Questions companies ask</h2>
            </div>
            <Questions items={QUESTIONS} />
          </section>
        </div>

        {productions.length > 1 ? (
          <section className="dir-section" aria-labelledby="productions-heading">
            <div className="dir-section-head">
              <h2 id="productions-heading">Opera in the archive</h2>
              <span className="dir-label">Newest first</span>
            </div>
            <ul className="dir-cards">
              {productions.slice(1).map((production) => (
                <ProductionCard
                  key={production.slug}
                  production={production}
                  meta={`${production.venue} · ${production.year}`}
                />
              ))}
            </ul>
          </section>
        ) : null}

        <section className="dir-cta">
          <div>
            <h2>Planning a new production?</h2>
            <p>
              Send me your dates and venue and I’ll come back with availability and a
              quote. You can also read <Link href="/commissions">how a commission works</Link>.
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
