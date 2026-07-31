import Link from "next/link";

export default function Header() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-[var(--line)] bg-[var(--background)]/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 md:px-12">
        <Link
          href="/"
          className="text-base tracking-[0.04em] transition-opacity hover:opacity-60"
        >
          Steve Gregson
        </Link>

        <nav className="flex gap-4 text-[0.7rem] uppercase tracking-[0.18em] md:gap-8">
          <Link href="/archive">Archive</Link>
          <Link href="/portraits">Portraits</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </div>
    </header>
  );
}