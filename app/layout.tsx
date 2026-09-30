import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import PublicChrome from "../components/PublicChrome";

import "./globals.css";

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

/** Every profile that is Steve, so search engines and AI tools join them up. */
const SAME_AS = [
  "https://www.instagram.com/stevegregsonphotos/",
  "https://www.linkedin.com/in/stevegregsonphotos/",
  "https://www.facebook.com/stevegregsonphotos/",
  "https://x.com/stevegregson_",
  "https://www.thealpd.org.uk/photographer/steve-gregson",
  "https://www.europeanphotographers.eu/members/stevegregson/",
];

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
        "https://www.stevegregson.com/images/homepage-hero.jpg",
      honorificSuffix: "FRSA LBIPP",
      jobTitle: "Theatre Photographer",
      worksFor: {
        "@id": "https://www.stevegregson.com/#business",
      },
      hasCredential: [
        {
          "@type": "EducationalOccupationalCredential",
          name: "Licentiate of the British Institute of Professional Photography (LBIPP)",
          credentialCategory: "Professional qualification",
          recognizedBy: {
            "@type": "Organization",
            name: "British Institute of Professional Photography",
            url: "https://www.bipp.com/",
          },
        },
        {
          "@type": "EducationalOccupationalCredential",
          name: "Fellow of the Royal Society of Arts (FRSA)",
          credentialCategory: "Fellowship",
          recognizedBy: {
            "@type": "Organization",
            name: "Royal Society of Arts",
            url: "https://www.thersa.org/",
          },
        },
      ],
      memberOf: [
        {
          "@type": "Organization",
          name: "British Institute of Professional Photography",
          url: "https://www.bipp.com/",
        },
        {
          "@type": "Organization",
          name: "Federation of European Photographers",
          url: "https://www.europeanphotographers.eu/",
        },
        {
          "@type": "Organization",
          name: "Royal Society of Arts",
          url: "https://www.thersa.org/",
        },
      ],
      description:
        "London-based theatre and performing arts photographer specialising in production, rehearsal, backstage, marketing and PR photography.",
      sameAs: SAME_AS,
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
    {
      "@type": "ProfessionalService",
      "@id": "https://www.stevegregson.com/#business",
      name: "Steve Gregson Photography",
      description:
        "London theatre photographer. Production, rehearsal, backstage, marketing and PR photography for theatres, producers, drama schools and opera companies.",
      url: "https://www.stevegregson.com/",
      image: "https://www.stevegregson.com/images/homepage-hero.jpg",
      logo: "https://www.stevegregson.com/images/homepage-hero.jpg",
      email: "info@stevegregson.com",
      telephone: "+447729435728",
      founder: {
        "@id": "https://www.stevegregson.com/#steve-gregson",
      },
      areaServed: [
        { "@type": "City", name: "London" },
        { "@type": "Country", name: "United Kingdom" },
      ],
      knowsAbout: [
        "Theatre photography",
        "Production photography",
        "Rehearsal photography",
        "Drama school photography",
        "Opera photography",
        "Theatre marketing photography",
      ],
      sameAs: SAME_AS,
    },
  ],
};

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html lang="en-GB">
      <body>
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