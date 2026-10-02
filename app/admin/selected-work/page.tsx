import type { Metadata } from "next";
import SelectedWorkAdminTabs from "./SelectedWorkAdminTabs";

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
            Choose and arrange the photographs on the public Selected Work
            page and the images in the Commissions page boxes. Upload new
            photographs in the photo library.
          </p>
        </header>

        <SelectedWorkAdminTabs />
      </div>
    </main>
  );
}
