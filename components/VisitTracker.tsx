"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { recordPage } from "../lib/visit-trail";

/** Notes each page viewed this visit (in memory only) for enquiry emails. */
export default function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) recordPage(pathname);
  }, [pathname]);

  return null;
}
