import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    allowedDevOrigins: ["192.168.86.59"],

  async headers() {
    const noIndexHeaders = [
      {
        key: "X-Robots-Tag",
        value: "noindex, nofollow, noarchive",
      },
    ];

    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data: blob: https://images.stevegregson.com https://selected-work-images.stevegregson.com",
      "connect-src 'self' https://*.r2.cloudflarestorage.com",
    ].join("; ");

    const securityHeaders = [
      {
        key: "Content-Security-Policy-Report-Only",
        value: contentSecurityPolicy,
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value:
          "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "Strict-Transport-Security",
        value:
          "max-age=31536000; includeSubDomains",
      },
    ];

    const headers = [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/admin/:path*",
        headers: noIndexHeaders,
      },
      {
        source: "/proofing/:path*",
        headers: noIndexHeaders,
      },
    ];

    if (
      process.env.VERCEL_ENV &&
      process.env.VERCEL_ENV !== "production"
    ) {
      headers.push({
        source: "/:path*",
        headers: noIndexHeaders,
      });
    }

    return headers;
  },

  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "www.stevegregsonphotos.com",
          },
        ],
        destination:
          "https://www.stevegregson.com/:path*",
        statusCode: 301,
      },
      {
        source: "/productions/g-tterd-mmerung",
        destination: "/productions/gotterdammerung",
        statusCode: 301,
      },
      {
        source: "/productions/die-walk-re",
        destination: "/productions/die-walkure",
        statusCode: 301,
      },
      {
        source:
          "/productions/die-walk-re-york-hall-bethnal-green-london-february-2025",
        destination:
          "/productions/die-walkure-york-hall-bethnal-green-london-february-2025",
        statusCode: 301,
      },
      {
        source: "/productions/lonely-londoners",
        destination: "/productions/the-lonely-londoners",
        statusCode: 301,
      },
      {
        source: "/theatrephotographer",
        destination: "/production",
        permanent: true,
      },
      {
        source: "/backstage",
        destination: "/rehearsals",
        permanent: true,
      },
      {
        source: "/dancephotography",
        destination: "/production",
        permanent: true,
      },
      {
        source: "/theatregif",
        destination: "/production",
        permanent: true,
      },
      {
        source: "/mens-headshots",
        destination: "/contact",
        permanent: true,
      },
      {
        source: "/womens-headshots",
        destination: "/contact",
        permanent: true,
      },
      {
        source: "/my-approach",
        destination: "/contact",
        permanent: true,
      },
      {
        source: "/packages2022",
        destination: "/contact",
        permanent: true,
      },
    ];
  },

  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.stevegregson.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "selected-work-images.stevegregson.com",
        pathname: "/**",
      },
    ],
    formats: [
      "image/avif",
      "image/webp",
    ],
    qualities: [
      60,
      75,
      85,
    ],
    deviceSizes: [
      640,
      750,
      828,
      1080,
      1200,
      1440,
      1920,
      2560,
      3840,
    ],
    imageSizes: [
      32,
      48,
      64,
      96,
      128,
      256,
      384,
    ],
    minimumCacheTTL: 2678400,
    localPatterns: [
      {
        pathname: "/images/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;