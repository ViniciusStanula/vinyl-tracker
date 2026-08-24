import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AlbumCard from "@/components/guias/AlbumCard";
import { getRockSubgenres, getSubgenre } from "@/lib/guias/rock-data";
import { SUBGENRE_FULL, capitalize } from "@/lib/guias/rock-content";
import { fetchLastfmAlbumCover } from "@/lib/external/lastfmAlbum";

import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
const CARD_COUNT = 20;
// The table used to render every scored album in the subgenre, which pushed
// /guias/rock/hard-rock and /guias/rock/alternative-rock past 2 MB of HTML.
// Ranked lists have a long tail nobody reads; 300 rows keeps the page useful
// and well under 500 KB.
const TABLE_LIMIT = 300;

export function generateStaticParams() {
  return getRockSubgenres().map((sg) => ({ slug: sg.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sg = getSubgenre(slug);
  if (!sg) return {};

  const displayName = capitalize(sg.name);
  const title = `Melhores Discos de ${displayName} | Garimpa Vinil`;
  const description = `Ranking dos melhores discos de ${displayName}: ${sg.albumCount.toLocaleString("pt-BR")} álbuns de ${sg.artistCount.toLocaleString("pt-BR")} artistas, com nota média ponderada pelo número de avaliações no Discogs.`;

  const firstAlbum = sg.topAlbums[0];
  const ogImage = firstAlbum
    ? await fetchLastfmAlbumCover(firstAlbum.artist, firstAlbum.title)
    : null;

  return {
    title,
    description,
    alternates: { canonical: `/guias/rock/${slug}` },
    openGraph: {
      title,
      description,
      url: `/guias/rock/${slug}`,
      type: "website",
      images: ogImage ? [{ url: ogImage, width: 300, height: 300, alt: `Capa de ${firstAlbum?.title}` }] : ["/og-default.png"],
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: [ogImage ?? "/og-default.png"],
    },
  };
}

export default async function RockSubgenrePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sg = getSubgenre(slug);
  if (!sg) notFound();

  const displayName = capitalize(sg.name);
  const cardAlbums = sg.topAlbums.slice(0, CARD_COUNT);
  const tableAlbums = sg.topAlbums.slice(CARD_COUNT, CARD_COUNT + TABLE_LIMIT);
  const fullIntro = SUBGENRE_FULL[sg.slug];

  const covers = await Promise.all(
    cardAlbums.map((a) => fetchLastfmAlbumCover(a.artist, a.title))
  );


  const breadcrumb = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Guias", item: `${SITE_URL}/guias` },
      { "@type": "ListItem", position: 3, name: "Rock", item: `${SITE_URL}/guias/rock` },
      { "@type": "ListItem", position: 4, name: displayName, item: `${SITE_URL}/guias/rock/${slug}` },
    ],
  });

  const itemList = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Melhores álbuns de ${displayName}`,
    url: `${SITE_URL}/guias/rock/${slug}`,
    numberOfItems: cardAlbums.length,
    // Album entities rather than "Title - Artist" strings: the ranking carries
    // the year and the MusicBrainz release-group id for every entry, and a
    // parser had to guess where the title ended and the artist began.
    itemListElement: cardAlbums.map((album, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "MusicAlbum",
        name: album.title,
        byArtist: { "@type": "MusicGroup", name: album.artist },
        ...(album.year ? { datePublished: String(album.year) } : {}),
        ...(album.mb_rgid
          ? { sameAs: `https://musicbrainz.org/release-group/${album.mb_rgid}` }
          : {}),
        genre: displayName,
      },
    })),
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumb }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemList }} />

      <nav className="mb-6 text-sm text-dust flex gap-2 flex-wrap">
        <Link href="/" className="hover:text-gold transition-colors">Início</Link>
        <span>›</span>
        <Link href="/guias" className="hover:text-gold transition-colors">Guias</Link>
        <span>›</span>
        <Link href="/guias/rock" className="hover:text-gold transition-colors">Rock</Link>
        <span>›</span>
        <span className="text-parchment">{displayName}</span>
      </nav>

      <header className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight mb-3">
          Os melhores discos de{" "}
          <span className="text-gold">{displayName}</span>
        </h1>
        <div className="flex flex-wrap gap-2 mb-5">
          {[
            `${sg.albumCount.toLocaleString("pt-BR")} discos`,
            `${sg.artistCount.toLocaleString("pt-BR")} artistas`,
            "avaliações via Discogs",
          ].map((s) => (
            <span key={s} className="text-xs text-parchment bg-sleeve border border-groove rounded-full px-3 py-1">
              {s}
            </span>
          ))}
        </div>
        <p className="text-parchment text-sm leading-relaxed max-w-2xl">
          Analisamos {sg.albumCount.toLocaleString("pt-BR")} discos de {sg.artistCount.toLocaleString("pt-BR")} artistas
          de {displayName} usando avaliações do Discogs. Aplicamos uma média bayesiana ponderada para separar
          os melhores: álbuns com mais avaliações têm mais peso, mas discos menores também aparecem quando
          a qualidade justifica. Os {CARD_COUNT} melhores estão em destaque abaixo;{" "}
          {tableAlbums.length > 0
            ? `os ${tableAlbums.length.toLocaleString("pt-BR")} seguintes melhor avaliados seguem na tabela.`
            : "a lista completa está abaixo."}
        </p>
      </header>

      {/* Top 20 grid */}
      <section aria-label={`Top ${CARD_COUNT} álbuns de ${displayName}`} className="mb-12">
        <h2 className="font-display text-lg font-bold text-cream mb-4">
          Top {CARD_COUNT} discos de {displayName}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {cardAlbums.map((album, i) => (
            <AlbumCard
              key={album.mb_rgid}
              title={album.title}
              artist={album.artist}
              year={album.year}
              mb_rgid={album.mb_rgid}
              weighted_score={album.weighted_score}
              discogs_rating={album.discogs_rating}
              discogs_reviews={album.discogs_reviews}
              coverUrl={covers[i]}
              rank={i + 1}
              size="lg"
            />
          ))}
        </div>
      </section>

      {/* Remaining albums — table */}
      {tableAlbums.length > 0 && (
        <section aria-label={`Melhores álbuns de ${displayName}`} className="mb-12">
          <h2 className="font-display text-lg font-bold text-cream mb-4">
            Os {(CARD_COUNT + tableAlbums.length).toLocaleString("pt-BR")} melhores álbuns
          </h2>
          <div className="overflow-x-auto rounded-xl border border-groove">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-groove bg-sleeve">
                  <th className="py-3 px-4 text-right text-[10px] font-semibold text-dust uppercase tracking-wider w-10">#</th>
                  <th className="py-3 px-4 text-left text-[10px] font-semibold text-dust uppercase tracking-wider">Álbum</th>
                  <th className="py-3 px-4 text-left text-[10px] font-semibold text-dust uppercase tracking-wider">Artista</th>
                  <th className="py-3 px-4 text-right text-[10px] font-semibold text-dust uppercase tracking-wider">Ano</th>
                  <th className="py-3 px-4 text-right text-[10px] font-semibold text-dust uppercase tracking-wider">Score</th>
                  <th className="py-3 px-4 text-right text-[10px] font-semibold text-dust uppercase tracking-wider">Nota</th>
                  <th className="py-3 px-4 text-right text-[10px] font-semibold text-dust uppercase tracking-wider">Aval.</th>
                </tr>
              </thead>
              <tbody>
                {tableAlbums.map((album, i) => (
                  <tr
                    key={album.mb_rgid}
                    className="border-b border-groove/40 last:border-0 hover:bg-sleeve/60 transition-colors"
                  >
                    <td className="py-2.5 px-4 text-right text-dust text-xs tabular-nums">
                      {CARD_COUNT + i + 1}
                    </td>
                    <td className="py-2.5 px-4 text-cream text-xs font-medium">
                      <span className="line-clamp-1">{album.title}</span>
                    </td>
                    <td className="py-2.5 px-4 text-parchment text-xs">
                      <span className="line-clamp-1">{album.artist}</span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-dust text-xs tabular-nums">{album.year}</td>
                    <td className="py-2.5 px-4 text-right text-gold text-xs font-bold tabular-nums">
                      {album.weighted_score.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-parchment text-xs tabular-nums">
                      {album.discogs_rating.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-dust text-xs tabular-nums">
                      {album.discogs_reviews.toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Genre context — secondary */}
      {fullIntro && (
        <section className="mb-10 bg-sleeve border border-groove rounded-xl px-5 py-5 space-y-3">
          <h2 className="font-display text-base font-bold text-cream">Sobre {displayName}</h2>
          {fullIntro.split("\n\n").map((p, i) => (
            <p key={i} className="text-parchment text-sm leading-relaxed">{p}</p>
          ))}
        </section>
      )}

      <footer className="pt-8 border-t border-groove flex flex-wrap gap-4">
        <Link href="/guias/rock" className="text-sm text-dust hover:text-gold transition-colors">
          ← Voltar para Rock
        </Link>
        <Link href="/guias" className="text-sm text-dust hover:text-gold transition-colors">
          Todos os guias
        </Link>
        <Link href="/disco" className="text-sm text-dust hover:text-gold transition-colors">
          Buscar esses discos com preço monitorado
        </Link>
        <Link href="/guias/como-avaliar-estado-disco-vinil" className="text-sm text-dust hover:text-gold transition-colors">
          Como avaliar o estado antes de comprar
        </Link>
      </footer>
    </div>
  );
}
