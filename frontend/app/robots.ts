import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vinyl-tracker.vercel.app";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: [
      `${base}/sitemap/estatico.xml`,
      `${base}/sitemap/artistas.xml`,
      `${base}/sitemap/discos.xml`,
      `${base}/sitemap/estilos.xml`,
    ],
  };
}
