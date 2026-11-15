import type { Metadata } from "next";
import Link from "next/link";

import WebpConverter from "./WebpConverter";
import "./webp-convert.css";

export const metadata: Metadata = {
  title: "Convert photos to WebP | Backstage",
  robots: { index: false, follow: false },
};

export default function WebpConvertPage() {
  return (
    <main className="backstage-page">
      <div className="backstage-shell">
        <header>
          <p className="backstage-eyebrow">
            <Link href="/admin/settings">Settings</Link> › Convert photos to WebP
          </p>
          <h1 className="backstage-title">Convert photos to WebP</h1>
          <p className="backstage-lead">
            Photos uploaded from Safari were saved as heavy PNG or JPEG files. This
            makes a proper WebP of each one, here in your browser, and swaps it in
            under the same name. Nothing is unpublished and no captions or order change.
          </p>
        </header>

        <section className="backstage-section">
          <WebpConverter />
        </section>
      </div>
    </main>
  );
}
