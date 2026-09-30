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
          padding: 2.6rem 4vw 1.35rem;
          border-top: 1px solid rgba(17, 16, 15, 0.14);
          background: #f2f0eb;
          color: #11100f;
        }

        .site-footer-main {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            auto
            minmax(0, 1fr);
          gap: 2rem;
          align-items: center;
        }

        .site-footer-description {
          margin: 0;
          color: rgba(17, 16, 15, 0.64);
          font-size: 0.5rem;
          line-height: 1.45;
          letter-spacing: 0.12em;
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
          width: 13.5rem;
        }

        .site-footer-logo img {
          display: block;
          width: 100%;
          height: auto;
        }

        .site-footer-contact {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 0.3rem;
          text-align: center;
        }

        .site-footer-contact a {
          color: rgba(17, 16, 15, 0.72);
          font-size: 0.56rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          line-height: 1.25;
          text-transform: uppercase;
          transition: opacity 180ms ease;
          white-space: nowrap;
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
          gap: 0.55rem 1.35rem;
        }

        .site-footer-main > nav a {
          font-size: 0.56rem;
          font-weight: 700;
          letter-spacing: 0.11em;
          text-transform: uppercase;
          transition: opacity 180ms ease;
          white-space: nowrap;
        }

        .site-footer-main > nav a:hover {
          opacity: 0.5;
        }

        .site-footer-lower {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-top: 1.25rem;
          padding-top: 0.8rem;
          border-top: 1px solid rgba(17, 16, 15, 0.12);
        }

        .site-footer-lower p {
          margin: 0;
          color: rgba(17, 16, 15, 0.62);
          font-size: 0.49rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .site-footer-legal {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 0.55rem 1.1rem;
        }

        .site-footer-legal a {
          color: rgba(17, 16, 15, 0.62);
          font-size: 0.49rem;
          font-weight: 700;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          transition: opacity 180ms ease;
          white-space: nowrap;
        }

        .site-footer-legal a:hover {
          opacity: 0.5;
        }

        @media (max-width: 900px) {
          .site-footer-main {
            grid-template-columns: 1fr auto;
            gap: 0.6rem 1rem;
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
            padding: 1.5rem 1.2rem 1rem;
          }

          .site-footer-main {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.4rem;
          }

          .site-footer-brand {
            order: 1;
            width: 100%;
          }

          .site-footer-logo {
            width: 6.5rem;
          }

          .site-footer-contact a {
            display: inline-flex;
            align-items: center;
            min-height: 24px;
          }

          .site-footer-contact {
            flex-direction: column;
            gap: 0.08rem;
            margin-top: 0.12rem;
          }

          .site-footer-contact a + a::before {
            content: none;
          }

          .site-footer-main > nav {
            order: 2;
            width: 100%;
            justify-content: center;
            gap: 0 0.9rem;
            text-align: center;
          }

          .site-footer-main > nav a {
            display: inline-flex;
            align-items: center;
            min-height: 24px;
            font-size: 0.56rem;
            letter-spacing: 0.1em;
          }

          .site-footer-description {
            order: 3;
            width: 100%;
            text-align: center;
          }

          .site-footer-lower {
            flex-direction: column;
            gap: 0.25rem;
            margin-top: 0.35rem;
            padding-top: 0.3rem;
            text-align: center;
          }

          .site-footer-lower p {
            width: 100%;
            text-align: center;
          }

          .site-footer-legal {
            width: 100%;
            justify-content: center;
            gap: 0 0.8rem;
            text-align: center;
          }

          .site-footer-legal a {
            display: inline-flex;
            align-items: center;
            min-height: 24px;
            font-size: 0.5rem;
            letter-spacing: 0.08em;
          }
        }
      `}</style>
    </footer>
  );
}