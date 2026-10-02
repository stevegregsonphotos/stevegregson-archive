import type { Metadata } from "next";

import SelectedWorkBackstage from "./SelectedWorkBackstage";

export const metadata: Metadata = {
  title: "Selected Work | Backstage",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SelectedWorkAdminPage() {
  return (
    <main className="backstage-page" style={{ paddingTop: "4rem" }}>
      <div className="backstage-shell">
        <SelectedWorkBackstage />
      </div>
    </main>
  );
}
