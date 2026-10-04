import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import {
  getProductionCardImageUrl,
  getProductionImageUrl,
} from "../lib/production-image-url";
import {
  getSelectedWorkImageUrl,
} from "../lib/selected-work-image-url";
import {
  getCachedSelectedWork,
} from "../lib/public-data-cache";

export const metadata: Metadata = {
  title: {
    absolute: "London Theatre Photographer | Steve Gregson",
  },
  description:
    "Steve Gregson is an award-winning London theatre photographer whose work includes productions at the Young Vic, Kiln Theatre, Orange Tree Theatre and in the West End.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Steve Gregson | London Theatre Photographer",
    description:
      "Steve Gregson is an award-winning London theatre photographer whose work includes productions at the Young Vic, Kiln Theatre, Orange Tree Theatre and in the West End.",
    url: "/",
    images: [
      {
        url: "/images/homepage-hero.webp",
        width: 2048,
        height: 1365,
        alt: "Theatre production photography by Steve Gregson",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Steve Gregson | London Theatre Photographer",
    description:
      "Steve Gregson is an award-winning London theatre photographer whose work includes productions at the Young Vic, Kiln Theatre, Orange Tree Theatre and in the West End.",
    images: ["/images/homepage-hero.webp"],
  },
};

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
  "Guildford School of Acting",
  "Mischief Worldwide",
  "London School of Musical Theatre",
  "Polka Theatre",
  "Arcola Theatre",
  "Rose Bruford College",
  "Waterperry Opera",
  "Chickenshed Theatre",
  "Emil Dale Academy",
  "Hackney Empire",
  "Regents Opera",
  "London Studio Centre",
  "Marlowe Theatre",
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
    href: "/selected-work",
  },
  {
    id: "rehearsal",
    title: "Rehearsal & Backstage",
    description:
      "The process, collaboration and quieter moments behind the performance.",
    href: "/rehearsals",
  },
  {
    id: "campaign",
    title: "Marketing & PR",
    description:
      "Distinctive imagery created for press, publicity and production marketing.",
    href: "/marketing-pr",
  },
];

export default async function Home() {
  const portfolio =
    await getCachedSelectedWork() as SelectedWorkData;

  return (
    <main className="homepage">
      <section className="homepage-hero">
        <picture className="homepage-hero-picture">
          <source
            media="(max-width: 900px)"
            srcSet="/images/homepage-hero-mobile.webp"
          />
          <img
            src="/images/homepage-hero.webp"
            alt="A dramatic theatre production photographed by Steve Gregson"
            fetchPriority="high"
            loading="eager"
            decoding="async"
            className="homepage-hero-image"
          />
        </picture>

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
            Steve Gregson is an award-winning London theatre photographer
            whose work includes productions at the Young Vic, Kiln Theatre,
            Orange Tree Theatre and in the West End.
          </p>
</div>

        <div className="hero-footer">
          <div className="hero-categories">
            <Link href="/selected-work">
              Production Photography
            </Link>

            <Link href="/rehearsals">
              Rehearsal &amp; Backstage
            </Link>

            <Link href="/marketing-pr">
              Marketing &amp; PR
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
              <p className="homepage-proof-label">
                Trusted by
              </p>

              <div
                className="homepage-client-marquee"
                aria-label="Selected clients"
              >
                <div className="homepage-client-track">
                  <div className="homepage-client-group">
                    {trustedBy.map((client) => (
                      <span key={client}>
                        {client}
                        <i aria-hidden="true">·</i>
                      </span>
                    ))}
                  </div>

                  <div
                    className="homepage-client-group"
                    aria-hidden="true"
                  >
                    {trustedBy.map((client) => (
                      <span key={`repeat-${client}`}>
                        {client}
                        <i aria-hidden="true">·</i>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

      <section className="homepage-work">
        <header className="homepage-work-heading">
         

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
                ? getProductionCardImageUrl(
                    "godspell",
                    "GODSPELL-Genesis-58.webp",
                  )
                : item.id === "rehearsal"
                  ? "/images/rehearsals/voice-of-the-turtle.webp"
                  : item.id === "campaign"
                    ? "/images/Marketing-PR/alice-in-wonderland.webp"
                    : image
                      ? getSelectedWorkImageUrl(item.id, image.filename)
                      : "/images/homepage-hero.webp";

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

      <section
        className="homepage-credentials"
        aria-label="Professional credentials"
      >
        <div>
          <span>Professional accreditation</span>
          <p>
            Qualified &amp; endorsed by the British Institute of
            Professional Photography
          </p>
        </div>

        <div>
          <span>International recognition</span>
          <p>
            Award-winning theatrical photography recognised by the
            Federation of European Photographers
          </p>
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