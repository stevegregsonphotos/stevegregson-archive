"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import BackToTop from "./BackToTop";
import Footer from "./footer";
import Header from "./Header";
import VisitTracker from "./VisitTracker";

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
  // Client file-transfer pages are full-screen and carry their own branding.
  const isTransferPage = pathname.startsWith("/transfer/");

  if (isBackstage || isTransferPage) {
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

      <VisitTracker />

      <Header />

      <div
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </div>

      <BackToTop />

      <Footer />
    </>
  );
}