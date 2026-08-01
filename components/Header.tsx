import Link from "next/link";

export default function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="Steve Gregson homepage">
       

        <span className="brand-copy">
  <strong>STEVE GREGSON</strong>
  <small>THEATRE &amp; PERFORMANCE PHOTOGRAPHY</small>
</span>
      </Link>

 <nav className="desktop-navigation" aria-label="Main navigation">
  <Link href="/archive">Archive</Link>
  <Link href="/people">People</Link>
  <Link href="/venues">Venues</Link>
  <Link href="/about">About</Link>
  <Link href="/contact" className="enquire-link">
    Enquire
  </Link>
</nav>
    </header>
  );
}