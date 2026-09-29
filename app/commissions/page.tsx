import type { Metadata } from "next";
import Link from "next/link";

import "../directory.css";
import "../services.css";
import {
  breadcrumbJsonLd,
  JsonLd,
  SITE_URL,
} from "../../components/directory/DirectoryParts";
import {
  faqJsonLd,
  Questions,
  ToConfirm,
  type Question,
} from "../../components/services/ServiceParts";
import { getSectorData } from "../../lib/sectors";
import { getDirectoryData } from "../../lib/people-directory";

export const revalidate = 3600;

const PAGE_URL = "/commissions";
const TITLE = "Commissioning Theatre Photography";
const DESCRIPTION =
  "How to commission London theatre photographer Steve Gregson: production, rehearsal, marketing, drama school and opera photography, how a shoot works, licensing and common questions.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: { type: "website", url: PAGE_URL, title: `${TITLE} | Steve Gregson`, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: `${TITLE} | Steve Gregson`, description: DESCRIPTION },
};

const STEPS = [
  {
    title: "Enquiry",
    body: (
      <>
        Tell me about the production: dates, venue, and what the photographs are for.
        The <Link href="/contact">contact form</Link> asks for the essentials, and it’s
        fine if you don’t know everything yet.
      </>
    ),
  },
  {
    title: "Planning",
    body: (
      <>
        We agree the coverage — which rehearsal or performance, any moments the
        director or marketing team particularly need — and the licence that fits how
        the images will be used.
      </>
    ),
  },
  {
    title: "The shoot",
    body: (
      <>
        I work discreetly around the company, drawing on almost two decades inside
        theatre to anticipate the moments that tell the story.
      </>
    ),
  },
  {
    title: "Editing",
    body: (
      <>
        I professionally edit the photographs and select the images that give the
        strongest coverage of the work, so you receive a finished set rather than
        every frame.
      </>
    ),
  },
  {
    title: "Delivery",
    body: (
      <>
        <ToConfirm>
          Finished images are delivered through a private online gallery within
          [number] working days, with a faster press selection available on request.
        </ToConfirm>
      </>
    ),
  },
];

const QUESTIONS: Question[] = [
  {
    question: "How much does it cost?",
    answer: (
      <p>
        <ToConfirm>
          Every commission is quoted individually, depending on the kind of shoot,
          how long it takes and the licence you need. Send me the details for a quote.
        </ToConfirm>
      </p>
    ),
  },
  {
    question: "How quickly will we receive the photographs?",
    answer: (
      <p>
        <ToConfirm>State your usual turnaround, and whether a small press selection can be sent sooner.</ToConfirm>
      </p>
    ),
  },
  {
    question: "Who owns the copyright?",
    answer: (
      <p>
        Copyright stays with me, and you receive a licence to use the photographs for
        the purposes we agree. Full details are in my{" "}
        <Link href="/policies/terms">terms and conditions</Link>.
      </p>
    ),
    answerText:
      "Copyright stays with Steve Gregson, and the client receives a licence to use the photographs for the purposes agreed.",
  },
  {
    question: "What licences are available?",
    answer: (
      <p>
        One-year, two-year and perpetual licences, each set out on the quotation or
        invoice. Licences are non-exclusive unless we agree otherwise, and use after
        a licence ends needs a new agreement.
      </p>
    ),
    answerText:
      "One-year, two-year and perpetual licences, each set out on the quotation or invoice. Licences are non-exclusive unless agreed otherwise.",
  },
  {
    question: "How should the photographs be credited?",
    answer: <p>As “Steve Gregson Photography”, unless we agree a different credit in writing.</p>,
    answerText: "As “Steve Gregson Photography”, unless a different credit is agreed in writing.",
  },
  {
    question: "Can we edit or retouch the images?",
    answer: (
      <p>
        Resizing needed for an agreed use is fine. Anything that materially changes a
        photograph, such as retouching, compositing or filters, needs my permission
        first.
      </p>
    ),
    answerText:
      "Resizing needed for an agreed use is fine. Anything that materially changes a photograph, such as retouching, compositing or filters, needs permission first.",
  },
  {
    question: "Can the photographs be used with AI tools?",
    answer: (
      <p>
        Not unless it is agreed in writing. No licence includes using the images to
        train or feed AI or machine-learning systems.
      </p>
    ),
    answerText:
      "Not unless agreed in writing. No licence includes using the images to train or feed AI or machine-learning systems.",
  },
  {
    question: "When is payment due?",
    answer: (
      <p>
        Within 28 days of the invoice, by bank transfer (BACS preferred). Unless we
        agree otherwise, licensed use starts once the invoice has been paid.
      </p>
    ),
    answerText:
      "Within 28 days of the invoice, by bank transfer. Unless agreed otherwise, licensed use starts once the invoice has been paid.",
  },
  {
    question: "Do you work outside London?",
    answer: (
      <p>
        Yes. I’m based in London and work across the UK and internationally.{" "}
        <ToConfirm>Explain how travel and accommodation are charged.</ToConfirm>
      </p>
    ),
  },
];

export default async function CommissionsPage() {
  const [{ dramaSchools, opera, totalProductions }, directory] = await Promise.all([
    getSectorData(),
    getDirectoryData(),
  ]);

  const tiles = [
    {
      href: "/production",
      label: "Production",
      title: "Production photography",
      body: "Performance and dress-rehearsal photography that captures the production as audiences experience it.",
    },
    {
      href: "/rehearsals",
      label: "Rehearsals",
      title: "Rehearsal photography",
      body: "The making of the work, from the first rehearsal-room days to the technical rehearsal.",
    },
    {
      href: "/marketing-pr",
      label: "Marketing & PR",
      title: "Campaign photography",
      body: "Publicity and campaign images created to sell the show before it opens.",
    },
    ...(dramaSchools.productions.length > 0
      ? [{
          href: "/drama-school-photography",
          label: `${dramaSchools.productions.length} productions`,
          title: "Drama schools",
          body: "Production and rehearsal photography for drama schools and conservatoires, season after season.",
        }]
      : []),
    ...(opera.productions.length > 0
      ? [{
          href: "/opera-photography",
          label: `${opera.productions.length} productions`,
          title: "Opera",
          body: "Opera and music theatre, from full stagings to new work in unexpected spaces.",
        }]
      : []),
    {
      href: "/archive",
      label: `${totalProductions} productions`,
      title: "The archive",
      body: `Every production photographed, searchable by venue, year and the ${directory.people.length} people who made them.`,
    },
  ];

  const crumbs = [{ name: "Commissions", href: PAGE_URL }];

  return (
    <main className="dir-page">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebPage",
              "@id": `${SITE_URL}${PAGE_URL}`,
              name: TITLE,
              description: DESCRIPTION,
              url: `${SITE_URL}${PAGE_URL}`,
              about: { "@id": `${SITE_URL}/#steve-gregson` },
            },
            breadcrumbJsonLd(crumbs),
            ...[faqJsonLd(QUESTIONS, PAGE_URL)].filter(Boolean),
          ],
        }}
      />

      <div className="dir-wrap">
        <section className="dir-intro">
          <div className="dir-intro-copy">
            <p className="dir-eyebrow">Working together</p>
            <h1>Commissions</h1>
            <p className="dir-lead">
              Production, rehearsal and campaign photography for theatres, producers,
              drama schools and opera companies. Here is what I photograph, how a
              commission works, and answers to the questions I’m asked most.
            </p>
          </div>
        </section>

        <section className="dir-section" aria-labelledby="work-heading">
          <div className="dir-section-head">
            <h2 id="work-heading">What I photograph</h2>
          </div>
          <ul className="svc-tiles">
            {tiles.map((tile) => (
              <li key={tile.href}>
                <Link href={tile.href}>
                  <span>
                    <span className="dir-label">{tile.label}</span>
                    <h3>{tile.title}</h3>
                    <p>{tile.body}</p>
                  </span>
                  <span className="svc-tile-go">Explore →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="dir-section" id="how-it-works" aria-labelledby="steps-heading">
          <div className="dir-section-head">
            <h2 id="steps-heading">How a commission works</h2>
          </div>
          <ol className="svc-steps">
            {STEPS.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="dir-section" id="questions" aria-labelledby="faq-heading">
          <div className="dir-section-head">
            <h2 id="faq-heading">Questions</h2>
            <Link className="dir-label" href="/policies/terms">
              Terms &amp; conditions →
            </Link>
          </div>
          <Questions items={QUESTIONS} />
        </section>

        <section className="dir-cta">
          <div>
            <h2>Have a production in mind?</h2>
            <p>Tell me about it — even if the details are still taking shape.</p>
          </div>
          <Link className="dir-button" href="/contact">
            Start a conversation →
          </Link>
        </section>
      </div>
    </main>
  );
}
