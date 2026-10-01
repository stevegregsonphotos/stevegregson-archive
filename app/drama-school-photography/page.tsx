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
  type Question,
} from "../../components/services/ServiceParts";
import { getProductionImageUrl } from "../../lib/production-image-url";
import { productionCountLabel, yearRange } from "../../lib/people-directory";
import { getSectorData } from "../../lib/sectors";

export const revalidate = 3600;

const PAGE_URL = "/drama-school-photography";
const TITLE = "Drama School Production Photography";
const DESCRIPTION =
  "Production and rehearsal photography for drama schools and conservatoires by London theatre photographer Steve Gregson, for schools including GSA, Mountview, ArtsEd and Rose Bruford.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: { type: "website", url: PAGE_URL, title: `${TITLE} | Steve Gregson`, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: `${TITLE} | Steve Gregson`, description: DESCRIPTION },
};

const QUESTIONS: Question[] = [
  {
    question: "Can you photograph a whole season?",
    answer: (
      <p>
        Yes. Many schools book several productions across a term or a season, and
        planning them together makes scheduling simpler for everyone.
      </p>
    ),
  },
  {
    question: "Will every student be photographed?",
    answer: (
      <p>
        I always aim to capture everyone on stage, not only the leads, so every
        student has photographs of their work.
      </p>
    ),
  },
  {
    question: "Can students use the photographs?",
    answer: (
      <p>
        Yes. While they are studying at the school where the photographs were taken,
        students may use them on their Spotlight page, website and social media, as
        long as they are credited “Steve Gregson Photography” and, on a website, the
        credit links to stevegregson.com. After graduating, they can keep using them
        on their Spotlight page and personal website as part of their portfolio. The
        details are in section 3.8 of my{" "}
        <Link href="/policies/terms">terms and conditions</Link>.
      </p>
    ),
  },
  {
    question: "When should we book?",
    answer: (
      <p>
        As soon as your dates are set. My calendar fills quickly, and some schools and
        companies book more than a year ahead.
      </p>
    ),
  },
];

export default async function DramaSchoolPhotographyPage() {
  const { dramaSchools } = await getSectorData();
  const { productions, schools } = dramaSchools;

  if (productions.length === 0) {
    return null;
  }

  const [feature] = productions;
  const topSchools = schools.slice(0, 4).map((school) => school.name);
  const firstYear = Math.min(...productions.map((production) => production.year));
  const crumbs = [
    { name: "Commissions", href: "/commissions" },
    { name: "Drama schools", href: PAGE_URL },
  ];

  return (
    <main className="dir-page">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            serviceJsonLd({
              url: PAGE_URL,
              name: TITLE,
              serviceType: "Drama school production photography",
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
            <p className="dir-eyebrow">Drama schools &amp; conservatoires</p>
            <h1>Drama school photography</h1>
            <p className="dir-lead">
              Production and rehearsal photography for drama schools and
              conservatoires. Since {firstYear} I have photographed{" "}
              {productionCountLabel(productions.length)} for {schools.length}{" "}
              {schools.length === 1 ? "school" : "schools"}, including{" "}
              {listSentence(topSchools)}, from full-scale musicals to new writing
              and graduate seasons.
            </p>
          </div>

          <dl className="dir-stats">
            <div>
              <dt>Productions</dt>
              <dd>{productions.length}</dd>
            </div>
            <div>
              <dt>Schools</dt>
              <dd>{schools.length}</dd>
            </div>
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
            <p className="dir-label">Education</p>
            <h2>I understand how a school works</h2>
            <p>
              Alongside over 25 years in theatre, I spent more than a decade
              working in education. I know what a training production means to the
              students in it, and how tightly a school’s season is scheduled.
            </p>
          </li>
          <li>
            <p className="dir-label">The whole company</p>
            <h2>Ensembles, not just leads</h2>
            <p>
              Student productions are ensemble work. I photograph both the scale of
              the big company numbers and the detail of individual performances.
            </p>
          </li>
          <li>
            <p className="dir-label">Images that work hard</p>
            <h2>For the school and its students</h2>
            <p>
              Photographs for prospectuses, websites, social media and open days,
              and a lasting record of every graduating year’s work.
            </p>
          </li>
        </ul>

        <div className="dir-two-col">
          <section className="dir-list" aria-labelledby="schools-heading">
            <div className="dir-list-heading">
              <h2 className="dir-label" id="schools-heading">Schools photographed</h2>
            </div>
            <ul>
              {schools.map((school) =>
                school.venueSlug ? (
                  <NameRow
                    key={school.name}
                    href={`/venues/${school.venueSlug}`}
                    name={school.name}
                    meta={`${productionCountLabel(school.productions.length)} · ${yearRange(school.productions)}`}
                  />
                ) : (
                  <li key={school.name} className="dir-row">
                    <span className="dir-row-name">{school.name}</span>
                    <span className="dir-row-meta">
                      {productionCountLabel(school.productions.length)} · {yearRange(school.productions)}
                    </span>
                  </li>
                ),
              )}
            </ul>
          </section>

          <section aria-labelledby="questions-heading">
            <div className="dir-list-heading">
              <h2 className="dir-label" id="questions-heading">Questions schools ask</h2>
            </div>
            <Questions items={QUESTIONS} />
          </section>
        </div>

        <section className="dir-section" aria-labelledby="productions-heading">
          <div className="dir-section-head">
            <h2 id="productions-heading">Recent drama school productions</h2>
            <Link className="dir-label" href="/archive">
              Full archive →
            </Link>
          </div>
          <ul className="dir-cards">
            {productions.slice(1, 13).map((production) => (
              <ProductionCard
                key={production.slug}
                production={production}
                meta={`${production.venue} · ${production.year}`}
              />
            ))}
          </ul>
        </section>

        <section className="dir-cta">
          <div>
            <h2>Planning your next season?</h2>
            <p>
              Send me your dates and I’ll come back with availability and a quote.
              You can also read <Link href="/commissions">how a commission works</Link>.
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
