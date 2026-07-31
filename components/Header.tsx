import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-stone-200">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-8">
        <Link href="/">Steve Gregson</Link>

        <nav className="flex gap-6">
          <Link href="/archive">Archive</Link>
          <Link href="/portraits">Portraits</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </div>
    </header>
  );
}