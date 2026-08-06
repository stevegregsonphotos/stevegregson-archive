"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import "./admin.css";

type AdminLayoutProps = {
  children: ReactNode;
};

const navigation = [
  {
    label: "Dashboard",
    href: "/admin",
  },
  {
    label: "Upload & publish",
    href: "/admin/new-production",
  },
  {
  label: "Productions",
  href: "/admin/productions",
},
  {
    label: "Selected Work",
    href: "/admin/selected-work",
  },
  {
    label: "Settings",
    href: "/admin/settings",
  },
];

function isActiveRoute(
  pathname: string,
  href: string,
) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
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
          {navigation.map((item) => {
            const active = isActiveRoute(
              pathname,
              item.href,
            );

            return (
              <Link
                href={item.href}
                className={
                  active
                    ? "backstage-app-nav-link backstage-app-nav-link-active"
                    : "backstage-app-nav-link"
                }
                aria-current={
                  active ? "page" : undefined
                }
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
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

        .backstage-app-header {
          position: sticky;
          top: 0;
          z-index: 100;
          display: grid;
          grid-template-columns:
            minmax(9rem, 0.7fr)
            minmax(0, 1.8fr)
            minmax(12rem, 0.7fr);
          gap: 2rem;
          align-items: center;
          min-height: 6.5rem;
          border-bottom:
            1px solid rgba(242, 238, 230, 0.14);
          padding: 0 4vw;
          background:
            rgba(17, 16, 15, 0.96);
          backdrop-filter: blur(16px);
        }

        .backstage-app-brand {
          display: flex;
          flex-direction: column;
          gap: 0.12rem;
          width: fit-content;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          line-height: 1.3;
          text-transform: uppercase;
        }

        .backstage-app-brand span:last-child {
          color: #c7a369;
        }

        .backstage-app-navigation {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: clamp(1rem, 2.5vw, 2.8rem);
        }

        .backstage-app-nav-link,
        .backstage-app-utilities {
          font-size: 0.52rem;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .backstage-app-nav-link {
          position: relative;
          color: rgba(242, 238, 230, 0.5);
          transition: color 180ms ease;
        }

        .backstage-app-nav-link::after {
          position: absolute;
          right: 0;
          bottom: -0.65rem;
          left: 0;
          height: 1px;
          background: #c7a369;
          content: "";
          opacity: 0;
          transform: scaleX(0);
          transition:
            opacity 180ms ease,
            transform 180ms ease;
        }

        .backstage-app-nav-link:hover,
        .backstage-app-nav-link-active {
          color: #f2eee6;
        }

        .backstage-app-nav-link-active::after {
          opacity: 1;
          transform: scaleX(1);
        }

        .backstage-app-utilities {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 1.5rem;
          color: rgba(242, 238, 230, 0.48);
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
          font-size: inherit;
          font-weight: inherit;
          letter-spacing: inherit;
          text-transform: inherit;
        }

        .backstage-app-content {
          min-height: calc(100vh - 6.5rem);
        }

        @media (max-width: 1050px) {
          .backstage-app-header {
            grid-template-columns:
              minmax(8rem, 1fr)
              auto;
          }

          .backstage-app-navigation {
            grid-column: 1 / -1;
            grid-row: 2;
            justify-content: flex-start;
            min-width: 0;
            overflow-x: auto;
            border-top:
              1px solid rgba(242, 238, 230, 0.1);
            padding: 1rem 0;
          }

          .backstage-app-header {
            min-height: auto;
            padding-top: 1.5rem;
          }

          .backstage-app-content {
            min-height: 100vh;
          }
        }

        @media (max-width: 640px) {
          .backstage-app-header {
            gap: 1.25rem;
            padding:
              1.25rem 1.4rem 0;
          }

          .backstage-app-utilities {
            gap: 1rem;
          }

          .backstage-app-utilities > a {
            display: none;
          }

          .backstage-app-navigation {
            gap: 1.6rem;
          }

          .backstage-app-nav-link {
            flex: 0 0 auto;
          }
        }
      `}</style>
    </div>
  );
}