import Image from "next/image";
import Link from "next/link";

const trustedBy = [
  "National Theatre",
  "Chichester Festival Theatre",
  "Mountview",
  "ArtsEd",
  "Guildhall School of Music & Drama",
  "Royal Conservatoire of Scotland",
  "Jermyn Street Theatre",
];

const selectedWork = [
  {
    title: "Production Photography",
    description:
      "The energy, atmosphere and visual language of live performance.",
    href: "/selected-work#production",
  },
  {
    title: "Rehearsal & Backstage",
    description:
      "The process, collaboration and quieter moments behind the performance.",
    href: "/selected-work#rehearsal",
  },
  {
    title: "Campaign & PR",
    description:
      "Distinctive imagery created for press, publicity and production marketing.",
    href: "/selected-work#campaign",
  },
];

export default function Home() {
  return (
    <main className="homepage">
      <section className="homepage-hero">
        <Image
          src="/images/homepage-hero.jpg"
          alt="A dramatic theatre production photographed by Steve Gregson"
          fill
          priority
          sizes="100vw"
          className="homepage-hero-image"
        />

        <div className="homepage-hero-overlay" />

        <div className="selected-work">
          <span>Selected work</span>
          <span>2020–2026</span>
        </div>

        <div className="hero-content">
          <p className="hero-location">
            London · United Kingdom · International
          </p>

          <h1>
            Theatre photography
            <br />
            that lives beyond
            <br />
            the closing night.
          </h1>

          <p className="hero-subheading">
            Great photography ensures it is never forgotten.
          </p>
        </div>

        <div className="hero-footer">
          <div className="hero-categories">
            <Link href="/selected-work#production">
              Production Photography
            </Link>

            <Link href="/selected-work#campaign">
              Campaign &amp; PR
            </Link>

            <Link href="/selected-work#rehearsal">
              Rehearsal &amp; Backstage
            </Link>
          </div>

          <a href="#homepage-proof" className="explore-link">
            <span>Explore</span>
            <span className="explore-line" aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="homepage-proof" id="homepage-proof">
        <div className="homepage-proof-heading">
          <p>Trusted by</p>

          <h2>
            Working across professional theatre, production marketing
            and some of the UK&apos;s leading drama schools.
          </h2>
        </div>

        <div
          className="homepage-client-list"
          aria-label="Selected clients"
        >
          {trustedBy.map((client, index) => (
            <span key={client}>
              {client}
              {index < trustedBy.length - 1 ? (
                <i aria-hidden="true">·</i>
              ) : null}
            </span>
          ))}
        </div>
      </section>

      <section className="homepage-work">
        <header className="homepage-work-heading">
          <p>Selected work</p>

          <h2>
            Explore photography built around the life of a
            production.
          </h2>
        </header>

        <div className="homepage-work-list">
          {selectedWork.map((item, index) => (
            <Link
              href={item.href}
              className="homepage-work-row"
              key={item.title}
            >
              <span className="homepage-work-number">
                {String(index + 1).padStart(2, "0")}
              </span>

              <div className="homepage-work-copy">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>

              <span
                className="homepage-work-arrow"
                aria-hidden="true"
              >
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="homepage-enquiry">
        <p>Planning a production?</p>

        <h2>
          <span>Every Production</span>
          <span>Deserves</span>
          <span>Striking Photography.</span>
        </h2>

        <Link href="/contact">
          <span>Start a conversation</span>
          <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}