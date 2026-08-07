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
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </div>

      <div className="site-footer-lower">
        <p>
          © {new Date().getFullYear()} Steve Gregson Photography
        </p>
      </div>

      <style>{`
        .site-footer {
          padding: 3.3rem 4vw 1.6rem;
          border-top: 1px solid rgba(17, 16, 15, 0.14);
          background: #f2f0eb;
          color: #11100f;
        }

        .site-footer-main {
          position: relative;
          display: grid;
          grid-template-columns:
            minmax(14rem, 1fr)
            minmax(12rem, 0.8fr)
            minmax(26rem, 1.4fr);
          gap: 3rem;
          align-items: end;
          min-height: 12.5rem;
        }

        .site-footer-description {
          align-self: end;
          margin: 0;
          color: rgba(17, 16, 15, 0.64);
          font-size: 0.54rem;
          line-height: 1.72;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .site-footer-brand {
          position: absolute;
          top: 0.35rem;
          left: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: min(100%, 16rem);
          transform: translateX(-50%);
        }

        .site-footer-logo {
          display: block;
          width: min(100%, 12.5rem);
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
          gap: 0.4rem;
          margin-top: 1.1rem;
          text-align: center;
        }

        .site-footer-contact a {
          color: rgba(17, 16, 15, 0.72);
          font-size: 0.52rem;
          font-weight: 700;
          letter-spacing: 0.13em;
          line-height: 1.5;
          text-transform: uppercase;
          transition: opacity 180ms ease;
        }

        .site-footer-contact a:first-child {
          color: rgba(17, 16, 15, 0.88);
        }

        .site-footer-contact a:hover {
          opacity: 0.5;
        }

        .site-footer nav {
          align-self: end;
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 0.8rem 1.7rem;
          grid-column: 3;
        }

        .site-footer nav a {
          font-size: 0.51rem;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          transition: opacity 180ms ease;
        }

        .site-footer nav a:hover {
          opacity: 0.5;
        }

        .site-footer-lower {
          margin-top: 2.4rem;
          padding-top: 1.25rem;
          border-top: 1px solid rgba(17, 16, 15, 0.12);
        }

        .site-footer-lower p {
          margin: 0;
          color: rgba(17, 16, 15, 0.4);
          font-size: 0.47rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        @media (max-width: 900px) {
          .site-footer-main {
            grid-template-columns: 1fr 1fr;
            min-height: 14rem;
          }

          .site-footer-brand {
            top: 0;
            width: 14rem;
          }

          .site-footer-logo {
            width: 11.5rem;
          }

          .site-footer-description {
            grid-column: 1;
          }

          .site-footer nav {
            grid-column: 2;
          }
        }

        @media (max-width: 680px) {
          .site-footer {
            padding: 2.8rem 1.4rem 1.4rem;
          }

          .site-footer-main {
            display: flex;
            min-height: 0;
            flex-direction: column;
            align-items: flex-start;
            gap: 2rem;
          }

          .site-footer-brand {
            position: static;
            order: 1;
            align-items: flex-start;
            width: auto;
            transform: none;
          }

          .site-footer-logo {
            width: 10.5rem;
          }

          .site-footer-contact {
            align-items: flex-start;
            text-align: left;
          }

          .site-footer-description {
            order: 2;
          }

          .site-footer nav {
            order: 3;
            justify-content: flex-start;
          }

          .site-footer-lower {
            margin-top: 2rem;
          }
        }

        @media (max-width: 480px) {
          .site-footer nav {
            display: grid;
            grid-template-columns: repeat(2, auto);
            justify-content: start;
          }
        }
      `}</style>
    </footer>
  );
}