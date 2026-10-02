"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Which top-menu item each part of the site belongs to. */
const SECTIONS = [
  {
    href: "/selected-work",
    label: "Selected Work",
    paths: ["/selected-work", "/rehearsals", "/marketing-pr"],
  },
  {
    href: "/archive",
    label: "Archive",
    paths: ["/archive", "/productions", "/people", "/venues"],
  },
  {
    href: "/about",
    label: "About",
    paths: ["/about"],
  },
];

function inSection(pathname: string, paths: string[]) {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export default function Header() {
  const pathname = usePathname() ?? "/";
  const onContact = inSection(pathname, ["/contact"]);

  return (
    <header className="site-header">
      <Link
        href="/"
        className="brand"
        aria-label="Steve Gregson homepage"
      >
        <span className="brand-copy">
          <strong>STEVE GREGSON</strong>
          <small>
            THEATRE &amp; PERFORMANCE PHOTOGRAPHY
          </small>
        </span>
      </Link>

      <nav
        className="desktop-navigation"
        aria-label="Main navigation"
      >
        {SECTIONS.map((section) => {
          const current = inSection(pathname, section.paths);
          return (
            <Link
              key={section.href}
              href={section.href}
              className={current ? "is-current" : undefined}
              aria-current={current ? (pathname === section.href ? "page" : "true") : undefined}
            >
              {section.label}
            </Link>
          );
        })}

        <Link
          href="/contact"
          className={onContact ? "enquire-link is-current" : "enquire-link"}
          aria-current={onContact ? "page" : undefined}
        >
          Contact
        </Link>
      </nav>
    </header>
  );
}
