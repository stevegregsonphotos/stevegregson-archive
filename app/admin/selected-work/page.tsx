import type { Metadata } from "next";
import SelectedWorkEditor from "./SelectedWorkEditor";

export const metadata: Metadata = {
  title: "Selected Work | Backstage",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SelectedWorkAdminPage() {
  return (
    <main className="backstage-page">
      <div className="backstage-shell">
        <header>
          <p className="backstage-eyebrow">Curated portfolio</p>
          <h1 className="backstage-title">Selected Work</h1>
          <p className="backstage-lead">
            Upload, arrange and remove the photographs used in the public
            Selected Work collections.
          </p>
        </header>

        <SelectedWorkEditor />
      </div>
    </main>
  );
}
