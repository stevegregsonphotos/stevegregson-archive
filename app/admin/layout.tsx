import type { ReactNode } from "react";

import "./admin.css";

type AdminLayoutProps = {
  children: ReactNode;
};

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  return <>{children}</>;
}