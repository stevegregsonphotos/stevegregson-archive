import type { Metadata } from "next";
import Link from "next/link";

import { getAboutPortrait } from "../../../lib/about-portrait";
import AboutPhotoEditor from "./AboutPhotoEditor";
import "./about-photo.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About page photo | Backstage",
  robots: { index: false, follow: false },
};

export default async function AboutPhotoPage() {
  let portrait = null;
  try {
    portrait = await getAboutPortrait();
  } catch (error) {
    console.error("Could not read the About page photo", error);
  }

  return (
    <main className="backstage-page">
      <div className="backstage-shell">
        <header>
          <p className="backstage-eyebrow">
            <Link href="/admin/settings">Settings</Link> › About page
          </p>
          <h1 className="backstage-title">About page photo</h1>
          <p className="backstage-lead">
            Crop, zoom and adjust the photo of you on the About page, or upload a new one.
          </p>
        </header>

        <section className="backstage-section">
          <AboutPhotoEditor initial={portrait} />
        </section>
      </div>
    </main>
  );
}
