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

    const securityHeaders = [
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

  experimental: {
    proxyClientMaxBodySize: "500mb",
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.stevegregson.com",
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