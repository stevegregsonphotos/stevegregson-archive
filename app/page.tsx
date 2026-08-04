import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="homepage">
<section className="homepage-hero relative">
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

  <Link
    href="/selected-work"
    className="explore-link"
  >
    <span>Explore</span>
    <span
      className="explore-line"
      aria-hidden="true"
    />
  </Link>
</div>
      </section>
    </main>
  );
}