import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About | Steve Gregson",
  description:
    "Steve Gregson is a London-based theatre and performing arts photographer.",
};

export default function AboutPage() {
  return (
    <>
      <main className="about">
        <section className="hero">
          <div className="intro">
            <p className="eyebrow">About Steve</p>

            <h1>
              Inside theatre.
              <br />
              Behind the camera.
            </h1>

            <p className="lead">
              I create striking photography for theatre, live performance and
              the people who bring productions to life.
            </p>
          </div>

          <div className="portrait">
            <Image
              src="/images/portrait/steve-gregson.jpg"
              alt="Steve Gregson, theatre and performing arts photographer"
              fill
              priority
              sizes="(max-width: 850px) 100vw, 42vw"
            />
          </div>
        </section>

        <section className="biography">
          <aside>
            <p>Theatre exists for a moment.</p>
            <p>Photography ensures it is never forgotten.</p>
          </aside>

          <div className="copy">
            <p>
              I am a London-based theatre photographer specialising in
              production, live arts and portrait photography. My work is
              shaped by almost two decades inside theatre and the performing
              arts, alongside more than a decade working in education.
            </p>

            <p>
              Before working professionally behind the camera, I worked across
              performance, technical management, theatrical design, teaching
              and lighting. That experience gives me an instinctive
              understanding of staging, light, rhythm and the collective
              vision behind a production.
            </p>

            <p>
              It also allows me to work calmly and collaboratively with
              directors, designers, performers and marketing teams—anticipating
              the moments that tell the story while respecting the production
              taking place around me.
            </p>

            <p>
              Creativity remains central to everything I do. My background in
              theatrical design enables me to bring an additional visual
              perspective to portrait and campaign work, including the design
              and construction of sets for conceptual shoots.
            </p>

            <p>
              I bring experience, knowledge, enthusiasm and humour to every
              commission. Originally from the North East of England, I approach
              each shoot with warmth, adaptability and a professional,
              straightforward manner.
            </p>

            <p>
              Whether photographing a major production, a drama-school
              showcase or performers taking to the stage for the first time, I
              give every project the same care, energy and attention.
            </p>
          </div>
        </section>

        <section className="credentials">
          <article>
            <span>Professional accreditation</span>
            <h2>British Institute of Professional Photography</h2>
          </article>

          <article>
            <span>International recognition</span>
            <h2>Federation of European Photographers</h2>
          </article>

          <article>
            <span>Industry perspective</span>
            <h2>Almost two decades working inside theatre</h2>
          </article>
        </section>

        <section className="closing">
          <p>London · United Kingdom · International</p>

          <h2>
            Photography that understands the production—not only the picture.
          </h2>

          <Link href="/contact">
            Start a conversation <span aria-hidden="true">→</span>
          </Link>
        </section>
      </main>

      <style>{`
        .about {
          min-height: 100vh;
          overflow-x: hidden;
          background: #11100f;
          color: #f2eee6;
        }

        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(360px, 42vw);
          gap: clamp(3rem, 7vw, 8rem);
          min-height: 100svh;
          padding: 10rem 6vw 5rem;
          align-items: center;
        }

        .intro {
          align-self: end;
          padding-bottom: 2rem;
        }

        .eyebrow,
        .credentials span,
        .closing > p {
          margin: 0;
          color: #c7a369;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.21em;
          text-transform: uppercase;
        }

        h1,
        h2 {
          font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
          font-weight: 400;
        }

        h1 {
          max-width: 58rem;
          margin: 2rem 0 0;
          font-size: clamp(4rem, 7.5vw, 8rem);
          letter-spacing: -0.058em;
          line-height: 0.9;
        }

        .lead {
          max-width: 34rem;
          margin: 2.5rem 0 0;
          color: rgba(242, 238, 230, 0.68);
          font-size: 1.05rem;
          line-height: 1.7;
        }

        .portrait {
          position: relative;
          width: 100%;
          height: min(72vh, 760px);
          overflow: hidden;
          background: #1b1a19;
        }

        .portrait img {
          object-fit: cover;
          object-position: center top;
          filter: grayscale(1);
        }

        .biography {
          display: grid;
          grid-template-columns: minmax(220px, 0.65fr) minmax(0, 1.35fr);
          gap: clamp(4rem, 9vw, 10rem);
          max-width: 94rem;
          margin: 0 auto;
          padding: 9rem 6vw 11rem;
          border-top: 1px solid rgba(242, 238, 230, 0.17);
        }

        .biography aside p {
          margin: 0;
          font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
          font-size: clamp(2rem, 3.4vw, 3.7rem);
          letter-spacing: -0.04em;
          line-height: 1.08;
        }

        .biography aside p:last-child {
          margin-top: 1.5rem;
          color: #c7a369;
        }

        .copy {
          max-width: 48rem;
          color: rgba(242, 238, 230, 0.76);
          font-size: 1.04rem;
          line-height: 1.85;
        }

        .copy p {
          margin: 0 0 1.75rem;
        }

        .copy p:last-child {
          margin-bottom: 0;
        }

        .credentials {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin: 0 6vw 10rem;
          border-top: 1px solid rgba(242, 238, 230, 0.18);
          border-bottom: 1px solid rgba(242, 238, 230, 0.18);
        }

        .credentials article {
          min-height: 18rem;
          padding: 3rem 2rem;
          border-right: 1px solid rgba(242, 238, 230, 0.18);
        }

        .credentials article:last-child {
          border-right: 0;
        }

        .credentials h2 {
          margin: 2rem 0 0;
          font-size: clamp(1.55rem, 2.4vw, 2.45rem);
          letter-spacing: -0.035em;
          line-height: 1.2;
        }

        .closing {
          display: flex;
          min-height: 75vh;
          padding: 8rem 7vw 6rem;
          flex-direction: column;
          justify-content: center;
          background: #191817;
        }

        .closing h2 {
          max-width: 78rem;
          margin: 2rem 0 0;
          font-size: clamp(3.1rem, 6vw, 6.5rem);
          letter-spacing: -0.052em;
          line-height: 1;
        }

        .closing a {
          display: flex;
          width: fit-content;
          margin-top: 3.5rem;
          gap: 1.2rem;
          align-items: center;
          border-top: 1px solid rgba(242, 238, 230, 0.5);
          padding-top: 0.9rem;
          font-size: 0.56rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .closing a span {
          font-size: 1.1rem;
        }

        @media (max-width: 850px) {
          .hero {
            grid-template-columns: 1fr;
            gap: 3.5rem;
            min-height: auto;
            padding: 9rem 1.4rem 4rem;
          }

          .intro {
            padding-bottom: 0;
          }

          h1 {
            font-size: clamp(3.6rem, 14vw, 5.8rem);
          }

          .portrait {
            height: 65vh;
          }

          .biography {
            grid-template-columns: 1fr;
            gap: 4rem;
            padding: 6rem 1.4rem 7rem;
          }

          .credentials {
            grid-template-columns: 1fr;
            margin: 0 1.4rem 6rem;
          }

          .credentials article {
            min-height: auto;
            padding: 2.5rem 0;
            border-right: 0;
            border-bottom: 1px solid rgba(242, 238, 230, 0.18);
          }

          .credentials article:last-child {
            border-bottom: 0;
          }

          .closing {
            min-height: 65vh;
            padding: 7rem 1.4rem 5rem;
          }
        }
      `}</style>
    </>
  );
}