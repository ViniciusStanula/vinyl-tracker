import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  // Prevents this site from being embedded in iframes (clickjacking protection)
  { key: "X-Frame-Options", value: "DENY" },
  // Prevents browsers from MIME-sniffing a response away from the declared content-type
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Controls how much referrer info is included in requests
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restricts access to browser features not needed by this app
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
