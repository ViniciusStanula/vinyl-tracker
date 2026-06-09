import type { Metadata } from "next";
import Link from "next/link";
import AlbumCarousel from "@/components/guias/AlbumCarousel";
import { getRockSubgenres } from "@/lib/guias/rock-data";
import { ROCK_INTRO, SUBGENRE_ORDER, capitalize } from "@/lib/guias/rock-content";
import { fetchLastfmAlbumCover } from "@/lib/external/lastfmAlbum";

import { SITE_URL } from "@/lib/siteUrl";
const PREVIEW_COUNT = 10;

const META_TITLE = "Os Discos de Rock Mais Bem Avaliados por Subgênero | Garimpa Vinil";
const META_DESC = "Analisamos mais de 11.000 discos de rock via Discogs e ranqueamos os melhores por subgênero: classic rock, grunge, indie, shoegaze, blues rock e mais.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "/guias/rock" },
  openGraph: {
    title: META_TITLE,
    description: META_DESC,
    url: "/guias/rock",
    type: "website",
    images: ["/og-default.png"],
  },
  twitter: {
    card: "summary",
    title: META_TITLE,
    description: META_DESC,
  },
};

export default async function RockPage() {
  const subgenres = getRockSubgenres();
  const totalAlbums = subgenres.reduce((s, sg) => s + sg.albumCount, 0);
  const totalArtists = subgenres.reduce((s, sg) => s + sg.artistCount, 0);

  const sorted = [...subgenres].sort((a, b) => {
    const ai = SUBGENRE_ORDER.indexOf(a.slug);
    const bi = SUBGENRE_ORDER.indexOf(b.slug);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const subgenresWithCovers = await Promise.all(
    sorted.map(async (sg) => {
      const preview = sg.topAlbums.slice(0, PREVIEW_COUNT);
      const covers = await Promise.all(
        preview.map((a) => fetchLastfmAlbumCover(a.artist, a.title))
      );
      return { sg, preview, covers };
    })
  );

  const breadcrumb = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Guias", item: `${SITE_URL}/guias` },
      { "@type": "ListItem", position: 3, name: "Rock", item: `${SITE_URL}/guias/rock` },
    ],
  }).replace(/<\//g, "<\\/");

  return (
    <main id="main-content" className="max-w-5xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumb }} />

      <nav className="mb-6 text-sm text-dust flex gap-2 flex-wrap">
        <Link href="/" className="hover:text-gold transition-colors">Início</Link>
        <span>›</span>
        <Link href="/guias" className="hover:text-gold transition-colors">Guias</Link>
        <span>›</span>
        <span className="text-parchment">Rock</span>
      </nav>

      <header className="mb-10">
        <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight mb-4">
          Os discos de <span className="text-gold">Rock</span>{" "}
          mais bem avaliados
        </h1>

        {/* Stats pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          {[
            `${totalAlbums.toLocaleString("pt-BR")} discos`,
            `${totalArtists.toLocaleString("pt-BR")} artistas`,
            `${subgenres.length} subgêneros`,
            "via Discogs",
          ].map((stat) => (
            <span
              key={stat}
              className="text-xs text-parchment bg-sleeve border border-groove rounded-full px-3 py-1"
            >
              {stat}
            </span>
          ))}
        </div>

        <div className="bg-sleeve border border-groove rounded-xl px-5 py-4 space-y-2.5">
          {ROCK_INTRO.split("\n\n").map((p, i) => (
            <p key={i} className="text-parchment text-sm leading-relaxed">{p}</p>
          ))}
        </div>
      </header>

      <div className="space-y-12">
        {subgenresWithCovers.map(({ sg, preview, covers }) => {
          const displayName = capitalize(sg.name);
          const carouselAlbums = preview.map((album, i) => ({
            ...album,
            coverUrl: covers[i],
            rank: i + 1,
            size: "sm" as const,
          }));

          return (
            <section key={sg.slug} aria-labelledby={`sg-${sg.slug}`}>
              {/* Section header */}
              <div className="flex items-start justify-between gap-3 mb-4 border-l-2 border-gold/50 pl-4">
                <div>
                  <h2
                    id={`sg-${sg.slug}`}
                    className="font-display text-xl font-bold text-cream leading-tight"
                  >
                    {displayName}
                  </h2>
                  <p className="text-dust text-xs mt-1">
                    {sg.albumCount.toLocaleString("pt-BR")} álbuns · {sg.artistCount.toLocaleString("pt-BR")} artistas
                  </p>
                </div>
                <Link
                  href={`/guias/rock/${sg.slug}`}
                  className="shrink-0 text-xs font-medium text-gold hover:text-goldlit transition-colors mt-0.5"
                >
                  Ver ranking →
                </Link>
              </div>

              <AlbumCarousel albums={carouselAlbums} size="preview" />
            </section>
          );
        })}
      </div>

      <footer className="mt-16 pt-8 border-t border-groove">
        <Link href="/guias" className="text-sm text-dust hover:text-gold transition-colors">
          ← Todos os guias
        </Link>
      </footer>
    </main>
  );
}
