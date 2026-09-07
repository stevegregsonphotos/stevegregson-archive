"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import Footer from "./footer";
import Header from "./Header";

type PublicChromeProps = {
  children: ReactNode;
};

export default function PublicChrome({
  children,
}: PublicChromeProps) {
  const pathname = usePathname();
  const isBackstage =
    pathname === "/admin" ||
    pathname.startsWith("/admin/");

  if (isBackstage) {
    return <>{children}</>;
  }

  return (
    <>
      <a
        href="#main-content"
        className="skip-link"
      >
        Skip to main content
      </a>

      <Header />

      <div
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </div>

      <Footer />
    </>
  );
}