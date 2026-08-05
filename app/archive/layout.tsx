import type { ReactNode } from "react";

import { ArchiveProvider } from "./ArchiveExplorer";

type ArchiveLayoutProps = {
  children: ReactNode;
};

export default function ArchiveLayout({
  children,
}: ArchiveLayoutProps) {
  return (
    <ArchiveProvider>
      {children}
    </ArchiveProvider>
  );
}