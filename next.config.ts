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

    const headers = [
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
  experimental: {
    proxyClientMaxBodySize: "500mb",
  },

  images: {
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