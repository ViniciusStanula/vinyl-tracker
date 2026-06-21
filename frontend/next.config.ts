import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import path from "path";

const isDev = process.env.NODE_ENV === "development";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.garimpavinil.com.br";

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval' http://localhost:8400" : ""} https://www.googletagmanager.com https://www.google-analytics.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https: data:",
      "font-src 'self'",
      `connect-src 'self'${isDev ? " http://localhost:8400" : ""} https://*.supabase.co https://ws.audioscrobbler.com https://www.google-analytics.com https://www.googletagmanager.com`,
      "frame-src https://www.googletagmanager.com",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  compress: true,
  poweredByHeader: false,
  // Tracing root = repo root so ../enriched_data.json stays inside it
  // (Next 16.2.9 rejects include globs that escape the tracing root).
  outputFileTracingRoot: path.join(__dirname, ".."),
  // Ensure JSON data files are bundled in the serverless functions that need them
  outputFileTracingIncludes: {
    "/guias/top-artistas-spotify": ["./data/top_artists.json"],
    "/guias/rock": ["../enriched_data.json"],
    "/guias/rock/[slug]": ["../enriched_data.json"],
  },
  images: {
    minimumCacheTTL: 2592000, // 30 days — Amazon covers rarely change; default 60s caused constant re-transformation
    deviceSizes: [320, 420, 640, 828], // album covers max 416px; no need for 1080–3840 variants
    remotePatterns: [
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "images-na.ssl-images-amazon.com" },
      { protocol: "https", hostname: "images-fe.ssl-images-amazon.com" },
      { protocol: "https", hostname: "*.media-amazon.com" },
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
      {
        source: "/",
        headers: [
          { key: "Link", value: `<${SITE_URL}/>; rel="canonical", </llms.txt>; rel="llms-txt", </llms.txt>; rel="service-doc"` },
        ],
      },
    ];
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
