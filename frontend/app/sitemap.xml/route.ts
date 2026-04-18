import { NextResponse } from "next/server";

const base =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://vinyl-tracker.vercel.app";

export const revalidate = 21600;

export function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${base}/sitemap/static.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${base}/sitemap/artists.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${base}/sitemap/discos.xml</loc>
  </sitemap>
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}
