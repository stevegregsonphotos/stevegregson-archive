import type { Metadata } from "next";
import ProductionPageEditor from "./ProductionPageEditor";
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

        <section className="backstage-section" id="selected-work-page">
          <div className="backstage-section-heading">
            <h2>Selected Work page</h2>
            <p>The live production page</p>
          </div>

          <ProductionPageEditor />
        </section>
      </div>
    </main>
  );
}
