import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import PublicChrome from "../components/PublicChrome";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.stevegregson.com"),
  title: {
    default: "Steve Gregson | London Theatre Photographer",
    template: "%s | Steve Gregson",
  },
  description:
    "London theatre photographer Steve Gregson creates production, rehearsal, backstage, marketing and PR photography for theatres, producers and performing arts organisations across the UK and internationally.",
  applicationName: "Steve Gregson Photography",
  authors: [
    {
      name: "Steve Gregson",
      url: "https://www.stevegregson.com",
    },
  ],
  creator: "Steve Gregson",
  publisher: "Steve Gregson",
  category: "Photography",
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "Steve Gregson",
    title: "Steve Gregson | London Theatre Photographer",
    description:
      "Production, rehearsal, backstage, marketing and PR photography for theatre and the performing arts.",
    images: [
      {
        url: "/images/homepage-hero.jpg",
        width: 2048,
        height: 1365,
        alt: "Theatre production photography by Steve Gregson",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Steve Gregson | London Theatre Photographer",
    description:
      "Production, rehearsal, backstage, marketing and PR photography for theatre and the performing arts.",
    images: ["/images/homepage-hero.jpg"],
  },
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://www.stevegregson.com/#website",
      url: "https://www.stevegregson.com/",
      name: "Steve Gregson Photography",
      description:
        "Theatre and performance photography by London photographer Steve Gregson.",
      inLanguage: "en-GB",
      publisher: {
        "@id": "https://www.stevegregson.com/#steve-gregson",
      },
    },
    {
      "@type": "Person",
      "@id": "https://www.stevegregson.com/#steve-gregson",
      name: "Steve Gregson",
      url: "https://www.stevegregson.com/",
      image:
        "https://www.stevegregson.com/images/portrait/steve-gregson.jpg",
      jobTitle: "Theatre Photographer",
      description:
        "London-based theatre and performing arts photographer specialising in production, rehearsal, backstage, marketing and PR photography.",
      sameAs: [
        "https://www.instagram.com/stevegregsonphotos/",
        "https://www.linkedin.com/in/stevegregsonphotos",
      ],
      homeLocation: {
        "@type": "Place",
        name: "London, United Kingdom",
      },
      knowsAbout: [
        "Theatre photography",
        "Production photography",
        "Rehearsal photography",
        "Backstage photography",
        "Performing arts photography",
        "Marketing photography",
        "PR photography",
      ],
      email: "mailto:info@stevegregson.com",
      telephone: "+447729435728",
      mainEntityOfPage: {
        "@id": "https://www.stevegregson.com/#website",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(
              /</g,
              "\\u003c",
            ),
          }}
        />
        <PublicChrome>
          {children}
        </PublicChrome>
        <Analytics />
<SpeedInsights />
      </body>
    </html>
  );
}