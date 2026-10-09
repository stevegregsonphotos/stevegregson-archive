"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import "./admin.css";

type AdminLayoutProps = {
  children: ReactNode;
};

// Grouped so the menu reads as a few short sections rather than one long line.
const navigationGroups = [
  [
    { label: "Dashboard", href: "/admin" },
  ],
  [
    { label: "Upload & publish", href: "/admin/new-production" },
    { label: "Curated import", href: "/admin/curated-archive-import" },
    { label: "Productions", href: "/admin/productions" },
    { label: "Selected Work", href: "/admin/selected-work" },
  ],
  [
    { label: "Proofing", href: "/admin/proofing" },
    { label: "Watermarks", href: "/admin/proofing/watermarks" },
    { label: "Clients", href: "/admin/clients" },
  ],
  [
    { label: "Transfers", href: "/admin/transfers" },
    { label: "Storage", href: "/admin/storage" },
  ],
  [
    { label: "Settings", href: "/admin/settings" },
  ],
];

const navigation = navigationGroups.flat();

function isActiveRoute(
  pathname: string,
  href: string,
) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  const matches = (candidate: string) =>
    pathname === candidate ||
    pathname.startsWith(`${candidate}/`);

  if (!matches(href)) {
    return false;
  }

  // A more specific menu item wins (e.g. Watermarks lives under Proofing).
  return !navigation.some(
    (item) =>
      item.href !== href &&
      item.href.startsWith(`${href}/`) &&
      matches(item.href),
  );
}

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="backstage-app">
      <header className="backstage-app-header">
        <Link
          href="/admin"
          className="backstage-app-brand"
          aria-label="Backstage dashboard"
        >
          <span>Steve Gregson</span>
          <span>Backstage</span>
        </Link>

        <nav
          className="backstage-app-navigation"
          aria-label="Backstage navigation"
        >
          {navigationGroups.map((group, groupIndex) => (
            <div className="backstage-app-nav-group" key={groupIndex}>
              {group.map((item) => {
                const active = isActiveRoute(pathname, item.href);
                return (
                  <Link
                    href={item.href}
                    className={active ? "backstage-app-nav-link backstage-app-nav-link-active" : "backstage-app-nav-link"}
                    aria-current={active ? "page" : undefined}
                    key={item.href}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="backstage-app-utilities">
          <Link href="/" target="_blank">
            View website
          </Link>

          <form
            action="/api/admin/logout"
            method="post"
          >
            <button type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="backstage-app-content">
        {children}
      </div>

      <style>{`
        .backstage-app {
          min-height: 100vh;
          background: #11100f;
          color: #f2eee6;
        }

        /* Two rows: brand + utilities on top, a readable menu underneath.
           Total height stays 6.5rem, which other Backstage pages rely on. */
        .backstage-app-header {
          position: sticky;
          top: 0;
          z-index: 100;
          display: grid;
          grid-template-columns: 1fr auto;
          grid-template-rows: 3rem 3.5rem;
          align-items: center;
          column-gap: 2rem;
          height: 6.5rem;
          border-bottom: 1px solid rgba(242, 238, 230, 0.14);
          padding: 0 clamp(1.25rem, 3vw, 3rem);
          background: rgba(17, 16, 15, 0.97);
          backdrop-filter: blur(16px);
        }

        .backstage-app-brand {
          display: flex;
          align-items: baseline;
          gap: 0.6rem;
          width: fit-content;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .backstage-app-brand span:last-child {
          color: #c7a369;
        }

        .backstage-app-utilities {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 1.5rem;
          color: rgba(242, 238, 230, 0.6);
          font-size: 0.78rem;
        }

        .backstage-app-utilities a,
        .backstage-app-utilities button {
          transition: color 180ms ease;
        }

        .backstage-app-utilities a:hover,
        .backstage-app-utilities button:hover {
          color: #c7a369;
        }

        .backstage-app-utilities form {
          margin: 0;
        }

        .backstage-app-utilities button {
          border: 0;
          padding: 0;
          cursor: pointer;
          background: transparent;
          color: inherit;
          font: inherit;
        }

        .backstage-app-navigation {
          grid-column: 1 / -1;
          grid-row: 2;
          display: flex;
          align-items: stretch;
          align-self: stretch;
          min-width: 0;
          overflow-x: auto;
          scrollbar-width: none;
          border-top: 1px solid rgba(242, 238, 230, 0.08);
          margin: 0 calc(-1 * clamp(1.25rem, 3vw, 3rem));
          padding: 0 clamp(1.25rem, 3vw, 3rem);
        }

        .backstage-app-navigation::-webkit-scrollbar {
          display: none;
        }

        .backstage-app-nav-group {
          display: flex;
          flex: 0 0 auto;
          align-items: stretch;
          gap: 1.6rem;
        }

        .backstage-app-nav-group + .backstage-app-nav-group {
          margin-left: 1.6rem;
          border-left: 1px solid rgba(242, 238, 230, 0.14);
          padding-left: 1.6rem;
        }

        .backstage-app-nav-link {
          position: relative;
          display: flex;
          align-items: center;
          flex: 0 0 auto;
          white-space: nowrap;
          color: rgba(242, 238, 230, 0.62);
          font-size: 0.82rem;
          font-weight: 500;
          letter-spacing: 0.01em;
          transition: color 180ms ease;
        }

        .backstage-app-nav-link::after {
          position: absolute;
          right: 0;
          bottom: 0;
          left: 0;
          height: 2px;
          background: #c7a369;
          content: "";
          opacity: 0;
          transform: scaleX(0.6);
          transition: opacity 180ms ease, transform 180ms ease;
        }

        .backstage-app-nav-link:hover,
        .backstage-app-nav-link-active {
          color: #f2eee6;
        }

        .backstage-app-nav-link-active::after {
          opacity: 1;
          transform: scaleX(1);
        }

        .backstage-app-content {
          min-height: calc(100vh - 6.5rem);
        }

        @media (max-width: 1200px) {
          .backstage-app-nav-group {
            gap: 1.05rem;
          }

          .backstage-app-nav-group + .backstage-app-nav-group {
            margin-left: 1.05rem;
            padding-left: 1.05rem;
          }

          .backstage-app-nav-link {
            font-size: 0.78rem;
          }
        }

        @media (max-width: 640px) {
          .backstage-app-utilities > a {
            display: none;
          }

          .backstage-app-nav-link {
            font-size: 0.82rem;
          }
        }
      `}</style>
    </div>
  );
}