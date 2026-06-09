/**
 * Canonical site origin. Single source of truth — used by metadata,
 * JSON-LD, sitemaps, and llms.txt. Fallback must match robots.txt
 * and public/sitemap.xml (www, no trailing slash).
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.garimpavinil.com.br";
