import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import path from "path";
import { COUNTRY_TAG_TO_PAIS_SLUG } from "./lib/paises";

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
      "frame-src https://www.googletagmanager.com https://www.youtube-nocookie.com",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Disable streaming metadata: send canonical/robots/OG in the initial <head>
  // for all requests, including Googlebot (not in Next.js default htmlLimitedBots).
  // Cost is negligible — generateMetadata uses React-cached DB calls.
  htmlLimitedBots: /.*/,
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
    minimumCacheTTL: 2592000, // 30 days — Amazon covers rarely change
    deviceSizes: [320, 640],  // covers max at 50vw on mobile (~160px) or detail page (~300px); 828 never picked
    imageSizes: [160, 320],   // replaces default [16,32,48,64,96,128,256,384] — only fixed-width Images use these
    remotePatterns: [
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "images-na.ssl-images-amazon.com" },
      { protocol: "https", hostname: "images-fe.ssl-images-amazon.com" },
      { protocol: "https", hostname: "*.media-amazon.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      // Mercado Livre product image CDN (marketplace='mercadolivre' records)
      { protocol: "https", hostname: "http2.mlstatic.com" },
      { protocol: "https", hostname: "*.mlstatic.com" },
    ],
  },
  async rewrites() {
    return [
      // RFC 9727 — route handler needed for application/linkset+json content type
      { source: "/.well-known/api-catalog", destination: "/api/well-known/api-catalog" },
    ];
  },
  async redirects() {
    return [
      // Thin/duplicate estilo pages merged into /estilo/game — every disco tagged
      // valve or video-game-music that clears the price_count>=5 listing gate is
      // already double-tagged "game", so these pages had no unique inventory.
      { source: "/estilo/valve", destination: "/estilo/game", permanent: true },
      { source: "/estilo/video-game-music", destination: "/estilo/game", permanent: true },
      { source: "/estilo/game-remixes", destination: "/estilo/game", permanent: true },
      // lastfm_tags leaked artist names in as if they were genres — an artist is
      // not a style, so these send to the real artist page instead of a fake genre page.
      { source: "/estilo/eric-church", destination: "/artista/eric-church", permanent: true },
      { source: "/estilo/shania-twain", destination: "/artista/shania-twain", permanent: true },
      { source: "/estilo/kenny-rogers", destination: "/artista/kenny-rogers", permanent: true },
      { source: "/estilo/tim-mcgraw", destination: "/artista/tim-mcgraw", permanent: true },
      { source: "/estilo/blake-shelton", destination: "/artista/blake-shelton", permanent: true },
      { source: "/estilo/george-strait", destination: "/artista/george-strait", permanent: true },
      { source: "/estilo/alan-jackson", destination: "/artista/alan-jackson", permanent: true },
      { source: "/estilo/randy-travis", destination: "/artista/randy-travis", permanent: true },
      { source: "/estilo/miranda-lambert", destination: "/artista/miranda-lambert", permanent: true },
      { source: "/estilo/keith-urban", destination: "/artista/keith-urban", permanent: true },
      { source: "/estilo/toby-keith", destination: "/artista/toby-keith", permanent: true },
      { source: "/estilo/reba-mcentire", destination: "/artista/reba-mcentire", permanent: true },
      { source: "/estilo/kenny-chesney", destination: "/artista/kenny-chesney", permanent: true },
      { source: "/estilo/celine-dion", destination: "/artista/celine-dion", permanent: true },
      { source: "/estilo/britney-spears", destination: "/artista/britney-spears", permanent: true },
      { source: "/estilo/ariana-grande", destination: "/artista/ariana-grande", permanent: true },
      { source: "/estilo/andrea-bocelli", destination: "/artista/andrea-bocelli", permanent: true },
      { source: "/estilo/bts", destination: "/artista/bts", permanent: true },
      { source: "/estilo/hannah-montana", destination: "/artista/hannah-montana", permanent: true },
      { source: "/estilo/one-direction", destination: "/artista/one-direction", permanent: true },
      { source: "/estilo/within-temptation", destination: "/artista/within-temptation", permanent: true },
      { source: "/estilo/sheena-easton", destination: "/artista/sheena-easton", permanent: true },
      { source: "/estilo/belchior", destination: "/artista/belchior", permanent: true },
      { source: "/estilo/fagner", destination: "/artista/raimundo-fagner", permanent: true },
      { source: "/estilo/little-big-town", destination: "/artista/little-big-town", permanent: true },
      { source: "/estilo/spice-girls", destination: "/artista/spice-girls", permanent: true },
      // Spelling-variant tags consolidated into one canonical form (data fixed
      // in lastfm_tags directly — these just catch already-indexed old URLs).
      { source: "/estilo/showtunes", destination: "/estilo/show-tunes", permanent: true },
      { source: "/estilo/punkrock", destination: "/estilo/punk-rock", permanent: true },
      { source: "/estilo/synth-pop", destination: "/estilo/synthpop", permanent: true },
      { source: "/estilo/jazzpiano", destination: "/estilo/jazz-piano", permanent: true },
      { source: "/estilo/death-rock", destination: "/estilo/deathrock", permanent: true },
      { source: "/estilo/rockandroll", destination: "/estilo/rock-and-roll", permanent: true },
      { source: "/estilo/folkrock", destination: "/estilo/folk-rock", permanent: true },
      { source: "/estilo/mash-up", destination: "/estilo/mashup", permanent: true },
      { source: "/estilo/bluesrock", destination: "/estilo/blues-rock", permanent: true },
      { source: "/estilo/indiepop", destination: "/estilo/indie-pop", permanent: true },
      { source: "/estilo/oldschool-hardcore", destination: "/estilo/old-school-hardcore", permanent: true },
      { source: "/estilo/bigband", destination: "/estilo/big-band", permanent: true },
      { source: "/estilo/girl-group", destination: "/estilo/girl-groups", permanent: true },
      { source: "/estilo/game-music", destination: "/estilo/game", permanent: true },
      // More artist-name tags found via a full catalog x-match (artists ≠ genres).
      { source: "/estilo/blackpink", destination: "/artista/blackpink", permanent: true },
      { source: "/estilo/chris-brown", destination: "/artista/chris-brown", permanent: true },
      { source: "/estilo/cortis", destination: "/artista/cortis", permanent: true },
      { source: "/estilo/fleetwood-mac", destination: "/artista/fleetwood-mac", permanent: true },
      { source: "/estilo/ginuwine", destination: "/artista/ginuwine", permanent: true },
      { source: "/estilo/helloween", destination: "/artista/helloween", permanent: true },
      { source: "/estilo/hilary-duff", destination: "/artista/hilary-duff", permanent: true },
      { source: "/estilo/keyshia-cole", destination: "/artista/keyshia-cole", permanent: true },
      { source: "/estilo/raspberry-bulbs", destination: "/artista/raspberry-bulbs", permanent: true },
      { source: "/estilo/ray-conniff", destination: "/artista/ray-conniff", permanent: true },
      { source: "/estilo/tanya-tucker", destination: "/artista/tanya-tucker", permanent: true },
      // More artist-name tags found via thin-tag (<=3 discs) x-match, 2026-07-18 pass.
      { source: "/estilo/bauhaus", destination: "/artista/bauhaus", permanent: true },
      { source: "/estilo/doctor-who", destination: "/artista/doctor-who", permanent: true },
      { source: "/estilo/future", destination: "/artista/future", permanent: true },
      { source: "/estilo/jim-hall", destination: "/artista/jim-hall", permanent: true },
      { source: "/estilo/middle-of-the-road", destination: "/artista/middle-of-the-road", permanent: true },
      { source: "/estilo/queen", destination: "/artista/queen", permanent: true },
      // Duplicate-meaning tags found from a user report, 2026-07-18: singular/
      // plural and pt/en variants of the same genre splitting inventory across
      // two pages. Redirect the thinner one into the one with real inventory.
      { source: "/estilo/boyband", destination: "/estilo/boybands", permanent: true },
      // Country/nationality tags aren't genres — send them to the canonical
      // /pais page for the artist's origin. brazil/brasil redirect here now
      // instead of chaining brazil → brasil → /pais/brasil.
      ...Object.entries(COUNTRY_TAG_TO_PAIS_SLUG).map(([tag, pais]) => ({
        source: `/estilo/${tag}`,
        destination: `/pais/${pais}`,
        permanent: true,
      })),
      // Decade tags duplicate the dedicated /decada pages — keep one canonical
      // decade-browsing surface instead of splitting inventory/links across two.
      { source: "/estilo/60s", destination: "/decada/1960", permanent: true },
      { source: "/estilo/70s", destination: "/decada/1970", permanent: true },
      { source: "/estilo/80s", destination: "/decada/1980", permanent: true },
      { source: "/estilo/90s", destination: "/decada/1990", permanent: true },
      // More spelling-variant tags found on a rescan (data fixed in lastfm_tags directly).
      { source: "/estilo/8bit", destination: "/estilo/8-bit", permanent: true },
      { source: "/estilo/alternative-hip-hop", destination: "/estilo/alternative-hiphop", permanent: true },
      { source: "/estilo/audio-book", destination: "/estilo/audiobook", permanent: true },
      { source: "/estilo/boy-band", destination: "/estilo/boybands", permanent: true },
      { source: "/estilo/chill-out", destination: "/estilo/chillout", permanent: true },
      { source: "/estilo/dreampop", destination: "/estilo/dream-pop", permanent: true },
      { source: "/estilo/german-hip-hop", destination: "/estilo/german-hiphop", permanent: true },
      { source: "/estilo/hiphop", destination: "/estilo/hip-hop", permanent: true },
      { source: "/estilo/lofi", destination: "/estilo/lo-fi", permanent: true },
      { source: "/estilo/psy-trance", destination: "/estilo/psytrance", permanent: true },
    ];
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
          { key: "Link", value: `<${SITE_URL}>; rel="canonical", </llms.txt>; rel="llms-txt", </llms.txt>; rel="service-doc"` },
        ],
      },
    ];
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
