import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <>
      <footer className="site-footer">
        <div className="site-footer-logo">
          <Image
            src="/images/branding/steve-gregson-logo.jpg"
            alt="Steve Gregson Photography"
            width={1280}
            height={1280}
            sizes="(max-width: 700px) 70vw, 24rem"
          />
        </div>

        <div className="site-footer-details">
          <p>
            Theatre &amp; Performance Photography
            <br />
            London · UK · International
          </p>

          <nav aria-label="Footer navigation">
            <Link href="/archive">Archive</Link>
            <Link href="/people">People</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
          </nav>

          <p className="site-footer-copyright">
            © {new Date().getFullYear()} Steve Gregson Photography
          </p>
        </div>
      </footer>

      <style>{`
        .site-footer {
          display: grid;
          grid-template-columns: minmax(18rem, 0.9fr) minmax(0, 1.1fr);
          gap: 8vw;
          align-items: end;
          padding: 7rem 6vw 3rem;
          border-top: 1px solid rgba(242, 238, 230, 0.16);
          background: #f2f0eb;
          color: #11100f;
        }

        .site-footer-logo {
          max-width: 28rem;
        }

        .site-footer-logo img {
          display: block;
          width: 100%;
          height: auto;
          mix-blend-mode: multiply;
        }

        .site-footer-details {
          display: grid;
          gap: 2.5rem;
          justify-items: end;
          text-align: right;
        }

        .site-footer-details p {
          margin: 0;
          font-size: 0.64rem;
          line-height: 1.7;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .site-footer-details nav {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem 2rem;
          justify-content: flex-end;
        }

        .site-footer-details nav a {
          font-size: 0.58rem;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .site-footer-copyright {
          color: rgba(17, 16, 15, 0.5);
        }

        @media (max-width: 760px) {
          .site-footer {
            grid-template-columns: 1fr;
            gap: 4rem;
            padding: 5rem 1.4rem 2rem;
          }

          .site-footer-logo {
            max-width: 20rem;
          }

          .site-footer-details {
            justify-items: start;
            text-align: left;
          }

          .site-footer-details nav {
            justify-content: flex-start;
          }
        }
      `}</style>
    </>
  );
}