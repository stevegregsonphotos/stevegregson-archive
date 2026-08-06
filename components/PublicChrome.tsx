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
      <Header />
      {children}
      <Footer />
    </>
  );
}