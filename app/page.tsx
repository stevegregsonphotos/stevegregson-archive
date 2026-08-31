import Image from "next/image";
import Link from "next/link";

import selectedWorkData from "../content/selected-work.json";

const trustedBy = [
  "Young Vic",
  "Kiln",
  "MOUNTVIEW",
  "ArtsEd",
  "Guildhall School of Music & Drama",
  "Orange Tree Theatre",
  "Deus Ex Machina Productions",
  "Glyndebourne",
  "Jermyn Street Theatre",
  "Park Theatre",
];

type CategoryId = "production" | "rehearsal" | "campaign";

type SelectedWorkImage = {
  filename: string;
  alt: string;
  uploadedAt: string;
};

type SelectedWorkData = Record<
  CategoryId,
  SelectedWorkImage[]
>;

const portfolio = selectedWorkData as SelectedWorkData;

const workCards: Array<{
  id: CategoryId;
  title: string;
  description: string;
  href: string;
}> = [
  {
    id: "production",
    title: "Production Photography",
    description:
      "The energy, atmosphere and visual language of live performance.",
    href: "/selected-work#production",
  },
  {
    id: "rehearsal",
    title: "Rehearsal & Backstage",
    description:
      "The process, collaboration and quieter moments behind the performance.",
    href: "/selected-work#rehearsal",
  },
  {
    id: "campaign",
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

          <a
            href="#homepage-proof"
            className="explore-link"
          >
            <span>Explore</span>

            <span
              className="explore-line"
              aria-hidden="true"
            />
          </a>
        </div>
      </section>

      <section
        className="homepage-proof"
        id="homepage-proof"
      >
        <div className="homepage-proof-heading">
          <p>Trusted by</p>

          <h2>
            Working across professional theatre,
            production marketing and the UK&apos;s
            leading drama schools.
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
          <p>Work</p>

          <h2>
            Explore photography built around the life of a
            production.
          </h2>
        </header>

        <div className="homepage-work-grid">
          {workCards.map((item, index) => {
            const image = portfolio[item.id]?.[0];

            const imageSrc =
              item.id === "production"
                ? "/images/productions/godspell/godspell-05.jpg"
                : item.id === "rehearsal"
                  ? "/images/rehearsals/voice-of-the-turtle.jpg"
                  : item.id === "campaign"
                    ? "/images/Marketing-PR/alice-in-wonderland.webp"
                    : image
                      ? `/images/selected-work/${item.id}/${image.filename}`
                      : "/images/homepage-hero.jpg";

            const imageAlt =
              item.id === "production"
                ? "A dramatic live theatre performance photographed by Steve Gregson"
                : item.id === "rehearsal"
                  ? "Actors photographed during rehearsal by Steve Gregson"
                  : item.id === "campaign"
                    ? "Alice in Wonderland campaign artwork"
                    : image?.alt ?? "";

            const imageStyle =
              item.id === "production"
                ? {
                    objectFit: "cover" as const,
                    objectPosition: "center 95%",
                  }
                : item.id === "rehearsal"
                  ? {
                      objectFit: "cover" as const,
                      objectPosition: "44% center",
                    }
                  : undefined;

            return (
              <Link
                href={item.href}
                className="homepage-work-card"
                key={item.id}
              >
                <div className="homepage-work-card-image">
                  <Image
                    src={imageSrc}
                    alt={imageAlt}
                    fill
                    sizes="(max-width: 900px) 100vw, 33vw"
                    className="homepage-work-card-photo"
                    style={imageStyle}
                  />

                  <div
                    className={
                      item.id === "rehearsal"
                        ? "homepage-work-card-overlay homepage-work-card-overlay--rehearsal"
                        : "homepage-work-card-overlay"
                    }
                    aria-hidden="true"
                  />
                </div>

                <div className="homepage-work-card-copy">
                  <span className="homepage-work-card-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="homepage-work-card-title">
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>

                  <span className="homepage-work-card-link">
                    <span>Explore</span>
                    <span aria-hidden="true">→</span>
                  </span>
                </div>
              </Link>
            );
          })}
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