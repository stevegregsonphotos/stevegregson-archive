import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-main">
        <p className="site-footer-description">
          Theatre &amp; Performance Photography
          <br />
          London · UK · International
        </p>

        <div className="site-footer-brand">
          <Link
            href="/"
            className="site-footer-logo"
            aria-label="Steve Gregson Photography homepage"
          >
            <Image
              src="/images/branding/steve-gregson-logo.svg"
              alt="Steve Gregson Photography"
              width={1400}
              height={800}
              sizes="(max-width: 560px) 10rem, 12.5rem"
              priority={false}
            />
          </Link>

          <div className="site-footer-contact">
            <a href="mailto:info@stevegregson.com">
              info@stevegregson.com
            </a>

            <a href="tel:+447729435728">
              +44 (0) 7729 435 728
            </a>
          </div>
        </div>

        <nav aria-label="Footer navigation">
          <Link href="/selected-work">Work</Link>
          <Link href="/archive">Archive</Link>
          <Link href="/people">People</Link>
          <Link href="/commissions">Commissions</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </div>

      <div className="site-footer-lower">
  <p>
    © {new Date().getFullYear()} Steve Gregson Photography
  </p>

  <nav
    className="site-footer-legal"
    aria-label="Legal and policy information"
  >
    <Link href="/policies">
      Professional Standards
    </Link>

    <Link href="/policies/terms">
      Terms &amp; Conditions
    </Link>

    <Link href="/policies/privacy">
      Privacy
    </Link>
  </nav>
</div>

      <style>{`
        .site-footer {
          padding: 1.5rem 4vw 0.9rem;
          border-top: 1px solid rgba(17, 16, 15, 0.14);
          background: #f2f0eb;
          color: #11100f;
        }

        .site-footer-main {
          display: grid;
          grid-template-columns:
            minmax(12rem, 0.9fr)
            minmax(10rem, 0.65fr)
            minmax(24rem, 1.35fr);
          gap: 1.6rem;
          align-items: center;
        }

        .site-footer-description {
          margin: 0;
          color: rgba(17, 16, 15, 0.64);
          font-size: 0.49rem;
          line-height: 1.55;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .site-footer-brand {
          display: flex;
          min-width: 0;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .site-footer-logo {
          display: block;
          width: min(100%, 8rem);
        }

        .site-footer-logo img {
          display: block;
          width: 100%;
          height: auto;
        }

        .site-footer-contact {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.18rem;
          margin-top: 0.4rem;
          text-align: center;
        }

        .site-footer-contact a {
          color: rgba(17, 16, 15, 0.72);
          font-size: 0.45rem;
          font-weight: 700;
          letter-spacing: 0.11em;
          line-height: 1.35;
          text-transform: uppercase;
          transition: opacity 180ms ease;
        }

        .site-footer-contact a:first-child {
          color: rgba(17, 16, 15, 0.88);
        }

        .site-footer-contact a:hover {
          opacity: 0.5;
        }

        .site-footer-main > nav {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 0.55rem 1.15rem;
        }

        .site-footer-main > nav a {
          font-size: 0.46rem;
          font-weight: 700;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          transition: opacity 180ms ease;
        }

        .site-footer-main > nav a:hover {
          opacity: 0.5;
        }

        .site-footer-lower {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
          margin-top: 0.85rem;
          padding-top: 0.65rem;
          border-top: 1px solid rgba(17, 16, 15, 0.12);
        }

        .site-footer-lower p {
          margin: 0;
          color: rgba(17, 16, 15, 0.62);
          font-size: 0.42rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .site-footer-legal {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 0.5rem 0.95rem;
        }

        .site-footer-legal a {
          color: rgba(17, 16, 15, 0.62);
          font-size: 0.42rem;
          font-weight: 700;
          letter-spacing: 0.11em;
          text-transform: uppercase;
          transition: opacity 180ms ease;
        }

        .site-footer-legal a:hover {
          opacity: 0.5;
        }

        @media (max-width: 900px) {
          .site-footer-main {
            grid-template-columns: 1fr auto;
            gap: 1rem 1.5rem;
          }

          .site-footer-description {
            grid-column: 1;
            grid-row: 1;
          }

          .site-footer-brand {
            grid-column: 2;
            grid-row: 1 / span 2;
          }

          .site-footer-main > nav {
            grid-column: 1;
            grid-row: 2;
            justify-content: flex-start;
          }
        }

        @media (max-width: 680px) {
          .site-footer {
            padding: 0.95rem 1rem 0.7rem;
          }

          .site-footer-main {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.55rem;
          }

          .site-footer-brand {
            order: 1;
            width: 100%;
          }

          .site-footer-logo {
            width: 6.5rem;
          }

          .site-footer-contact {
            gap: 0.16rem;
            margin-top: 0.3rem;
          }

          .site-footer-main > nav {
            order: 2;
            width: 100%;
            flex-wrap: wrap;
            justify-content: center;
            gap: 0.45rem 0.8rem;
            text-align: center;
          }

          .site-footer-main > nav a {
            font-size: 0.43rem;
            letter-spacing: 0.09em;
          }

          .site-footer-description {
            order: 3;
            width: 100%;
            text-align: center;
          }

          .site-footer-lower {
            flex-direction: column;
            gap: 0.4rem;
            margin-top: 0.55rem;
            padding-top: 0.55rem;
            text-align: center;
          }

          .site-footer-lower p {
            width: 100%;
            text-align: center;
          }

          .site-footer-legal {
            width: 100%;
            justify-content: center;
            gap: 0.4rem 0.75rem;
            text-align: center;
          }

          .site-footer-legal a {
            font-size: 0.4rem;
            letter-spacing: 0.07em;
          }
        }
      `}</style>
    </footer>
  );
}