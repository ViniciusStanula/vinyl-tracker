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
      // The Spotify chart guide was removed: it drew 29 bot hits and zero human
      // visits in 30 days, while its daily data commit forced a production deploy
      // every morning — and each deploy starts a fresh ISR cache, so the whole
      // catalogue was rebuilt at full price daily.
      { source: "/guias/top-artistas-spotify", destination: "/guias", permanent: true },
      // Thin/duplicate estilo pages merged into /estilo/game — every disco tagged
      // valve or video-game-music that clears the price_count>=5 listing gate is
      // already double-tagged "game", so these pages had no unique inventory.
      { source: "/estilo/valve", destination: "/estilo/game", permanent: true },
      { source: "/estilo/video-game-music", destination: "/estilo/game", permanent: true },
      { source: "/estilo/game-remixes", destination: "/estilo/game", permanent: true },
      // "ost" is just an abbreviation of "soundtrack" -- every disco tagged ost
      // is now also tagged soundtrack (backfilled), so no unique inventory left.
      { source: "/estilo/ost", destination: "/estilo/soundtrack", permanent: true },
      // Amazon placeholder "artists" that are not artists. The crawler now
      // rewrites these at ingest, so the pages behind them emptied out:
      // /artista/original-soundtrack holds zero records and 404s outright,
      // while musicas-mp3 and ost are down to one vinyl record each (their
      // other listings are MP3s, already excluded as non-vinyl).
      //
      // Sent to the soundtrack style page rather than deleted: every record
      // that ever sat under these names is a soundtrack, so that is where a
      // visitor following an old link actually wanted to go.
      { source: "/artista/original-soundtrack", destination: "/estilo/soundtrack", permanent: true },
      { source: "/artista/musicas-mp3", destination: "/estilo/soundtrack", permanent: true },
      { source: "/artista/ost", destination: "/estilo/soundtrack", permanent: true },
      // Artist names repaired by crawler/repair_rotated_artists.py. The old
      // normalize_artist() rotated on any comma, so "Cruz, Celia" was stored as
      // "Cruz Celia" and indexed under a slug that reads backwards.
      { source: "/artista/nash-young-crosby-stills", destination: "/artista/stills-nash-young-crosby", permanent: true },
      { source: "/artista/inc-masta-ace", destination: "/artista/masta-ace-incorporated", permanent: true },
      { source: "/artista/animate-invent", destination: "/artista/invent-animate", permanent: true },
      { source: "/artista/brel-jacques", destination: "/artista/jacques-brel", permanent: true },
      { source: "/artista/bunyan-vashti", destination: "/artista/vashti-bunyan", permanent: true },
      { source: "/artista/cruz-celia", destination: "/artista/celia-cruz", permanent: true },
      { source: "/artista/d-kat-von", destination: "/artista/kat-von-d", permanent: true },
      { source: "/artista/doma-molchat", destination: "/artista/molchat-doma", permanent: true },
      { source: "/artista/fraites-jeremiah", destination: "/artista/jeremiah-fraites", permanent: true },
      { source: "/artista/g-gus", destination: "/artista/gus-g", permanent: true },
      // slugifyArtist() used to un-invert on ANY comma, so every band name
      // containing one was indexed backwards: "Earth, Wind & Fire" answered on
      // /artista/wind-fire-earth and "Tyler, The Creator" on
      // /artista/the-creator-tyler. That was 340 names over 406 records, and it
      // split pages too — "Tyler, The Creator" and "Tyler The Creator" resolved
      // to two different slugs for one artist. uninvertName() now only inverts
      // the "Vaughan,stevie Ray" shape (no space after the comma), which merged
      // 16 artist pages. These send the old backwards URLs to the real ones;
      // listed are those Googlebot crawled in the last 90 days or holding 2+
      // records.
      { source: "/artista/abbey-lincoln-max-roach-plus-four", destination: "/artista/max-roach-plus-four-abbey-lincoln", permanent: true },
      { source: "/artista/agnetha-anni-frid-bjorn-benny", destination: "/artista/bjorn-benny-agnetha-anni-frid", permanent: true },
      { source: "/artista/alan-walker-hans-zimmer", destination: "/artista/hans-zimmer-alan-walker", permanent: true },
      { source: "/artista/albert-castiglia-mike-zito", destination: "/artista/mike-zito-albert-castiglia", permanent: true },
      { source: "/artista/anne-belanger-vincent-bisson", destination: "/artista/vincent-bisson-anne-belanger", permanent: true },
      { source: "/artista/bogert-appice-beck", destination: "/artista/beck-bogert-appice", permanent: true },
      { source: "/artista/buddy-wells-junior-guy", destination: "/artista/junior-guy-buddy-wells", permanent: true },
      { source: "/artista/c-j-smith-dojo-cuts", destination: "/artista/dojo-cuts-c-j-smith", permanent: true },
      { source: "/artista/chaeyoung-jeongyeon-jihyo", destination: "/artista/jihyo-chaeyoung-jeongyeon", permanent: true },
      { source: "/artista/chalart58-manu-chao", destination: "/artista/manu-chao-chalart58", permanent: true },
      { source: "/artista/charlie-byrd-stan-getz", destination: "/artista/stan-getz-charlie-byrd", permanent: true },
      { source: "/artista/chet-lackerschmid-wolfgang-baker", destination: "/artista/wolfgang-baker-chet-lackerschmid", permanent: true },
      { source: "/artista/chris-verdi-freni-mirella-ludwig", destination: "/artista/mirella-ludwig-chris-verdi-freni", permanent: true },
      { source: "/artista/dave-armstrong-louis-brubeck", destination: "/artista/louis-brubeck-dave-armstrong", permanent: true },
      { source: "/artista/dizzy-carter-benny-gillespie", destination: "/artista/benny-gillespie-dizzy-carter", permanent: true },
      { source: "/artista/dog-slaughter-beach", destination: "/artista/slaughter-beach-dog", permanent: true },
      { source: "/artista/duke-lanegan-mark-garwood", destination: "/artista/mark-garwood-duke-lanegan", permanent: true },
      { source: "/artista/geoff-barrow-ben-salisbury", destination: "/artista/ben-salisbury-geoff-barrow", permanent: true },
      { source: "/artista/geordie-hook-k-division-coleman-jaz-walker", destination: "/artista/jaz-walker-geordie-hook-k-division-coleman", permanent: true },
      { source: "/artista/gigi-d-agostino-alex-megane-and-more-rocco-bass-t-the-hitmen", destination: "/artista/the-hitmen-gigi-d-agostino-alex-megane-and-more-rocco-bass-t", permanent: true },
      { source: "/artista/giona-ostinelli-sonya-belousova", destination: "/artista/sonya-belousova-giona-ostinelli", permanent: true },
      { source: "/artista/j-peter-schwalm-brian-eno-holger-czukay", destination: "/artista/holger-czukay-j-peter-schwalm-brian-eno", permanent: true },
      { source: "/artista/jabber-lipstick-homicide-the-ergs-the-steinways-house-boat-t", destination: "/artista/whimsyland-jabber-lipstick-homicide-the-ergs-the-steinways-h", permanent: true },
      { source: "/artista/jason-graves-marcin-przyby-owicz", destination: "/artista/marcin-przyby-owicz-jason-graves", permanent: true },
      { source: "/artista/jason-mcarthur-mike-barnes-randy-armstrong-rob-graves-anthon", destination: "/artista/anthony-armstrong-jason-mcarthur-mike-barnes-randy-armstrong", permanent: true },
      { source: "/artista/john-gallagher-liam-squire", destination: "/artista/liam-squire-john-gallagher", permanent: true },
      { source: "/artista/johnny-smith-beverly-kenney", destination: "/artista/beverly-kenney-johnny-smith", permanent: true },
      { source: "/artista/jr-grover-washington", destination: "/artista/grover-washington-jr", permanent: true },
      { source: "/artista/jr-hank-williams", destination: "/artista/hank-williams-jr", permanent: true },
      { source: "/artista/judas-priest-twisted-sister-blue-oyster-cult-accept-y-t-vari", destination: "/artista/stryper-judas-priest-twisted-sister-blue-oyster-cult-accept-", permanent: true },
      { source: "/artista/kenshi-hisaishi-joe-yonezu", destination: "/artista/joe-yonezu-kenshi-hisaishi", permanent: true },
      { source: "/artista/lake-palmer-emerson", destination: "/artista/emerson-lake-palmer", permanent: true },
      { source: "/artista/lake-powell-emerson", destination: "/artista/emerson-lake-powell", permanent: true },
      { source: "/artista/larry-gus-eric-copeland", destination: "/artista/eric-copeland-larry-gus", permanent: true },
      { source: "/artista/lo-borges-milton-nascimento", destination: "/artista/milton-nascimento-lo-borges", permanent: true },
      { source: "/artista/louis-armstrong-ella-fitzgerald", destination: "/artista/ella-fitzgerald-louis-armstrong", permanent: true },
      { source: "/artista/lowell-brams-sufjan-stevens", destination: "/artista/sufjan-stevens-lowell-brams", permanent: true },
      { source: "/artista/m-anna-prohaska-meryl-streep", destination: "/artista/meryl-streep-m-anna-prohaska", permanent: true },
      { source: "/artista/mac-quayle-gustavo-santaolalla", destination: "/artista/gustavo-santaolalla-mac-quayle", permanent: true },
      { source: "/artista/max-quintet-brown-clifford-roach", destination: "/artista/clifford-roach-max-quintet-brown", permanent: true },
      { source: "/artista/michael-stein-kyle-dixon", destination: "/artista/kyle-dixon-michael-stein", permanent: true },
      { source: "/artista/nat-king-cole-ella-fitzgerald-dean-martin-louis-armstrong-fr", destination: "/artista/bing-crosby-nat-king-cole-ella-fitzgerald-dean-martin-louis-", permanent: true },
      { source: "/artista/new-road-black-country", destination: "/artista/black-country-new-road", permanent: true },
      { source: "/artista/nils-frahm-olafur-arnalds", destination: "/artista/olafur-arnalds-nils-frahm", permanent: true },
      { source: "/artista/olafur-arnalds-loreen-sages", destination: "/artista/sages-olafur-arnalds-loreen", permanent: true },
      { source: "/artista/oscar-armstrong-louis-peterson", destination: "/artista/louis-peterson-oscar-armstrong", permanent: true },
      { source: "/artista/paul-and-mary-peter", destination: "/artista/peter-paul-and-mary", permanent: true },
      { source: "/artista/paul-peacock-annette-bley", destination: "/artista/annette-bley-paul-peacock", permanent: true },
      { source: "/artista/rikki-patten-arthur-brown", destination: "/artista/arthur-brown-rikki-patten", permanent: true },
      { source: "/artista/sam-slater-hildur-gu-nadottir", destination: "/artista/hildur-gu-nadottir-sam-slater", permanent: true },
      { source: "/artista/sarah-her-trio-vaughan", destination: "/artista/vaughan-sarah-her-trio", permanent: true },
      { source: "/artista/selector-dub-narcotic-white-rainbow", destination: "/artista/white-rainbow-selector-dub-narcotic", permanent: true },
      { source: "/artista/steve-earle-shawn-colvin", destination: "/artista/shawn-colvin-steve-earle", permanent: true },
      { source: "/artista/stills-nash-crosby", destination: "/artista/crosby-stills-nash", permanent: true },
      { source: "/artista/stills-nash-young-crosby", destination: "/artista/crosby-stills-nash-young", permanent: true },
      { source: "/artista/sweat-tears-blood", destination: "/artista/blood-sweat-tears", permanent: true },
      { source: "/artista/termanology-mac-miller-statik-selektah", destination: "/artista/statik-selektah-termanology-mac-miller", permanent: true },
      { source: "/artista/the-bad-the-queen-the-good", destination: "/artista/the-good-the-bad-the-queen", permanent: true },
      { source: "/artista/the-bluey-music-team-joff-bush", destination: "/artista/joff-bush-the-bluey-music-team", permanent: true },
      { source: "/artista/the-creator-tyler", destination: "/artista/tyler-the-creator", permanent: true },
      { source: "/artista/the-night-tripper-dr-john", destination: "/artista/dr-john-the-night-tripper", permanent: true },
      { source: "/artista/the-oscar-peterson-trio-stan-getz", destination: "/artista/stan-getz-the-oscar-peterson-trio", permanent: true },
      { source: "/artista/thirty-seconds-to-mars-friends-electric-birdy", destination: "/artista/birdy-thirty-seconds-to-mars-friends-electric", permanent: true },
      { source: "/artista/willie-nelson-jessi-colter-tompall-glaser-waylon-jennings", destination: "/artista/waylon-jennings-willie-nelson-jessi-colter-tompall-glaser", permanent: true },
      { source: "/artista/wind-fire-earth", destination: "/artista/earth-wind-fire", permanent: true },
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
      // More artist-name tags found from the 2026-07-30 artist/genre audit
      // (K-pop idol names and other artists leaked in as lastfm_tags).
      { source: "/estilo/exo", destination: "/artista/exo", permanent: true },
      { source: "/estilo/jimin", destination: "/artista/jimin", permanent: true },
      { source: "/estilo/rose", destination: "/artista/rose", permanent: true },
      { source: "/estilo/jay-z", destination: "/artista/jay-z", permanent: true },
      { source: "/estilo/metallica", destination: "/artista/metallica", permanent: true },
      // Anime titles used as a folksonomy tag instead of the actual genre --
      // redirect into the real anime-soundtrack listing rather than a
      // single-title page with no unique browsing value.
      { source: "/estilo/naruto", destination: "/estilo/anime", permanent: true },
      { source: "/estilo/one-piece", destination: "/estilo/anime", permanent: true },
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
      { source: "/estilo/audio-book", destination: "/estilo/audiobook", permanent: true },
      { source: "/estilo/boy-band", destination: "/estilo/boybands", permanent: true },
      { source: "/estilo/chill-out", destination: "/estilo/chillout", permanent: true },
      { source: "/estilo/dreampop", destination: "/estilo/dream-pop", permanent: true },
      { source: "/estilo/german-hip-hop", destination: "/estilo/german-hiphop", permanent: true },
      { source: "/estilo/hiphop", destination: "/estilo/hip-hop", permanent: true },
      { source: "/estilo/lofi", destination: "/estilo/lo-fi", permanent: true },
      { source: "/estilo/psy-trance", destination: "/estilo/psytrance", permanent: true },
      // Spelling-variant estilo tags found from the 2026-07-30 catalog-wide
      // artist/genre-tag dedup pass. lastfm_tags backfilled directly; these
      // just catch already-indexed old URLs. NOTE: replaces (not duplicates)
      // the old "/estilo/alternative-hip-hop -> alternative-hiphop" rule --
      // that direction went stale once the backfill made "hip-hop" (hyphen)
      // the majority spelling, which would have redirected the now-canonical
      // page away to an empty one.
      { source: "/estilo/singersongwriter", destination: "/estilo/singer-songwriter", permanent: true },
      { source: "/estilo/poprock", destination: "/estilo/pop-rock", permanent: true },
      { source: "/estilo/hard-core", destination: "/estilo/hardcore", permanent: true },
      { source: "/estilo/electro-pop", destination: "/estilo/electropop", permanent: true },
      { source: "/estilo/artpop", destination: "/estilo/art-pop", permanent: true },
      { source: "/estilo/powerpop", destination: "/estilo/power-pop", permanent: true },
      { source: "/estilo/hardbop", destination: "/estilo/hard-bop", permanent: true },
      { source: "/estilo/avantgarde", destination: "/estilo/avant-garde", permanent: true },
      { source: "/estilo/triphop", destination: "/estilo/trip-hop", permanent: true },
      { source: "/estilo/rb", destination: "/estilo/r-b", permanent: true },
      { source: "/estilo/underground-hiphop", destination: "/estilo/underground-hip-hop", permanent: true },
      { source: "/estilo/jpop", destination: "/estilo/j-pop", permanent: true },
      { source: "/estilo/kpop", destination: "/estilo/k-pop", permanent: true },
      { source: "/estilo/kraut-rock", destination: "/estilo/krautrock", permanent: true },
      { source: "/estilo/contemporaryfolk", destination: "/estilo/contemporary-folk", permanent: true },
      { source: "/estilo/avantgarde-jazz", destination: "/estilo/avant-garde-jazz", permanent: true },
      { source: "/estilo/afro-beat", destination: "/estilo/afrobeat", permanent: true },
      { source: "/estilo/nujazz", destination: "/estilo/nu-jazz", permanent: true },
      { source: "/estilo/neo-folk", destination: "/estilo/neofolk", permanent: true },
      { source: "/estilo/alternative-hiphop", destination: "/estilo/alternative-hip-hop", permanent: true },
      { source: "/estilo/hyper-pop", destination: "/estilo/hyperpop", permanent: true },
      { source: "/estilo/synth-wave", destination: "/estilo/synthwave", permanent: true },
      { source: "/estilo/emopop", destination: "/estilo/emo-pop", permanent: true },
      { source: "/estilo/cold-wave", destination: "/estilo/coldwave", permanent: true },
      { source: "/estilo/west-coast-hiphop", destination: "/estilo/west-coast-hip-hop", permanent: true },
      { source: "/estilo/standup-comedy", destination: "/estilo/stand-up-comedy", permanent: true },
      { source: "/estilo/jamband", destination: "/estilo/jam-band", permanent: true },
      { source: "/estilo/latinjazz", destination: "/estilo/latin-jazz", permanent: true },
      { source: "/estilo/neo-classical-dark-wave", destination: "/estilo/neoclassical-darkwave", permanent: true },
      { source: "/estilo/thrash-core", destination: "/estilo/thrashcore", permanent: true },
      { source: "/estilo/euro-pop", destination: "/estilo/europop", permanent: true },
      { source: "/estilo/avant-garde-pop", destination: "/estilo/avantgarde-pop", permanent: true },
      { source: "/estilo/cyber-punk", destination: "/estilo/cyberpunk", permanent: true },
      // Artist-name merges from the same pass (case/accent/encoding-corruption
      // variants folded into one canonical spelling) that also changed the URL
      // slug -- most case/accent-only merges keep the same slug and need no
      // redirect (slugifyArtist already normalizes those), these are the ones
      // that didn't.
      { source: "/artista/various", destination: "/artista/various-artists", permanent: true },
      { source: "/artista/varios", destination: "/artista/various-artists", permanent: true },
      { source: "/artista/various-artist", destination: "/artista/various-artists", permanent: true },
      { source: "/artista/varios-artistas", destination: "/artista/various-artists", permanent: true },
      { source: "/artista/artists-various", destination: "/artista/various-artists", permanent: true },
      { source: "/artista/various-aritist", destination: "/artista/various-artists", permanent: true },
      { source: "/artista/vf", destination: "/artista/nf", permanent: true },
      { source: "/artista/willie-col-n", destination: "/artista/willie-colon", permanent: true },
      { source: "/artista/willie-col-n-hector-lavoe", destination: "/artista/willie-colon-hector-lavoe", permanent: true },
      { source: "/artista/willie-col-n-ruben-blades", destination: "/artista/willie-colon-ruben-blades", permanent: true },
      { source: "/artista/willie-col-n-celia-cruz", destination: "/artista/willie-colon-celia-cruz", permanent: true },
      { source: "/artista/andr-s-schiff", destination: "/artista/andras-schiff", permanent: true },
      { source: "/artista/mar-a-due-as", destination: "/artista/maria-duenas", permanent: true },
      { source: "/artista/motley-cr-e", destination: "/artista/motley-crue", permanent: true },
      { source: "/artista/lady-gaga-joaquin-phoenix-cast-of-joker-folie-deux", destination: "/artista/lady-gaga-joaquin-phoenix-cast-of-joker-folie-a-deux", permanent: true },
      { source: "/artista/alabama3", destination: "/artista/alabama-3", permanent: true },
      { source: "/artista/black-pink", destination: "/artista/blackpink", permanent: true },
      { source: "/artista/booker-t-the-m-g-s", destination: "/artista/booker-t-the-mg-s", permanent: true },
      { source: "/artista/brianauger-s-oblivion-express", destination: "/artista/brian-auger-s-oblivion-express", permanent: true },
      { source: "/artista/doa", destination: "/artista/d-o-a", permanent: true },
      { source: "/artista/deathgrips", destination: "/artista/death-grips", permanent: true },
      { source: "/artista/wind-fire-earth", destination: "/artista/earth-wind-fire", permanent: true },
      { source: "/artista/enuff-znuff", destination: "/artista/enuff-z-nuff", permanent: true },
      { source: "/artista/head-cat", destination: "/artista/headcat", permanent: true },
      { source: "/artista/jungkook", destination: "/artista/jung-kook", permanent: true },
      { source: "/artista/la-guns", destination: "/artista/l-a-guns", permanent: true },
      { source: "/artista/leadbelly", destination: "/artista/lead-belly", permanent: true },
      { source: "/artista/nct127", destination: "/artista/nct-127", permanent: true },
      { source: "/artista/new-jeans", destination: "/artista/newjeans", permanent: true },
      { source: "/artista/noah-finnce", destination: "/artista/noahfinnce", permanent: true },
      { source: "/artista/ork", destination: "/artista/o-r-k", permanent: true },
      { source: "/artista/the-jet-black-s", destination: "/artista/the-jet-blacks", permanent: true },
      { source: "/artista/the-creator-tyler", destination: "/artista/tyler-the-creator", permanent: true },
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
