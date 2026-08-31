import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    allowedDevOrigins: ["192.168.86.59"],
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