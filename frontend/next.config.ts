import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "images-na.ssl-images-amazon.com" },
      { protocol: "https", hostname: "images-fe.ssl-images-amazon.com" },
      { protocol: "https", hostname: "*.media-amazon.com" },
    ],
    // Allow moderate compression quality — album art is already CDN-optimized
    // unoptimized is set per-image in DiscoCard to avoid Vercel quota consumption
  },
};

export default nextConfig;
